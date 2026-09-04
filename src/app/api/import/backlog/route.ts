import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"
import { parse835Backlog } from "@/lib/import/from835"
import { parse837Backlog } from "@/lib/import/from837"
import { parseCsvBacklog } from "@/lib/import/fromCsv"
import { parseTextBacklog } from "@/lib/import/fromText"
import { commitImport } from "@/lib/import/commit"
import type { ImportParseResult } from "@/lib/import/types"
import { parseJson, importBacklogSchema } from "@/lib/validation"
import { practiceNpiIsUsable } from "@/lib/npi"

/**
 * POST /api/import/backlog — load a practice's historical claim/denial backlog.
 * Body: { format: "835"|..., contents: string[] (raw file text), mode: "preview"|"commit" }
 * Preview (default) parses + dry-runs the commit (no writes) and returns a sample + summary.
 * Commit writes Patients/Claims/Denials, scoped to the caller's practice.
 *
 * Three gates run before any PHI is accepted, all enforced here rather than in the UI:
 * a BAA in force, a verified email address, and a real practice NPI. Any client — the
 * dashboard, the leak-report activation flow, or curl — is held to the same bar.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // A backlog import is the single largest PHI ingress in the product — a practice's entire
  // claim history in one request. HIPAA requires the BAA to be in force BEFORE we receive PHI,
  // so this is enforced server-side. BaaGate on the dashboard is a UI affordance and can be
  // bypassed by navigating straight to /import or calling this endpoint directly.
  const { prisma } = await import("@/lib/prisma")
  const [practice, user] = await Promise.all([
    prisma.practice.findUnique({
      where: { id: session.practiceId },
      select: { baaAcceptedAt: true, npi: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerifiedAt: true },
    }),
  ])

  if (!practice?.baaAcceptedAt) {
    return NextResponse.json(
      {
        error: "Business Associate Agreement required",
        detail:
          "A signed BAA must be in force before Claima can receive protected health information. " +
          "Review and accept the BAA, then retry the import.",
        baaUrl: "/baa",
      },
      { status: 403 },
    )
  }

  // An unverified address is an unidentified counterparty. Accepting a practice's entire
  // A/R from one is how we would end up holding PHI for someone we cannot contact, cannot
  // confirm authorized the transfer, and have no engagement with.
  if (!user?.emailVerifiedAt) {
    return NextResponse.json(
      {
        error: "Verify your email address first",
        detail:
          "Claima accepts protected health information only into a verified account. Enter " +
          "the code we emailed you, then retry the import.",
        verifyUrl: "/settings",
      },
      { status: 403 },
    )
  }

  // The registration placeholder. A practice that has not told us who it is cannot hand us
  // patient data — and could not file a claim anyway, since checkNpis() rejects this
  // sentinel before any 837P is built.
  if (!practiceNpiIsUsable(practice.npi)) {
    return NextResponse.json(
      {
        error: "A valid practice NPI is required",
        detail:
          "Add your 10-digit practice NPI in settings before importing patient data. It is " +
          "what identifies the covered entity on the BAA and on every claim we file.",
        settingsUrl: "/settings",
      },
      { status: 403 },
    )
  }

  try {
    const input = await parseJson(req, importBacklogSchema)
    if (!input.ok) return input.response
    const { format, contents, mapping } = input.data
    const mode = input.data.mode === "commit" ? "commit" : "preview"

    let parsed: ImportParseResult
    switch (format) {
      case "835": parsed = parse835Backlog(contents); break
      case "837": parsed = parse837Backlog(contents); break
      case "csv": parsed = parseCsvBacklog(contents.join("\n"), mapping); break
      case "text": parsed = await parseTextBacklog(contents.join("\n\n")); break
    }

    const dryRun = mode !== "commit"
    logAudit({
      action: dryRun ? "import.preview" : "import.commit",
      practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "backlog", req,
    })

    const summary = await commitImport(parsed.records, session.practiceId, { dryRun })

    return NextResponse.json({
      format: parsed.format,
      recordCount: parsed.records.length,
      parseWarnings: parsed.warnings,
      sample: dryRun ? parsed.records.slice(0, 25) : undefined,
      summary,
    })
  } catch (err) {
    logError("import/backlog", err)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
