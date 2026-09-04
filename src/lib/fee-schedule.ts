/**
 * Fee schedule / charge master + the patient cost-estimate engine.
 *
 * This is the authoritative source of EXPECTED CHARGES a compliant Good Faith
 * Estimate (No Surprises Act) must cite. `estimateCost` runs the same waterfall the
 * 835 reports after the fact — deductible first, then coinsurance on the remaining
 * allowed, plus any flat copay — but computed FORWARD, before the visit.
 *
 * PHI note: this module handles cost data + a plan's cost-share, not clinical PHI.
 * Callers must still scope every query to the session's practiceId.
 */

import type { CoverageDetail } from "./eligibility"

const r2 = (n: number) => Math.round(n * 100) / 100

export interface ExpectedCharge {
  cptCode: string
  modifier: string | null
  expectedCharge: number
  expectedAllowed: number | null
  source: string
}

/**
 * Active expected charge for a CPT. Prefers a payer-specific row over the practice
 * default (self-pay list price), and the most recent effective date within each.
 */
export async function getExpectedCharge(
  practiceId: string,
  cptCode: string,
  opts: { modifier?: string | null; payerId?: string | null } = {},
): Promise<ExpectedCharge | null> {
  const { prisma } = await import("@/lib/prisma")
  const rows = await prisma.feeScheduleEntry.findMany({
    where: {
      practiceId,
      cptCode,
      active: true,
      ...(opts.modifier !== undefined ? { modifier: opts.modifier } : {}),
      OR: [{ payerId: opts.payerId ?? null }, { payerId: null }],
    },
    // payer-specific (non-null) first, then newest effective date.
    orderBy: [{ payerId: "desc" }, { effectiveDate: "desc" }],
  })
  const row = rows[0]
  if (!row) return null
  return {
    cptCode: row.cptCode,
    modifier: row.modifier,
    expectedCharge: Number(row.expectedCharge),
    expectedAllowed: row.expectedAllowed != null ? Number(row.expectedAllowed) : null,
    source: row.source,
  }
}

export interface EstimateLine {
  cptCode: string
  units: number
  expectedCharge: number
  expectedAllowed: number
  planDiscount: number // charge − allowed (informational)
  patientEstimate: number
  appliedToDeductible: number
  coinsurance: number
  copay: number
}

export interface CostEstimate {
  lines: EstimateLine[]
  totalCharge: number
  totalAllowed: number
  totalPatientEstimate: number
  deductibleRemainingAfter: number
  missingFeeSchedule: string[] // CPTs with no fee-schedule entry — estimate is incomplete
  disclaimer: string
}

/** Statutory-style disclaimer for a Good Faith Estimate. Legal review before production use. */
export const GFE_DISCLAIMER =
  "This is a good faith estimate of the expected charges for your care. It is not a bill and is " +
  "not a contract. Actual charges may differ based on the services actually provided, your plan's " +
  "final claim adjudication, and any complications or unforeseen circumstances. You have the right " +
  "to dispute a bill that is at least $400 more than this estimate."

/**
 * Estimate patient responsibility for a set of CPT lines against a plan's cost-share.
 * Pass coverage = null for uninsured / self-pay (patient owes the full expected charge).
 */
export async function estimateCost(
  practiceId: string,
  items: Array<{ cptCode: string; modifier?: string | null; units?: number }>,
  coverage: CoverageDetail | null,
  payerId?: string | null,
): Promise<CostEstimate> {
  let deductibleLeft = coverage?.deductibleRemaining ?? 0
  const coinsRate = (coverage?.coinsurance ?? 0) / 100
  const flatCopay = coverage?.copay ?? 0

  const lines: EstimateLine[] = []
  const missingFeeSchedule: string[] = []

  for (const item of items) {
    const units = item.units ?? 1
    const fee = await getExpectedCharge(practiceId, item.cptCode, {
      modifier: item.modifier ?? null,
      payerId,
    })
    if (!fee) missingFeeSchedule.push(item.cptCode)

    const expectedCharge = r2((fee?.expectedCharge ?? 0) * units)
    // With no observed allowed amount, fall back to the charge (conservative for the patient).
    const expectedAllowed = r2((fee?.expectedAllowed ?? fee?.expectedCharge ?? 0) * units)

    if (!coverage) {
      lines.push({
        cptCode: item.cptCode, units, expectedCharge, expectedAllowed: expectedCharge,
        planDiscount: 0, patientEstimate: expectedCharge,
        appliedToDeductible: expectedCharge, coinsurance: 0, copay: 0,
      })
      continue
    }

    const toDeductible = r2(Math.min(deductibleLeft, expectedAllowed))
    deductibleLeft = r2(deductibleLeft - toDeductible)
    const afterDeductible = expectedAllowed - toDeductible
    const coins = r2(afterDeductible * coinsRate)
    const patientEstimate = r2(toDeductible + coins + flatCopay)

    lines.push({
      cptCode: item.cptCode, units, expectedCharge, expectedAllowed,
      planDiscount: r2(expectedCharge - expectedAllowed),
      patientEstimate, appliedToDeductible: toDeductible, coinsurance: coins, copay: flatCopay,
    })
  }

  const sum = (f: (l: EstimateLine) => number) => r2(lines.reduce((s, l) => s + f(l), 0))
  return {
    lines,
    totalCharge: sum((l) => l.expectedCharge),
    totalAllowed: sum((l) => l.expectedAllowed),
    totalPatientEstimate: sum((l) => l.patientEstimate),
    deductibleRemainingAfter: deductibleLeft,
    missingFeeSchedule,
    disclaimer: GFE_DISCLAIMER,
  }
}

/**
 * Seed DERIVED fee-schedule rows from history: average billed charge per CPT (from
 * claim lines) and average allowed per CPT (from persisted remittance lines). A
 * practice can override any entry with a MANUAL row, which wins in getExpectedCharge.
 * Returns the number of derived entries written.
 */
export async function seedFeeScheduleFromHistory(practiceId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma")

  const billed = await prisma.claimLine.groupBy({
    by: ["cptCode"],
    where: { claim: { practiceId } },
    _avg: { chargeAmount: true },
  })
  const allowed = await prisma.remittanceLine.groupBy({
    by: ["cptCode"],
    where: { practiceId, allowedAmount: { not: null } },
    _avg: { allowedAmount: true },
  })
  const allowedByCpt = new Map(
    allowed.map((a) => [a.cptCode, a._avg.allowedAmount != null ? Number(a._avg.allowedAmount) : null]),
  )

  const effectiveDate = new Date()
  const data = billed
    .filter((b) => b._avg.chargeAmount != null && Number(b._avg.chargeAmount) > 0)
    .map((b) => ({
      practiceId,
      cptCode: b.cptCode,
      modifier: null,
      payerId: null,
      expectedCharge: r2(Number(b._avg.chargeAmount)),
      expectedAllowed: allowedByCpt.get(b.cptCode) ?? null,
      source: "DERIVED" as const,
      effectiveDate,
    }))

  await prisma.$transaction([
    prisma.feeScheduleEntry.deleteMany({ where: { practiceId, source: "DERIVED" } }),
    prisma.feeScheduleEntry.createMany({ data }),
  ])
  return data.length
}
