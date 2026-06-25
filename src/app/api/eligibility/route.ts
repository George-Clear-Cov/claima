import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { checkEligibility } from "@/lib/eligibility"
import { getServiceTypeForCPT } from "@/lib/specialty"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const schema = z.object({
  patientId: z.string().uuid().optional(),
  payerId: z.string(),
  memberId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  npi: z.string(),
  cptCodes: z.array(z.string()).optional(),    // auto-computes serviceType from CPT codes
  serviceType: z.string().max(4).optional(),   // direct override from UI dropdown
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const input = schema.parse(body)

    const serviceType = input.cptCodes?.length
      ? getServiceTypeForCPT(input.cptCodes)
      : (input.serviceType ?? "98")

    const result = await checkEligibility({
      payerId: input.payerId,
      memberId: input.memberId,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob,
      npi: input.npi,
      serviceType,
    })

    if (input.patientId) {
      try {
        const { prisma } = await import("@/lib/prisma")
        const patient = await prisma.patient.findUnique({
          where: { id: input.patientId, practiceId: session.practiceId },
        })
        if (patient) {
          logAudit({ action: "eligibility.check", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "patient", resourceId: input.patientId, req })
          await prisma.eligibilityCheck.create({
            data: {
              patientId: input.patientId,
              payerId: input.payerId,
              memberId: input.memberId,
              eligible: result.eligible,
              coverageActive: result.coverageActive,
              planName: result.coverage?.planName,
              groupNumber: result.coverage?.groupNumber,
              deductible: result.coverage?.deductible,
              deductibleMet: result.coverage?.deductibleMet,
              outOfPocketMax: result.coverage?.outOfPocketMax,
              outOfPocketMet: result.coverage?.outOfPocketMet,
              copay: result.coverage?.copay,
              coinsurance: result.coverage?.coinsurance,
              visitLimit: result.coverage?.visitLimit,
              visitsUsed: result.coverage?.visitsUsed,
              priorAuthRequired: result.coverage?.priorAuthRequired ?? false,
              inNetwork: result.coverage?.inNetwork ?? false,
              effectiveDate: result.coverage?.effectiveDate,
              terminationDate: result.coverage?.terminationDate ?? null,
              rawResponse: result.rawResponse as object,
            },
          })
        }
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Eligibility check failed" }, { status: 500 })
  }
}
