import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

// Typical net payment rates by payer after contractual adjustments
const PAYER_RATES: Record<string, { insRate: number; adjRate: number }> = {
  "Aetna":                { insRate: 0.70, adjRate: 0.10 },
  "BlueCross BlueShield": { insRate: 0.75, adjRate: 0.08 },
  "United Healthcare":    { insRate: 0.72, adjRate: 0.10 },
  "Cigna":                { insRate: 0.68, adjRate: 0.12 },
  "Humana":               { insRate: 0.65, adjRate: 0.13 },
}
const DEFAULT_RATES = { insRate: 0.70, adjRate: 0.10 }

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  // Find claims that have been pending long enough for ERA to have arrived (>14 days)
  const cutoff = new Date(Date.now() - 14 * 86400000)

  const eligible = await prisma.claim.findMany({
    where: {
      practiceId: session.practiceId,
      claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
      submittedAt: { lte: cutoff },
      statement: null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, payerName: true } },
      lineItems: { select: { cptCode: true } },
    },
  })

  if (eligible.length === 0) {
    return NextResponse.json({
      processed: 0,
      message: "No claims pending long enough for ERA. Claims need 14+ days since submission.",
      results: [],
    })
  }

  const results = await Promise.all(
    eligible.map(async (claim) => {
      const totalCharge = Number(claim.totalCharge)
      const rates = PAYER_RATES[claim.patient.payerName] ?? DEFAULT_RATES
      const insurancePaid = Math.round(totalCharge * rates.insRate * 100) / 100
      const adjustments = Math.round(totalCharge * rates.adjRate * 100) / 100
      const patientOwes = Math.max(Math.round((totalCharge - insurancePaid - adjustments) * 100) / 100, 0)

      try {
        await prisma.$transaction([
          prisma.claim.update({
            where: { id: claim.id },
            data: { claimStatus: "PAID", paidAmount: insurancePaid, paidAt: new Date() },
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
              dueDate: new Date(Date.now() + 30 * 86400000),
              notes: `Auto-posted via ERA batch — ${claim.patient.payerName}`,
            },
          }),
        ])

        return {
          claimId: claim.id,
          patient: `${claim.patient.lastName}, ${claim.patient.firstName}`,
          payer: claim.patient.payerName,
          billed: totalCharge,
          insurancePaid,
          adjustments,
          patientOwes,
          status: "posted" as const,
        }
      } catch {
        return {
          claimId: claim.id,
          patient: `${claim.patient.lastName}, ${claim.patient.firstName}`,
          payer: claim.patient.payerName,
          billed: totalCharge,
          insurancePaid: 0,
          adjustments: 0,
          patientOwes: 0,
          status: "error" as const,
        }
      }
    })
  )

  const posted = results.filter((r) => r.status === "posted")
  return NextResponse.json({
    processed: posted.length,
    total: eligible.length,
    totalInsurancePaid: posted.reduce((s, r) => s + r.insurancePaid, 0),
    totalPatientStatements: posted.reduce((s, r) => s + r.patientOwes, 0),
    results,
  })
}
