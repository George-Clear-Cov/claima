import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { checkEligibility } from "@/lib/eligibility"

const schema = z.object({
  patientId: z.string().uuid().optional(),
  payerId: z.string(),
  memberId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  npi: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = schema.parse(body)

    const result = await checkEligibility({
      payerId: input.payerId,
      memberId: input.memberId,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob,
      npi: input.npi,
    })

    // DB write is best-effort — skip if DATABASE_URL not configured
    if (input.patientId && process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/prisma")
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
