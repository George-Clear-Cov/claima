import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getSession } from "@/lib/auth"

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const [claims, denials, statements] = await Promise.all([
    prisma.claim.findMany({
      where: { practiceId: session.practiceId },
      include: {
        patient: { select: { payerName: true, payerId: true } },
        lineItems: { select: { cptCode: true } },
        denial: { select: { appealStatus: true, carcCode: true } },
      },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId: session.practiceId } },
      select: {
        carcCode: true, appealStatus: true, category: true,
        createdAt: true, appealedAt: true,
        claim: {
          select: {
            totalCharge: true,
            paidAt: true, submittedAt: true, serviceDate: true,
            patient: { select: { payerName: true } },
            lineItems: { select: { cptCode: true } },
          },
        },
      },
    }),
    prisma.patientStatement.findMany({
      where: { patient: { practiceId: session.practiceId } },
      select: { balanceDue: true, patientPaid: true, statementStatus: true, dueDate: true },
    }),
  ])

  // ── Payer stats ───────────────────────────────────────────────────────────
  type PayerStat = {
    payer: string
    totalClaims: number
    totalBilled: number
    totalPaid: number
    denials: number
    denialRate: number
    avgDaysToPay: number | null
    pendingAmount: number
    openDenials: number
  }

  const payerMap: Record<string, {
    claims: typeof claims
    paidDays: number[]
    denialCount: number
    pendingAmount: number
    openDenials: number
  }> = {}

  for (const claim of claims) {
    const payer = claim.patient.payerName
    if (!payerMap[payer]) payerMap[payer] = { claims: [], paidDays: [], denialCount: 0, pendingAmount: 0, openDenials: 0 }
    payerMap[payer].claims.push(claim)
    if (claim.claimStatus === "DENIED") payerMap[payer].denialCount++
    if (["SUBMITTED", "ACCEPTED"].includes(claim.claimStatus)) payerMap[payer].pendingAmount += Number(claim.totalCharge)
    if (claim.claimStatus === "PAID" && claim.paidAt && claim.submittedAt) {
      const days = Math.floor((new Date(claim.paidAt).getTime() - new Date(claim.submittedAt).getTime()) / 86400000)
      if (days >= 0 && days < 365) payerMap[payer].paidDays.push(days)
    }
    if (claim.denial && ["PENDING", "IN_PROGRESS"].includes(claim.denial.appealStatus)) {
      payerMap[payer].openDenials++
    }
  }

  const payerStats: PayerStat[] = Object.entries(payerMap).map(([payer, data]) => {
    const totalBilled = data.claims.reduce((s, c) => s + Number(c.totalCharge), 0)
    const totalPaid = data.claims.filter(c => c.claimStatus === "PAID").reduce((s, c) => s + Number(c.paidAmount ?? 0), 0)
    return {
      payer,
      totalClaims: data.claims.length,
      totalBilled,
      totalPaid,
      denials: data.denialCount,
      denialRate: data.claims.length > 0 ? Math.round((data.denialCount / data.claims.length) * 100) : 0,
      avgDaysToPay: data.paidDays.length > 0 ? Math.round(data.paidDays.reduce((a, b) => a + b, 0) / data.paidDays.length) : null,
      pendingAmount: data.pendingAmount,
      openDenials: data.openDenials,
    }
  }).sort((a, b) => b.totalBilled - a.totalBilled)

  // ── CPT denial patterns ───────────────────────────────────────────────────
  const cptMap: Record<string, { total: number; denied: number }> = {}
  for (const claim of claims) {
    for (const li of claim.lineItems) {
      const cpt = li.cptCode
      if (!cptMap[cpt]) cptMap[cpt] = { total: 0, denied: 0 }
      cptMap[cpt].total++
      if (claim.claimStatus === "DENIED") cptMap[cpt].denied++
    }
  }
  const cptStats = Object.entries(cptMap)
    .map(([code, s]) => ({ code, total: s.total, denied: s.denied, denialRate: Math.round((s.denied / s.total) * 100) }))
    .filter(c => c.total >= 2)
    .sort((a, b) => b.denialRate - a.denialRate)

  // ── CARC patterns ─────────────────────────────────────────────────────────
  const carcMap: Record<string, { count: number; won: number; lost: number; amount: number }> = {}
  for (const d of denials) {
    const code = d.carcCode
    if (!carcMap[code]) carcMap[code] = { count: 0, won: 0, lost: 0, amount: 0 }
    carcMap[code].count++
    if (d.appealStatus === "WON") carcMap[code].won++
    if (d.appealStatus === "LOST") carcMap[code].lost++
    carcMap[code].amount += Number(d.claim.totalCharge)
  }

  // ── Collections ───────────────────────────────────────────────────────────
  const overdue = statements.filter(s => {
    if (["PAID", "WRITE_OFF"].includes(s.statementStatus)) return false
    if (!s.dueDate) return true
    return new Date(s.dueDate) < new Date()
  })
  const totalOverdue = overdue.reduce((s, st) => s + Number(st.balanceDue), 0)
  const collectionRate = statements.length > 0
    ? Math.round((statements.filter(s => s.statementStatus === "PAID").length / statements.length) * 100)
    : 0

  // ── AI narrative ──────────────────────────────────────────────────────────
  const summary = {
    totalClaims: claims.length,
    totalBilled: claims.reduce((s, c) => s + Number(c.totalCharge), 0),
    overallDenialRate: claims.length > 0 ? Math.round((claims.filter(c => c.claimStatus === "DENIED").length / claims.length) * 100) : 0,
    payerStats,
    cptStats: cptStats.slice(0, 5),
    carcPatterns: Object.entries(carcMap).map(([code, d]) => ({ code, ...d })).sort((a, b) => b.count - a.count).slice(0, 5),
    collectionRate,
    totalOverdue,
  }

  let insights: { title: string; detail: string; severity: "critical" | "warning" | "opportunity" | "info"; action: string }[] = []

  if (client) {
    try {
      const prompt = `You are a revenue cycle intelligence engine for a mental health practice. Generate 4-6 specific, actionable insights from this billing data.

Data:
${JSON.stringify(summary, null, 2)}

Respond ONLY with valid JSON array:
[
  {
    "title": "<5-8 word headline>",
    "detail": "<2-3 sentences with specific numbers from the data>",
    "severity": <"critical" | "warning" | "opportunity" | "info">,
    "action": "<specific next step, 1 sentence>"
  }
]

Rules:
- Reference actual numbers from the data (payer names, dollar amounts, percentages, days)
- critical = revenue loss happening now; warning = risk building; opportunity = uncaptured revenue; info = benchmark context
- Order by business impact (highest $ impact first)
- Be specific: "Aetna is paying in 47 days vs your 28-day average" not "one payer is slow"
- Include at least one opportunity (something they could do to collect more)`

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      })
      const text = message.content[0].type === "text" ? message.content[0].text : ""
      const match = text.match(/\[[\s\S]*\]/)
      if (match) insights = JSON.parse(match[0])
    } catch {}
  }

  return NextResponse.json({ payerStats, cptStats, carcPatterns: Object.entries(carcMap).map(([code, d]) => ({ code, ...d })), collectionRate, totalOverdue, totalBilled: summary.totalBilled, overallDenialRate: summary.overallDenialRate, insights })
}
