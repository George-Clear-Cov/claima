import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSession } from "@/lib/auth"

export interface ROIResult {
  winProbability: number
  expectedValue: number
  effortHours: number
  netROI: number
  recommendation: "APPEAL" | "RESUBMIT" | "WRITE_OFF" | "BILL_PATIENT"
  rationale: string
  keyFactors: string[]
  deadline: string | null
  historicalContext: string
}

const HOURLY_RATE = 35 // biller labor cost per hour

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { denialId, carcCode, denialReason, claimAmount, payerName, cptCode, appealable, category } = await req.json()

  // Fetch practice's historical win rate for this CARC code
  let historicalWins = 0
  let historicalTotal = 0
  let historicalContext = "No prior appeals for this denial type in your practice."

  if (process.env.DATABASE_URL && denialId) {
    try {
      const { prisma } = await import("@/lib/prisma")
      const similar = await prisma.denial.findMany({
        where: {
          claim: { practiceId: session.practiceId },
          carcCode,
          appealStatus: { in: ["WON", "LOST"] },
          id: { not: denialId },
        },
        select: { appealStatus: true },
      })
      historicalWins = similar.filter((a) => a.appealStatus === "WON").length
      historicalTotal = similar.length
      if (historicalTotal > 0) {
        const rate = Math.round((historicalWins / historicalTotal) * 100)
        historicalContext = `Your practice has appealed CARC-${carcCode} ${historicalTotal}× — won ${historicalWins} (${rate}% win rate).`
      }
    } catch {}
  }

  if (!isAIConfigured()) {
    // Rule-based fallback
    const rates: Record<string, number> = { "197": 60, "4": 35, "50": 50, "16": 0, "11": 45, "119": 30, "96": 40 }
    const winProb = (historicalTotal > 3 ? historicalWins / historicalTotal * 100 : rates[carcCode] ?? 40)
    const effort = appealable ? 2.5 : 0.5
    const expected = (winProb / 100) * claimAmount
    const netROI = expected - effort * HOURLY_RATE
    return NextResponse.json({
      winProbability: Math.round(winProb),
      expectedValue: Math.round(expected * 100) / 100,
      effortHours: effort,
      netROI: Math.round(netROI * 100) / 100,
      recommendation: netROI > 0 && appealable ? "APPEAL" : "WRITE_OFF",
      rationale: `Based on industry benchmarks for CARC-${carcCode}.`,
      keyFactors: ["Industry average win rate applied", "No ANTHROPIC_API_KEY for deeper analysis"],
      deadline: null,
      historicalContext,
    })
  }

  const prompt = `You are a medical billing ROI analyst. Evaluate whether it is financially worth appealing this insurance denial.

Denial Details:
- CARC Code: ${carcCode}
- Reason: ${denialReason}
- Claim Amount: $${claimAmount}
- Payer: ${payerName}
- CPT Code: ${cptCode}
- Appealable: ${appealable}
- Category: ${category}
- Practice History: ${historicalContext}

Assumptions:
- Biller labor rate: $${HOURLY_RATE}/hour
- Typical appeal effort: 2-3 hours (letter + follow-up)
- Resubmit effort: 0.5-1 hour

Provide ONLY valid JSON:
{
  "winProbability": <integer 0-100 — realistic probability of winning appeal for this CARC/payer combination>,
  "effortHours": <number — realistic effort to resolve, e.g. 2.5>,
  "recommendation": <"APPEAL" | "RESUBMIT" | "WRITE_OFF" | "BILL_PATIENT">,
  "rationale": "<2 sentences explaining the recommendation with specific reasoning>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "deadline": "<deadline note, e.g. '180 days from denial date' or null if not appealable>"
}

For CARC-16 (missing info): recommend RESUBMIT, winProbability 0 (no appeal needed).
For CARC-197 with retro auth possible: 55-70% win rate.
For CARC-4 (not covered): 25-40%, parity argument helps.
For CARC-50 (medical necessity): 45-60% with good clinical notes.`

  try {
    const text = await aiComplete({ max_tokens: 512, messages: [{ role: "user", content: prompt }] })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")
    const result = JSON.parse(match[0])

    const expectedValue = (result.winProbability / 100) * claimAmount
    const netROI = expectedValue - result.effortHours * HOURLY_RATE

    return NextResponse.json({
      ...result,
      expectedValue: Math.round(expectedValue * 100) / 100,
      netROI: Math.round(netROI * 100) / 100,
      historicalContext,
    } as ROIResult)
  } catch (err) {
    console.error("[denials/roi] failed:", err)
    const msg = err instanceof Error ? err.message : "ROI analysis failed"
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
