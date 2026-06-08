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

  const { text, patients, providers } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  const prompt = `You are a medical billing intake system. Extract structured claim data from this session note.

Session description: "${text}"
Today's date: ${today}

Available patients (match by name):
${(patients as { id: string; firstName: string; lastName: string; payerName: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | ${p.payerName}`).join("\n")}

Available providers (match by name):
${(providers as { id: string; firstName: string; lastName: string; npi: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | NPI ${p.npi}`).join("\n")}

CPT code rules (mental health outpatient):
- 90791: intake / diagnostic evaluation / first visit
- 90832: psychotherapy 30 min (or "brief session")
- 90834: psychotherapy 45 min
- 90837: psychotherapy 60 min (default if duration unspecified)
- 90847: family therapy with patient present
- 90846: family therapy without patient
- 90853: group therapy

ICD-10 mapping:
- depression / MDD / depressed → F32.1
- anxiety / GAD / anxious → F41.1
- PTSD / trauma → F43.10
- panic → F41.0
- adjustment → F43.23
- relationship / couples → Z63.0
- ADHD → F90.2

Respond ONLY with valid JSON:
{
  "patientId": "<exact ID from list above, null if no match>",
  "providerId": "<exact ID from list above, null if no match>",
  "cptCode": "<CPT code string>",
  "icd10Codes": ["<code>"],
  "serviceDate": "<YYYY-MM-DD>",
  "chargeAmount": <number — typical charge: 90791=300, 90832=120, 90834=160, 90837=200, 90847=200, 90853=75>,
  "confidence": <0-100>,
  "explanation": "<one sentence summary of what was matched and inferred>"
}`

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })
    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: "Parse failed", confidence: 0 }, { status: 422 })
  }
}
