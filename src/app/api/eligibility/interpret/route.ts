import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

interface InterpretRequest {
  patientName: string
  payerName: string
  coverage: {
    planName: string
    inNetwork: boolean
    deductible: number
    deductibleMet: number
    outOfPocketMax: number
    outOfPocketMet: number
    copay: number
    coinsurance: number
    visitLimit: number | null
    visitsUsed: number | null
    priorAuthRequired: boolean
    effectiveDate: string
    terminationDate: string | null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { patientName, payerName, coverage }: InterpretRequest = await req.json()

    const deductibleRemaining = Math.max(coverage.deductible - coverage.deductibleMet, 0)
    const visitsRemaining = coverage.visitLimit != null && coverage.visitsUsed != null
      ? coverage.visitLimit - coverage.visitsUsed
      : null

    if (!client) {
      return NextResponse.json(fallbackInterpret({ payerName, coverage, deductibleRemaining, visitsRemaining }))
    }

    const prompt = `You are a medical billing expert helping a mental health practice prepare for a therapy session.

Patient: ${patientName}
Payer: ${payerName}
Plan: ${coverage.planName}
In-Network: ${coverage.inNetwork}
Deductible: $${coverage.deductibleMet} met of $${coverage.deductible} ($${deductibleRemaining} remaining)
Out-of-Pocket Max: $${coverage.outOfPocketMet} met of $${coverage.outOfPocketMax}
Copay: $${coverage.copay} per visit
Coinsurance: ${coverage.coinsurance}% (after deductible)
Visit Limit: ${coverage.visitLimit != null ? `${coverage.visitsUsed} used of ${coverage.visitLimit} (${visitsRemaining} remaining)` : "Unlimited / not specified"}
Prior Auth Required: ${coverage.priorAuthRequired}
Effective: ${coverage.effectiveDate}${coverage.terminationDate ? ` · Expires ${coverage.terminationDate}` : ""}

Write a brief, practical plain-English summary for the front desk / biller, covering:
1. What the patient owes at this visit
2. Any warnings (low visits, prior auth needed, deductible not met, near OOP max)
3. One-sentence action item

Respond ONLY with JSON:
{
  "summary": "<2-3 sentence plain English summary, starting with the patient's financial responsibility for today's session>",
  "actions": ["<concise action>", "<concise action>"],
  "sessionNote": "<one-sentence note for the chart, e.g.: 'Patient has $X deductible remaining; collected $Y copay.'>",
  "patientOwesEstimate": <number, estimated patient responsibility in dollars for a standard 60-min therapy session>
}`

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const raw = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")

    return NextResponse.json(JSON.parse(match[0]))
  } catch (err) {
    console.error("[eligibility/interpret] failed:", err)
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(fallbackInterpret({
      payerName: body.payerName ?? "payer",
      coverage: body.coverage,
      deductibleRemaining: body.coverage ? Math.max(body.coverage.deductible - body.coverage.deductibleMet, 0) : 0,
      visitsRemaining: null,
    }))
  }
}

function fallbackInterpret({ payerName, coverage, deductibleRemaining, visitsRemaining }: {
  payerName: string
  coverage: InterpretRequest["coverage"] | null
  deductibleRemaining: number
  visitsRemaining: number | null
}) {
  if (!coverage) {
    return { summary: "Coverage data unavailable.", actions: [], sessionNote: "", patientOwesEstimate: 0 }
  }

  const owes = deductibleRemaining > 0
    ? `Patient owes $${Math.min(deductibleRemaining, 200).toFixed(0)} toward deductible`
    : coverage.copay > 0
    ? `Patient owes $${coverage.copay} copay`
    : `Patient owes ${coverage.coinsurance}% coinsurance after deductible`

  const actions: string[] = []
  if (coverage.priorAuthRequired) actions.push("Obtain prior authorization before session")
  if (visitsRemaining !== null && visitsRemaining <= 5) actions.push(`Only ${visitsRemaining} visits remaining — discuss with patient`)
  if (deductibleRemaining > 0) actions.push(`Collect $${Math.min(deductibleRemaining, 200).toFixed(0)} toward deductible today`)
  else if (coverage.copay > 0) actions.push(`Collect $${coverage.copay} copay at check-in`)

  return {
    summary: `${coverage.inNetwork ? "In-network" : "Out-of-network"} ${payerName} coverage is active. ${owes} for today's session.`,
    actions,
    sessionNote: `${owes}; plan ${coverage.planName}.`,
    patientOwesEstimate: deductibleRemaining > 0 ? Math.min(deductibleRemaining, 200) : coverage.copay,
  }
}
