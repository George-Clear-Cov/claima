import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getSession } from "@/lib/auth"

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!client) return NextResponse.json({ error: "ANTHROPIC_API_KEY required" }, { status: 503 })

  const { note, patients, providers } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: "note required" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  const prompt = `You are a medical billing specialist reviewing a clinical session note for insurance claim submission.

SESSION NOTE:
"""
${note}
"""

Today: ${today}

Available patients (match by name — first, last, or nickname):
${(patients as { id: string; firstName: string; lastName: string; payerName: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | ${p.payerName}`).join("\n") || "  (none — set patientId to null)"}

Available providers:
${(providers as { id: string; firstName: string; lastName: string; npi: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | NPI ${p.npi}`).join("\n") || "  (none — set providerId to null)"}

CPT selection (mental health outpatient):
- 90791: intake / initial eval / diagnostic interview / first visit
- 90832: psychotherapy 30 min (16–37 min, or "brief session")
- 90834: psychotherapy 45 min (38–52 min)
- 90837: psychotherapy 60 min (53+ min, or duration unspecified — use as default)
- 90847: family therapy WITH patient present
- 90846: family therapy WITHOUT patient
- 90853: group psychotherapy
- 90839: psychotherapy for crisis, 60 min
- 99213: E&M office visit (if medication management discussed as primary focus)
- +90833: psychotherapy add-on to E&M (use with 99213 if therapy was also provided)

ICD-10 — include ALL diagnoses mentioned, implied, or documented:
F32.1 MDD moderate, F32.2 MDD severe, F32.9 MDD unspecified, F34.1 PDD/dysthymia,
F41.1 GAD, F41.0 panic disorder, F40.10 social anxiety, F41.9 anxiety unspecified,
F43.10 PTSD, F43.23 adjustment disorder with depressed mood, F43.21 adjustment with anxiety,
F31.9 bipolar I, F31.81 bipolar II, F90.2 ADHD combined, F42.2 OCD,
F50.9 eating disorder, F60.3 borderline PD, F60.9 personality disorder unspecified,
Z63.0 relationship distress/couples, Z63.4 uncomplicated bereavement,
Z91.19 treatment non-adherence, F10.10 alcohol use mild

Respond ONLY with valid JSON (no code fences):
{
  "patientId": "<exact ID from list or null>",
  "patientName": "<full name as mentioned in note, or null>",
  "providerId": "<exact ID from list or null>",
  "providerName": "<provider name from note, or null>",
  "serviceDate": "<YYYY-MM-DD — use today if not specified>",
  "sessionDurationMinutes": <integer or null>,
  "cptCode": "<5-digit CPT code>",
  "additionalCptCodes": ["<add-on CPT codes, e.g. 90833, or empty array>"],
  "icd10Codes": ["<at least one ICD-10 code>"],
  "modifier": "<'95' for telehealth, '59' for distinct procedure, or ''>",
  "chargeAmount": <number — typical: 90791=325, 90832=125, 90834=165, 90837=215, 90839=275, 90847=195, 99213=175>,
  "telehealth": <true|false>,
  "clinicalSummary": "<1 sentence for billing notes field>",
  "confidence": <0-100>,
  "flags": ["<any compliance or documentation flags — e.g. 'Duration not documented; defaulted to 90837', 'Crisis language present; consider 90839'>"]
}`

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })
    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")
    return NextResponse.json(JSON.parse(match[0]))
  } catch (err) {
    console.error("[claims/from-note] failed:", err)
    return NextResponse.json({ error: "Note parsing failed" }, { status: 422 })
  }
}
