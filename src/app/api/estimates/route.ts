import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"
import { estimateCost } from "@/lib/fee-schedule"
import type { CoverageDetail } from "@/lib/eligibility"

// Good Faith Estimate (No Surprises Act). Generates the patient-cost estimate from the
// fee schedule + the patient's plan cost-share, then persists an immutable snapshot for
// the required retention period. Staff-only; every query is scoped to the session practice.
const schema = z.object({
  patientId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  payerId: z.string().optional(),
  payerName: z.string().optional(),
  diagnosisCodes: z.array(z.string()).default([]),
  services: z
    .array(
      z.object({
        cptCode: z.string(),
        modifier: z.string().optional(),
        units: z.number().int().positive().optional(),
      }),
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const input = schema.parse(await req.json())
    const { prisma } = await import("@/lib/prisma")

    // Cost-share comes from the patient's most recent active eligibility check; absent
    // that, treat as uninsured / self-pay (patient owes the full expected charge).
    let coverage: CoverageDetail | null = null
    let payerId = input.payerId ?? null
    let payerName = input.payerName ?? null

    if (input.patientId) {
      const elig = await prisma.eligibilityCheck.findFirst({
        where: {
          patientId: input.patientId,
          patient: { practiceId: session.practiceId },
          coverageActive: true,
        },
        orderBy: { checkedAt: "desc" },
      })
      if (elig) {
        payerId = payerId ?? elig.payerId
        payerName = payerName ?? elig.planName ?? null
        const ded = Number(elig.deductible ?? 0)
        const dedMet = Number(elig.deductibleMet ?? 0)
        const oop = Number(elig.outOfPocketMax ?? 0)
        const oopMet = Number(elig.outOfPocketMet ?? 0)
        coverage = {
          inNetwork: elig.inNetwork,
          deductible: ded,
          deductibleMet: dedMet,
          deductibleRemaining:
            elig.deductibleRemaining != null ? Number(elig.deductibleRemaining) : Math.max(ded - dedMet, 0),
          outOfPocketMax: oop,
          outOfPocketMet: oopMet,
          outOfPocketRemaining:
            elig.outOfPocketRemaining != null ? Number(elig.outOfPocketRemaining) : Math.max(oop - oopMet, 0),
          copay: Number(elig.copay ?? 0),
          coinsurance: elig.coinsurance ?? 0,
          visitLimit: elig.visitLimit,
          visitsUsed: elig.visitsUsed,
          priorAuthRequired: elig.priorAuthRequired,
          planName: elig.planName ?? "",
          groupNumber: elig.groupNumber ?? "",
          effectiveDate: elig.effectiveDate ?? "",
          terminationDate: elig.terminationDate ?? null,
        }
      }
    }

    const estimate = await estimateCost(session.practiceId, input.services, coverage, payerId)

    const gfe = await prisma.goodFaithEstimate.create({
      data: {
        practiceId: session.practiceId,
        patientId: input.patientId ?? null,
        providerId: input.providerId ?? null,
        payerId,
        payerName,
        insured: coverage != null,
        totalCharge: estimate.totalCharge,
        totalAllowed: estimate.totalAllowed,
        patientEstimate: estimate.totalPatientEstimate,
        // Immutable snapshot of exactly what was shown to the patient.
        lines: JSON.parse(JSON.stringify(estimate.lines)),
        diagnosisCodes: input.diagnosisCodes,
        disclaimer: estimate.disclaimer,
        // No Surprises Act retention is ≥6 years — informational marker.
        expiresAt: new Date(Date.now() + 6 * 365 * 86400000),
      },
    })

    logAudit({
      action: "gfe.create",
      practiceId: session.practiceId,
      userId: session.userId,
      userEmail: session.email,
      resource: "goodFaithEstimate",
      resourceId: gfe.id,
      req,
    })

    return NextResponse.json({
      id: gfe.id,
      insured: coverage != null,
      payerName,
      ...estimate,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    logError("gfe", err)
    return NextResponse.json({ error: "Estimate failed" }, { status: 500 })
  }
}
