/**
 * PDF/EOB text backlog adapter — extracts structured denial records from UNSTRUCTURED text
 * (a pasted EOB, denial report, or AR export) via the AI layer. This is the fallback when the
 * practice can't provide 835/837/CSV.
 *
 * PHI BOUNDARY: the text is sent to the AI provider, so this runs only when AI is BAA-covered
 * (isAIConfigured is fail-closed on the un-BAA'd path) — otherwise it returns a clear warning
 * and zero records rather than leaking PHI.
 */
import { aiComplete, isAIConfigured } from "../ai"
import type { ImportedRecord, ImportParseResult } from "./types"

export async function parseTextBacklog(text: string): Promise<ImportParseResult> {
  if (!isAIConfigured()) {
    return {
      format: "text",
      records: [],
      warnings: ["AI text extraction is unavailable — it requires a BAA-covered AI provider (e.g. AWS Bedrock). Use 835, 837, or CSV instead."],
    }
  }

  const prompt = `You are extracting a medical-billing denial backlog. From the text below, output ONLY a JSON array. Each element:
{"externalClaimId": string|null, "patientFirstName": string|null, "patientLastName": string|null, "patientMemberId": string|null, "payerName": string|null, "serviceDate": "YYYY-MM-DD"|null, "cptCode": string|null, "totalCharge": number|null, "totalPaid": number|null, "status": "denied"|"paid"|"open", "carcCode": string|null, "denialReason": string|null}
Rules: one element per claim/line. Use null for unknown fields. status="denied" if there is a denial/CARC code. Output the JSON array only, no prose.
TEXT:
---
${text.slice(0, 40000)}
---`

  try {
    const raw = await aiComplete({ max_tokens: 4000, label: "import-text", messages: [{ role: "user", content: prompt }] })
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return { format: "text", records: [], warnings: ["AI returned no structured records from the text."] }

    const arr = JSON.parse(match[0]) as Array<Record<string, unknown>>
    const s = (v: unknown) => (v == null || v === "" ? undefined : String(v))
    const n = (v: unknown) => (typeof v === "number" ? v : undefined)

    const records: ImportedRecord[] = arr.map((a) => {
      const status: ImportedRecord["status"] =
        a.status === "denied" || a.status === "paid" ? a.status : a.carcCode ? "denied" : "open"
      const cpt = s(a.cptCode)
      return {
        externalClaimId: s(a.externalClaimId),
        patientFirstName: s(a.patientFirstName),
        patientLastName: s(a.patientLastName),
        patientMemberId: s(a.patientMemberId),
        payerName: s(a.payerName),
        serviceDate: s(a.serviceDate),
        lines: cpt ? [{ cptCode: cpt, charge: n(a.totalCharge) }] : [],
        totalCharge: n(a.totalCharge),
        totalPaid: n(a.totalPaid),
        status,
        carcCodes: s(a.carcCode) ? [s(a.carcCode)!] : undefined,
        denialReason: s(a.denialReason),
        warnings: ["AI-extracted from unstructured text — verify before commit"],
      }
    })

    return {
      format: "text",
      records,
      warnings: ["Records were AI-extracted from unstructured text — review the preview carefully before committing (extraction can miss or misread fields)."],
    }
  } catch (e) {
    return { format: "text", records: [], warnings: [`AI extraction failed: ${(e as Error).message}`] }
  }
}
