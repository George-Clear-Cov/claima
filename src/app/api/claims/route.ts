import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generate837P } from "@/lib/837p"
import { submitClaimToStedi } from "@/lib/stedi"

const lineItemSchema = z.object({
  cptCode: z.string().min(5).max(5),
  icd10Codes: z.array(z.string()).min(1).max(12),
  modifier: z.string().optional(),
  units: z.number().int().min(1),
  chargeAmount: z.number().positive(),
  description: z.string().optional(),
})

const submitClaimSchema = z.object({
  practiceId: z.string().uuid(),
  providerId: z.string().uuid(),
  patientId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineItems: z.array(lineItemSchema).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = submitClaimSchema.parse(body)

    const [practice, provider, patient] = await Promise.all([
      prisma.practice.findUniqueOrThrow({ where: { id: input.practiceId } }),
      prisma.provider.findUniqueOrThrow({ where: { id: input.providerId } }),
      prisma.patient.findUniqueOrThrow({ where: { id: input.patientId } }),
    ])

    const totalCharge = input.lineItems.reduce(
      (sum, l) => sum + l.chargeAmount * l.units,
      0
    )

    // Generate 837P EDI
    const edi = generate837P({
      practice: {
        npi: practice.npi,
        taxId: practice.taxId,
        name: practice.name,
        taxonomy: practice.taxonomy,
        addressLine1: practice.addressLine1,
        city: practice.city,
        state: practice.state,
        zip: practice.zip,
        phone: practice.phone,
      },
      provider: {
        npi: provider.npi,
        firstName: provider.firstName,
        lastName: provider.lastName,
        taxonomy: provider.taxonomy,
      },
      patient: {
        memberId: patient.memberId,
        groupNumber: patient.groupNumber ?? undefined,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
        gender: patient.gender,
        addressLine1: patient.addressLine1,
        city: patient.city,
        state: patient.state,
        zip: patient.zip,
        payerId: patient.payerId,
        payerName: patient.payerName,
      },
      serviceDate: new Date(input.serviceDate),
      lineItems: input.lineItems,
      totalCharge,
    })

    // Submit to Stedi clearinghouse
    const stediResult = await submitClaimToStedi(edi)

    // Persist claim
    const claim = await prisma.claim.create({
      data: {
        practiceId: input.practiceId,
        providerId: input.providerId,
        patientId: input.patientId,
        serviceDate: new Date(input.serviceDate),
        totalCharge,
        claimStatus: stediResult.status === "accepted" ? "SUBMITTED" : "REJECTED",
        stediClaimId: stediResult.claimId || null,
        stediResponse: stediResult.raw as object,
        submittedAt: new Date(),
        lineItems: {
          create: input.lineItems.map((l) => ({
            cptCode: l.cptCode,
            icd10Codes: l.icd10Codes,
            modifier: l.modifier,
            units: l.units,
            chargeAmount: l.chargeAmount,
            description: l.description,
          })),
        },
      },
      include: { lineItems: true, patient: true, provider: true },
    })

    return NextResponse.json({
      claim,
      stediStatus: stediResult.status,
      errors: stediResult.errors,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  const claims = await prisma.claim.findMany({
    include: {
      patient: { select: { firstName: true, lastName: true } },
      provider: { select: { firstName: true, lastName: true } },
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(claims)
}
