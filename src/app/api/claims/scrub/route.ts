import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { aiComplete, isAIConfigured } from "@/lib/ai"

interface ScrubIssue {
  severity: "error" | "warning" | "info"
  message: string
  fix: string
}

interface ScrubResult {
  score: number
  verdict: "clean" | "caution" | "warning"
  issues: ScrubIssue[]
  summary: string
}

const scrubSchema = z.object({
  cptCode: z.string().min(5).max(5),
  icd10Codes: z.array(z.string().max(10)).min(1).max(12),
  modifier: z.string().max(10).optional(),
  payerName: z.string().max(100).optional(),
  charge: z.number().positive().optional(),
  serviceDate: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let input: z.infer<typeof scrubSchema>
  try {
    input = scrubSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { cptCode, icd10Codes, modifier, payerName, charge, serviceDate } = input

  if (!isAIConfigured()) {
    return NextResponse.json(basicScrub({ cptCode, icd10Codes, modifier, charge: charge ?? 0 }))
  }

  const prompt = `You are a medical billing expert specializing in mental health claims (837P). Review this claim for denial risk before it is submitted.

CPT Code: ${cptCode}
ICD-10 Diagnosis Codes: ${icd10Codes.join(", ")}
Modifier: ${modifier || "none"}
Payer: ${payerName}
Charge Amount: $${charge}
Service Date: ${serviceDate}

Analyze for:
1. CPT/ICD-10 medical necessity alignment — do the diagnoses justify this procedure?
2. Common denial triggers for mental health billing (prior auth, annual session limits, CARC codes 4, 16, 50, 197)
3. Modifier presence and correctness (telehealth GT/95, family 76)
4. Charge amount reasonableness for this CPT in a mental health outpatient setting
5. Any payer-specific gotchas for ${payerName}

Respond ONLY with valid JSON:
{
  "score": <integer 0-100, where 100 = zero risk>,
  "verdict": <"clean" | "caution" | "warning">,
  "issues": [
    {
      "severity": <"error" | "warning" | "info">,
      "message": "<concise description of the issue>",
      "fix": "<specific actionable step the biller should take>"
    }
  ],
  "summary": "<one sentence for the biller>"
}

verdict: clean if score>=85, caution if 60-84, warning if <60. Return an empty array if no issues.`

  try {
    const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")

    const result: ScrubResult = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(basicScrub({ cptCode, icd10Codes, modifier, charge: charge ?? 0 }))
  }
}

function basicScrub({ cptCode, icd10Codes, modifier, charge }: {
  cptCode: string
  icd10Codes: string[]
  modifier?: string
  charge: number
}): ScrubResult {
  const issues: ScrubIssue[] = []

  const mentalHealthCpts = ["90791", "90792", "90832", "90834", "90837", "90838", "90839", "90840", "90846", "90847", "90853"]
  if (!mentalHealthCpts.includes(cptCode)) {
    issues.push({ severity: "warning", message: `CPT ${cptCode} is not a standard mental health outpatient code`, fix: "Confirm CPT code matches the service rendered" })
  }

  const chargeRanges: Record<string, [number, number]> = {
    "90791": [200, 500], "90792": [250, 600],
    "90832": [75, 175],  "90834": [100, 225], "90837": [150, 325],
    "90847": [150, 300], "90846": [120, 275], "90853": [50, 150],
  }
  const range = chargeRanges[cptCode]
  if (range && (charge < range[0] || charge > range[1])) {
    issues.push({ severity: "warning", message: `$${charge} is outside the typical range ($${range[0]}–$${range[1]}) for ${cptCode}`, fix: "Verify charge against your fee schedule; unusually high charges may trigger audits" })
  }

  if (!icd10Codes.length) {
    issues.push({ severity: "error", message: "No ICD-10 diagnosis codes", fix: "Add at least one diagnosis code — claim will be auto-rejected without one" })
  }

  const hasF3x = icd10Codes.some(c => c.startsWith("F3"))
  const hasF4x = icd10Codes.some(c => c.startsWith("F4"))
  if (!hasF3x && !hasF4x && mentalHealthCpts.includes(cptCode)) {
    issues.push({ severity: "warning", message: "No F3x/F4x mood or anxiety disorder code — payers may question medical necessity", fix: "Add a primary mental health diagnosis (F31–F48) if clinically appropriate" })
  }

  if (modifier === "GT" || modifier === "95") {
    issues.push({ severity: "info", message: "Telehealth modifier present — confirm payer covers telehealth for this CPT", fix: "Check payer telehealth policy; some require a place-of-service code 02 or 10 as well" })
  }

  const score = Math.max(0, 100 - issues.filter(i => i.severity === "error").length * 30 - issues.filter(i => i.severity === "warning").length * 12 - issues.filter(i => i.severity === "info").length * 3)

  return {
    score,
    verdict: score >= 85 ? "clean" : score >= 60 ? "caution" : "warning",
    issues,
    summary: issues.length === 0
      ? "No issues detected — claim looks ready to submit."
      : `${issues.length} item${issues.length > 1 ? "s" : ""} flagged — review before submitting.`,
  }
}
