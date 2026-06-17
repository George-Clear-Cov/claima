import { NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

  const [paidClaims, submittedClaims, newDenials, pendingAppeals, agingClaims, timelyRisks, overdueStatements] =
    await Promise.all([
      prisma.claim.findMany({
        where: { practiceId: session.practiceId, paidAt: { gte: yesterday } },
        select: { paidAmount: true, patient: { select: { payerName: true } } },
      }),
      prisma.claim.findMany({
        where: { practiceId: session.practiceId, submittedAt: { gte: yesterday } },
        select: { totalCharge: true },
      }),
      prisma.denial.findMany({
        where: { claim: { practiceId: session.practiceId }, createdAt: { gte: twoDaysAgo } },
        select: {
          carcCode: true,
          claim: { select: { totalCharge: true, patient: { select: { payerName: true } } } },
        },
      }),
      prisma.denial.findMany({
        where: {
          claim: { practiceId: session.practiceId },
          appealStatus: { in: ["PENDING", "IN_PROGRESS"] },
        },
        select: { appealStatus: true, claim: { select: { totalCharge: true } } },
      }),
      prisma.claim.findMany({
        where: {
          practiceId: session.practiceId,
          claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
          submittedAt: { lt: thirtyDaysAgo, gte: ninetyDaysAgo },
        },
        select: { totalCharge: true, submittedAt: true, patient: { select: { payerName: true } } },
      }),
      prisma.claim.findMany({
        where: {
          practiceId: session.practiceId,
          claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
          submittedAt: { lt: ninetyDaysAgo },
        },
        select: { totalCharge: true, submittedAt: true, patient: { select: { payerName: true } } },
      }),
      prisma.patientStatement.findMany({
        where: {
          patient: { practiceId: session.practiceId },
          statementStatus: { notIn: ["PAID", "WRITE_OFF"] },
          dueDate: { lt: now },
        },
        select: { balanceDue: true },
      }),
    ])

  const data = {
    date: now.toISOString().slice(0, 10),
    paidYesterday: paidClaims.length,
    totalPaidAmount: paidClaims.reduce((s, c) => s + Number(c.paidAmount ?? 0), 0),
    submittedYesterday: submittedClaims.length,
    newDenials: newDenials.length,
    newDenialsAmount: newDenials.reduce((s, d) => s + Number(d.claim.totalCharge), 0),
    newDenialsDetail: newDenials.slice(0, 3).map((d) => `CARC-${d.carcCode} (${d.claim.patient.payerName})`),
    appealsNeeding: pendingAppeals.filter((a) => a.appealStatus === "PENDING").length,
    openAppeals: pendingAppeals.length,
    appealsAmount: pendingAppeals.reduce((s, d) => s + Number(d.claim.totalCharge), 0),
    agingClaims: agingClaims.length,
    agingAmount: agingClaims.reduce((s, c) => s + Number(c.totalCharge), 0),
    timelyRisks: timelyRisks.length,
    timelyRisksAmount: timelyRisks.reduce((s, c) => s + Number(c.totalCharge), 0),
    overdueStatements: overdueStatements.length,
    overdueAmount: overdueStatements.reduce((s, s2) => s + Number(s2.balanceDue), 0),
  }

  if (!isAIConfigured()) {
    return NextResponse.json({
      ...data,
      headline: `${data.paidYesterday} payments received · ${data.newDenials} new denials · ${data.timelyRisks} timely filing risks`,
      narrative: null,
      priorities: [],
    })
  }

  const prompt = `Generate a morning billing briefing for a mental health practice manager.

Date: ${data.date}
Payments posted yesterday: ${data.paidYesterday} ($${data.totalPaidAmount.toFixed(2)})
Claims submitted yesterday: ${data.submittedYesterday}
New denials (last 48h): ${data.newDenials} ($${data.newDenialsAmount.toFixed(2)}) — ${data.newDenialsDetail.join(", ") || "none"}
Appeals needing action (PENDING): ${data.appealsNeeding} of ${data.openAppeals} total ($${data.appealsAmount.toFixed(2)})
Claims pending 30–90 days: ${data.agingClaims} ($${data.agingAmount.toFixed(2)})
Timely filing risks (90+ days, still pending): ${data.timelyRisks} ($${data.timelyRisksAmount.toFixed(2)})
Overdue patient balances: ${data.overdueStatements} ($${data.overdueAmount.toFixed(2)})

Respond ONLY with valid JSON:
{
  "headline": "<1 sentence — the single most important thing to know today>",
  "narrative": "<2-3 sentences, conversational, as if a smart billing manager is briefing a clinician — specific numbers, no filler>",
  "priorities": [
    {
      "rank": 1,
      "action": "<specific action to take today>",
      "reason": "<why this matters, with numbers>",
      "urgency": "immediate",
      "dollars": <number>
    }
  ]
}

Rules:
- 3–5 priorities
- urgency: "immediate" (same-day risk), "today" (should do today), "this_week" (this week)
- Order by urgency then dollars
- If everything is fine, say so warmly: "Practice is in great shape — no urgent items today"
- Do NOT use "delinquent" or collection-agency language`

  try {
    const raw = await aiComplete({ max_tokens: 768, messages: [{ role: "user", content: prompt }] })
    const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")
    const ai = JSON.parse(match[0])
    return NextResponse.json({ ...data, ...ai })
  } catch (err) {
    console.error("[briefing] failed:", err)
    return NextResponse.json({
      ...data,
      headline: `${data.paidYesterday} payments · ${data.newDenials} new denials · ${data.timelyRisks} timely filing risks`,
      narrative: null,
      priorities: [],
    })
  }
}
