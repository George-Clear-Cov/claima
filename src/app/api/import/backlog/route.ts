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
