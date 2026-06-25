import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { generateAppealLetter } from "@/lib/appeal-generator"

const PAYER_RATES: Record<string, { insRate: number; adjRate: number }> = {
  "Aetna":                { insRate: 0.70, adjRate: 0.10 },
  "BlueCross BlueShield": { insRate: 0.75, adjRate: 0.08 },
  "United Healthcare":    { insRate: 0.72, adjRate: 0.10 },
  "Cigna":                { insRate: 0.68, adjRate: 0.12 },
  "Humana":               { insRate: 0.65, adjRate: 0.13 },
}
const DEFAULT_RATES = { insRate: 0.70, adjRate: 0.10 }

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")
  logAudit({ action: "agent.run", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })
  const startTime = Date.now()
  const now = new Date()

  // ── 1. ERA batch posting ──────────────────────────────────────────────────
  const eraCutoff = new Date(now.getTime() - 14 * 86400000)
  const eraEligible = await prisma.claim.findMany({
    where: {
      practiceId: session.practiceId,
      claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
      submittedAt: { lte: eraCutoff },
      statement: null,
    },
    include: { patient: { select: { firstName: true, lastName: true, payerName: true } } },
  })

  const eraResults: { patient: string; payer: string; amount: number; patientOwes: number; status: string }[] = []
  for (const claim of eraEligible) {
    const totalCharge = Number(claim.totalCharge)
    const rates = PAYER_RATES[claim.patient.payerName] ?? DEFAULT_RATES
    const insurancePaid = Math.round(totalCharge * rates.insRate * 100) / 100
    const adjustments = Math.round(totalCharge * rates.adjRate * 100) / 100
    const patientOwes = Math.max(Math.round((totalCharge - insurancePaid - adjustments) * 100) / 100, 0)
    try {
      await prisma.$transaction([
        prisma.claim.update({
          where: { id: claim.id },
          data: { claimStatus: "PAID", paidAmount: insurancePaid, paidAt: now },
        }),
        prisma.patientStatement.create({
          data: {
            patientId: claim.patientId,
            claimId: claim.id,
            totalCharge,
            insurancePaid,
            adjustments,
            patientOwes,
            balanceDue: patientOwes,
            statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
            dueDate: new Date(now.getTime() + 30 * 86400000),
            notes: `Auto-posted by billing agent — ${claim.patient.payerName}`,
          },
        }),
      ])
      eraResults.push({
        patient: `${claim.patient.lastName}, ${claim.patient.firstName}`,
        payer: claim.patient.payerName,
        amount: insurancePaid,
        patientOwes,
        status: "posted",
      })
    } catch {
      eraResults.push({
        patient: `${claim.patient.lastName}, ${claim.patient.firstName}`,
        payer: claim.patient.payerName,
        amount: 0,
        patientOwes: 0,
        status: "error",
      })
    }
  }

  // ── 2. Denial auto-processing ─────────────────────────────────────────────
  const pendingDenials = await prisma.denial.findMany({
    where: {
      claim: { practiceId: session.practiceId },
      appealStatus: "PENDING",
      appealLetter: null,
    },
    include: {
      claim: {
        include: {
          patient: true,
          provider: true,
          practice: true,
          lineItems: true,
        },
      },
    },
  })

  const appealResults: { patient: string; carcCode: string; action: string; letterGenerated: boolean }[] = []
  for (const denial of pendingDenials) {
    try {
      if (!denial.appealable) {
        appealResults.push({
          patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
          carcCode: denial.carcCode,
          action: denial.category,
          letterGenerated: false,
        })
        continue
      }
      const letter = await generateAppealLetter({
        patientName: `${denial.claim.patient.firstName} ${denial.claim.patient.lastName}`,
        patientDob: denial.claim.patient.dob.toISOString().slice(0, 10),
        memberId: denial.claim.patient.memberId,
        payerName: denial.claim.patient.payerName,
        claimId: denial.claimId,
        serviceDate: denial.claim.serviceDate.toISOString().slice(0, 10),
        cptCodes: denial.claim.lineItems.map((l) => l.cptCode),
        icd10Codes: denial.claim.lineItems.flatMap((l) => l.icd10Codes as string[]),
        totalCharge: Number(denial.claim.totalCharge),
        carcCode: denial.carcCode,
        denialReason: denial.denialReason,
        providerName: `${denial.claim.provider.firstName} ${denial.claim.provider.lastName}`,
        providerNpi: denial.claim.provider.npi,
        practiceName: denial.claim.practice.name,
      })
      await prisma.denial.update({
        where: { id: denial.id },
        data: { appealLetter: letter, appealStatus: "IN_PROGRESS" },
      })
      appealResults.push({
        patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
        carcCode: denial.carcCode,
        action: "APPEAL",
        letterGenerated: true,
      })
    } catch {
      appealResults.push({
        patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
        carcCode: denial.carcCode,
        action: "ERROR",
        letterGenerated: false,
      })
    }
  }

  // ── 3. Timely filing & aging scan ─────────────────────────────────────────
  const tfCutoff = new Date(now.getTime() - 90 * 86400000)
  const agingCutoff = new Date(now.getTime() - 45 * 86400000)
  const [timelyRisks, agingClaims] = await Promise.all([
    prisma.claim.findMany({
      where: {
        practiceId: session.practiceId,
        claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
        submittedAt: { lt: tfCutoff },
      },
      select: {
        id: true, totalCharge: true, submittedAt: true,
        patient: { select: { firstName: true, lastName: true, payerName: true } },
      },
    }),
    prisma.claim.findMany({
      where: {
        practiceId: session.practiceId,
        claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
        submittedAt: { lt: agingCutoff, gte: tfCutoff },
      },
      select: {
        id: true, totalCharge: true, submittedAt: true,
        patient: { select: { firstName: true, lastName: true, payerName: true } },
      },
    }),
  ])

  // ── 4. AI narrative ───────────────────────────────────────────────────────
  const summary = {
    erasPosted: eraResults.filter((r) => r.status === "posted").length,
    erasAmount: eraResults.filter((r) => r.status === "posted").reduce((s, r) => s + r.amount, 0),
    appealsGenerated: appealResults.filter((r) => r.letterGenerated).length,
    appealsAmount: pendingDenials
      .filter((_, i) => appealResults[i]?.letterGenerated)
      .reduce((s, d) => s + Number(d.claim.totalCharge), 0),
    timelyRisks: timelyRisks.length,
    timelyAmount: timelyRisks.reduce((s, c) => s + Number(c.totalCharge), 0),
    agingClaims: agingClaims.length,
    agingAmount: agingClaims.reduce((s, c) => s + Number(c.totalCharge), 0),
  }

  let narrative = `Agent ran: posted ${summary.erasPosted} ERAs ($${summary.erasAmount.toFixed(2)}), drafted ${summary.appealsGenerated} appeal letters.`
  let nextActions: string[] = []

  if (isAIConfigured() && (summary.timelyRisks > 0 || summary.agingClaims > 0 || summary.erasPosted > 0)) {
    try {
      const prompt = `You are an autonomous billing agent. Summarize what you just did and what still needs human attention.

Actions completed:
- ERA payments posted: ${summary.erasPosted} claims, $${summary.erasAmount.toFixed(2)} insurance payments recorded
- Appeal letters drafted: ${summary.appealsGenerated} for pending denials ($${summary.appealsAmount.toFixed(2)})

Items requiring human review:
- Timely filing at risk: ${summary.timelyRisks} claims >90 days old ($${summary.timelyAmount.toFixed(2)}) — may lose billing right
- Aging claims (45–90 days): ${summary.agingClaims} claims ($${summary.agingAmount.toFixed(2)}) — follow up with payers

Provide ONLY valid JSON:
{
  "narrative": "<2 sentences summarizing what was automated and what was saved>",
  "nextActions": ["<human action 1>", "<human action 2>", "<human action 3>"]
}

nextActions should be specific and ordered by urgency. Max 4 items.`

      const raw = await aiComplete({ max_tokens: 512, messages: [{ role: "user", content: prompt }] })
      const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
      const match = stripped.match(/\{[\s\S]*\}/)
      if (match) {
        const ai = JSON.parse(match[0])
        narrative = ai.narrative ?? narrative
        nextActions = ai.nextActions ?? []
      }
    } catch (err) {
      console.error("[agent/run] narrative failed:", err)
    }
  }

  return NextResponse.json({
    runAt: now.toISOString(),
    durationMs: Date.now() - startTime,
    actions: summary,
    eraResults: eraResults.filter((r) => r.status === "posted"),
    appealResults: appealResults.filter((r) => r.letterGenerated),
    timelyRisks: timelyRisks.map((c) => ({
      patient: `${c.patient.lastName}, ${c.patient.firstName}`,
      payer: c.patient.payerName,
      amount: Number(c.totalCharge),
      daysOld: Math.floor((now.getTime() - new Date(c.submittedAt!).getTime()) / 86400000),
    })),
    agingClaims: agingClaims.map((c) => ({
      patient: `${c.patient.lastName}, ${c.patient.firstName}`,
      payer: c.patient.payerName,
      amount: Number(c.totalCharge),
      daysOld: Math.floor((now.getTime() - new Date(c.submittedAt!).getTime()) / 86400000),
    })),
    narrative,
    nextActions,
    automatedValue: summary.erasAmount + summary.appealsAmount,
  })
}
