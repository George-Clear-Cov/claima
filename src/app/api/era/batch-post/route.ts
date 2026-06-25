import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { isClaimMdConfigured, fetchAvailableERAs, fetchERAById } from "@/lib/claimmd"

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

  logAudit({ action: "era.batch_post", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  // ── Live mode: fetch real ERAs from Claim.MD ─────────────────────────────
  if (isClaimMdConfigured()) {
    return await postRealERAs(req, session.practiceId, session.email, prisma)
  }

  // ── Mock mode: use age-based payer rates ─────────────────────────────────
  return await postMockERAs(session.practiceId, session.email, prisma)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postRealERAs(_req: NextRequest, practiceId: string, adminEmail: string, prisma: any) {
  const eraList = await fetchAvailableERAs()

  if (eraList.length === 0) {
    return NextResponse.json({ processed: 0, message: "No ERAs available from Claim.MD", results: [], mode: "live" })
  }

  // Load all unmatched, submittted/accepted claims for this practice
  const pendingClaims = await prisma.claim.findMany({
    where: {
      practiceId,
      claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
      statement: null,
      era: null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, payerName: true } },
    },
  })

  const results: Array<{
    eraId: string
    claimId: string | null
    matched: boolean
    matchType: "exact" | "fuzzy" | "unmatched"
    insurancePaid: number
    status: "posted" | "pending_review" | "error"
  }> = []

  for (const eraEntry of eraList) {
    const eraDetail = await fetchERAById(eraEntry.era_id)
    if (!eraDetail) continue

    for (const line of eraDetail.claims) {
      // 1. Exact match by clearinghouse claim ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let matched = pendingClaims.find((c: any) => c.stediClaimId === line.claim_id)
      let matchType: "exact" | "fuzzy" | "unmatched" = matched ? "exact" : "unmatched"

      // 2. Fuzzy match: patient name + service date (within 2 days) + charge (within $1)
      if (!matched) {
        const lineDate = new Date(line.service_date).getTime()
        const lineCharge = line.billed_amount
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matched = pendingClaims.find((c: any) => {
          const nameMatch =
            c.patient.firstName.toLowerCase() === line.patient_first.toLowerCase() &&
            c.patient.lastName.toLowerCase() === line.patient_last.toLowerCase()
          const dateMatch = Math.abs(c.serviceDate.getTime() - lineDate) <= 2 * 86400000
          const chargeMatch = Math.abs(Number(c.totalCharge) - lineCharge) <= 1
          return nameMatch && dateMatch && chargeMatch
        })
        if (matched) matchType = "fuzzy"
      }

      const eraRecord = {
        id: `era_${eraEntry.era_id}_${line.claim_id || Date.now()}`,
        practiceId,
        claimId: matched?.id ?? null,
        claimMdEraId: eraEntry.era_id,
        checkNumber: eraEntry.check_number || null,
        payerId: eraEntry.payer_id,
        payerName: eraEntry.payer_name,
        claimMdClaimId: line.claim_id || null,
        patientFirstName: line.patient_first || null,
        patientLastName: line.patient_last || null,
        serviceDate: line.service_date ? new Date(line.service_date) : null,
        chargeAmount: line.billed_amount,
        insurancePaid: line.paid_amount,
        adjustments: line.adjustment_amount,
        patientResponsibility: line.patient_responsibility,
        carcCodes: line.carc_codes ?? [],
        rawData: line as object,
        matchedAt: matched ? new Date() : null,
        processedAt: matched ? new Date() : null,
      }

      try {
        if (matched) {
          const patientOwes = Math.max(
            Math.round((line.billed_amount - line.paid_amount - line.adjustment_amount) * 100) / 100,
            0
          )
          await prisma.$transaction([
            prisma.eRA.create({ data: eraRecord }),
            prisma.claim.update({
              where: { id: matched.id },
              data: { claimStatus: "PAID", paidAmount: line.paid_amount, paidAt: new Date() },
            }),
            prisma.patientStatement.create({
              data: {
                patientId: matched.patientId,
                claimId: matched.id,
                totalCharge: line.billed_amount,
                insurancePaid: line.paid_amount,
                adjustments: line.adjustment_amount,
                patientOwes,
                balanceDue: patientOwes,
                statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
                dueDate: new Date(Date.now() + 30 * 86400000),
                notes: `ERA posted — ${eraEntry.payer_name} check #${eraEntry.check_number} (${matchType} match)`,
              },
            }),
          ])
          results.push({ eraId: eraEntry.era_id, claimId: matched.id, matched: true, matchType, insurancePaid: line.paid_amount, status: "posted" })
        } else {
          // Store for manual review — no claim matched
          await prisma.eRA.create({ data: eraRecord })
          results.push({ eraId: eraEntry.era_id, claimId: null, matched: false, matchType: "unmatched", insurancePaid: line.paid_amount, status: "pending_review" })
        }
      } catch {
        results.push({ eraId: eraEntry.era_id, claimId: matched?.id ?? null, matched: false, matchType, insurancePaid: line.paid_amount, status: "error" })
      }
    }
  }

  const posted = results.filter((r) => r.status === "posted")
  const unmatched = results.filter((r) => r.status === "pending_review")
  const totalInsurancePaid = posted.reduce((s, r) => s + r.insurancePaid, 0)

  if (posted.length > 0 && adminEmail) {
    void sendEmail({
      to: adminEmail,
      subject: `ERA posted: ${posted.length} claim${posted.length === 1 ? "" : "s"} — $${totalInsurancePaid.toFixed(2)} received`,
      html: `<p>ERA batch post complete (live Claim.MD data).</p>
<ul>
  <li><strong>Claims matched and posted:</strong> ${posted.length}</li>
  <li><strong>Insurance payments recorded:</strong> $${totalInsurancePaid.toFixed(2)}</li>
  ${unmatched.length > 0 ? `<li><strong>Unmatched ERAs for review:</strong> ${unmatched.length}</li>` : ""}
</ul>`,
    }).catch((e) => console.error("[email] ERA notification failed:", e))
  }

  return NextResponse.json({
    processed: posted.length,
    unmatched: unmatched.length,
    total: results.length,
    totalInsurancePaid,
    results,
    mode: "live",
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postMockERAs(practiceId: string, adminEmail: string, prisma: any) {
  const cutoff = new Date(Date.now() - 14 * 86400000)

  const eligible = await prisma.claim.findMany({
    where: {
      practiceId,
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
      message: "No claims pending 14+ days. Add CLAIMMD_ACCOUNT_KEY + CLAIMMD_API_KEY to enable real ERA retrieval.",
      results: [],
      mode: "mock",
    })
  }

  const results = await Promise.all(
    eligible.map(async (claim: { id: string; patientId: string; totalCharge: number | string; patient: { firstName: string; lastName: string; payerName: string } }) => {
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
              notes: `Auto-posted via ERA batch (mock) — ${claim.patient.payerName}`,
            },
          }),
        ])
        return { claimId: claim.id, patient: `${claim.patient.lastName}, ${claim.patient.firstName}`, payer: claim.patient.payerName, billed: totalCharge, insurancePaid, adjustments, patientOwes, status: "posted" as const }
      } catch {
        return { claimId: claim.id, patient: `${claim.patient.lastName}, ${claim.patient.firstName}`, payer: claim.patient.payerName, billed: totalCharge, insurancePaid: 0, adjustments: 0, patientOwes: 0, status: "error" as const }
      }
    })
  )

  const posted = results.filter((r) => r.status === "posted")
  const totalInsurancePaid = posted.reduce((s, r) => s + r.insurancePaid, 0)
  const totalPatientStatements = posted.reduce((s, r) => s + r.patientOwes, 0)

  if (posted.length > 0 && adminEmail) {
    void sendEmail({
      to: adminEmail,
      subject: `ERA posted: ${posted.length} claim${posted.length === 1 ? "" : "s"} — $${totalInsurancePaid.toFixed(2)} received`,
      html: `<p>ERA batch post complete (mock mode — add Claim.MD keys for real ERA data).</p>
<ul>
  <li><strong>Claims posted:</strong> ${posted.length} of ${eligible.length}</li>
  <li><strong>Insurance payments recorded:</strong> $${totalInsurancePaid.toFixed(2)}</li>
  <li><strong>Patient balances created:</strong> $${totalPatientStatements.toFixed(2)}</li>
</ul>`,
    }).catch((e) => console.error("[email] ERA notification failed:", e))
  }

  return NextResponse.json({ processed: posted.length, total: eligible.length, totalInsurancePaid, totalPatientStatements, results, mode: "mock" })
}
