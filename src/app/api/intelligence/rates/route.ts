import { NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSession } from "@/lib/auth"

interface RateRow {
  payer: string
  cptCode: string
  claims: number
  avgBilled: number
  avgPaid: number
  collectionRate: number
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const paidClaims = await prisma.claim.findMany({
    where: {
      practiceId: session.practiceId,
      claimStatus: "PAID",
      paidAmount: { not: null },
    },
    select: {
      totalCharge: true,
      paidAmount: true,
      patient: { select: { payerName: true } },
      lineItems: { select: { cptCode: true, chargeAmount: true } },
    },
  })

  // Aggregate per payer × CPT
  const map: Record<string, { billedSum: number; paidSum: number; count: number }> = {}

  for (const claim of paidClaims) {
    const payer = claim.patient.payerName
    const paidTotal = Number(claim.paidAmount ?? 0)
    const billedTotal = Number(claim.totalCharge)
    // Distribute paid amount proportionally across line items by charge
    for (const li of claim.lineItems) {
      const key = `${payer}::${li.cptCode}`
      if (!map[key]) map[key] = { billedSum: 0, paidSum: 0, count: 0 }
      const liCharge = Number(li.chargeAmount)
      const liPaidShare = billedTotal > 0 ? (liCharge / billedTotal) * paidTotal : 0
      map[key].billedSum += liCharge
      map[key].paidSum += liPaidShare
      map[key].count++
    }
  }

  const rates: RateRow[] = Object.entries(map)
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => {
      const [payer, cptCode] = key.split("::")
      const avgBilled = Math.round((v.billedSum / v.count) * 100) / 100
      const avgPaid = Math.round((v.paidSum / v.count) * 100) / 100
      const collectionRate = Math.round((avgPaid / avgBilled) * 100)
      return { payer, cptCode, claims: v.count, avgBilled, avgPaid, collectionRate }
    })
    .sort((a, b) => a.collectionRate - b.collectionRate)

  // Expected collection rates by CPT (industry benchmarks)
  const BENCHMARKS: Record<string, number> = {
    "90791": 72, "90837": 70, "90834": 70, "90832": 70,
    "90847": 68, "90846": 68, "90853": 65, "90839": 75,
  }

  const underpaid = rates.filter((r) => {
    const benchmark = BENCHMARKS[r.cptCode] ?? 70
    return r.collectionRate < benchmark - 5
  })

  let insights: string[] = []

  if (isAIConfigured() && rates.length > 0) {
    try {
      const prompt = `You are a medical billing analyst reviewing a mental health practice's payer rate performance.

Rate data (per payer × CPT code):
${rates.slice(0, 15).map((r) => `  ${r.payer} / CPT ${r.cptCode}: ${r.claims} claims, avg billed $${r.avgBilled}, avg paid $${r.avgPaid} (${r.collectionRate}% collection rate)`).join("\n")}

Industry benchmarks: 90837/90834/90832/90791 ≈ 70-75% collection rate for commercial payers.

Provide 2-3 specific, actionable insights. Respond ONLY with valid JSON:
["<insight 1>", "<insight 2>", "<insight 3>"]

Be specific: name payers, CPT codes, and dollar amounts. Focus on: underpayment, renegotiation opportunities, claim patterns.`

      const raw = await aiComplete({ max_tokens: 512, messages: [{ role: "user", content: prompt }] })
      const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
      const match = stripped.match(/\[[\s\S]*\]/)
      if (match) insights = JSON.parse(match[0])
    } catch (err) {
      console.error("[intelligence/rates] failed:", err)
    }
  }

  return NextResponse.json({ rates, underpaid, insights })
}
