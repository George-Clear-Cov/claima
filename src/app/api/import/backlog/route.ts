import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"
import { parse835Backlog } from "@/lib/import/from835"
import { commitImport } from "@/lib/import/commit"
import type { ImportParseResult } from "@/lib/import/types"

/**
 * POST /api/import/backlog — load a practice's historical claim/denial backlog.
 * Body: { format: "835"|..., contents: string[] (raw file text), mode: "preview"|"commit" }
 * Preview (default) parses + dry-runs the commit (no writes) and returns a sample + summary.
 * Commit writes Patients/Claims/Denials, scoped to the caller's practice.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const format = String(body?.format ?? "")
    const contents = body?.contents
    const mode = body?.mode === "commit" ? "commit" : "preview"

    if (!Array.isArray(contents) || contents.length === 0 || !contents.every((c) => typeof c === "string")) {
      return NextResponse.json({ error: "Provide `contents` as a non-empty array of file text strings." }, { status: 400 })
    }

    let parsed: ImportParseResult
    switch (format) {
      case "835":
        parsed = parse835Backlog(contents)
        break
      // "837" | "csv" | "text" adapters are wired here as they land.
      default:
        return NextResponse.json({ error: `Unsupported format "${format}". Supported: 835.` }, { status: 400 })
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
