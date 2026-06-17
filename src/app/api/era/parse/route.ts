import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { aiComplete, isAIConfigured } from "@/lib/ai"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { text } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: "EOB text is required" }, { status: 400 })
  }

  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI parsing requires ANTHROPIC_API_KEY", parsed: false }, { status: 503 })
  }

  const prompt = `You are a medical billing specialist. Extract payment information from the Explanation of Benefits (EOB) or Electronic Remittance Advice (ERA) text below.

EOB/ERA TEXT:
${text}

Extract the values and respond ONLY with valid JSON:
{
  "insurancePaid": <number — total amount paid by insurance, 0 if not found>,
  "adjustments": <number — contractual adjustments / write-offs, 0 if not found>,
  "patientResponsibility": <number — patient copay/coinsurance/deductible owed, 0 if not found>,
  "carcCodes": [<string — any CARC or RARC reason codes found, e.g. "4", "16", "CO-45">],
  "claimNumber": "<claim or reference number, null if not found>",
  "checkNumber": "<check or EFT number, null if not found>",
  "notes": "<one sentence describing what was found>",
  "confidence": <integer 0-100 — confidence in the extraction>
}

If a value is not present in the text, use 0 for numbers and null for strings. Be precise with dollar amounts — use the exact figures from the document.`

  try {
    const responseText = await aiComplete({ max_tokens: 512, messages: [{ role: "user", content: prompt }] })
    const match = responseText.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")

    const result = JSON.parse(match[0])
    return NextResponse.json({ ...result, parsed: true })
  } catch {
    return NextResponse.json({ error: "Failed to parse EOB text", parsed: false }, { status: 422 })
  }
}
