import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generate837P } from "@/lib/837p"
import { submitClaim } from "@/lib/claimmd"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const lineItemSchema = z.object({
  cptCode: z.string().min(5).max(5),
  icd10Codes: z.array(z.string()).min(1).max(12),
  modifier: z.string().optional(),
  units: z.number().int().min(1),
  chargeAmount: z.number().positive(),
  description: z.string().optional(),
})

const submitClaimSchema = z.object({
  providerId: z.string().uuid(),
  patientId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineItems: z.array(lineItemSchema).min(1),
  placeOfService: z.string().max(2).optional(),
  referringProviderNpi: z.string().max(10).optional(),
  priorAuthId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const input = submitClaimSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")
    const [practice, provider, patient] = await Promise.all([
      prisma.practice.findUniqueOrThrow({ where: { id: session.practiceId } }),
      prisma.provider.findUniqueOrThrow({ where: { id: input.providerId, practiceId: session.practiceId } }),
      prisma.patient.findUniqueOrThrow({ where: { id: input.patientId, practiceId: session.practiceId } }),
    ])

    // Look up prior auth number if provided
    let authNumber: string | undefined
    if (input.priorAuthId) {
      const pa = await prisma.priorAuthorization.findUnique({
        where: { id: input.priorAuthId, practiceId: session.practiceId },
        select: { authNumber: true },
      })
      authNumber = pa?.authNumber ?? undefined
    }

    const totalCharge = input.lineItems.reduce(
      (sum, l) => sum + l.chargeAmount * l.units,
      0
    )

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
        relationshipToSubscriber: patient.relationshipToSubscriber,
      },
      serviceDate: new Date(input.serviceDate),
      lineItems: input.lineItems,
      totalCharge,
      placeOfService: input.placeOfService,
      referringProviderNpi: input.referringProviderNpi,
      authNumber,
    })

    const clearinghouseResult = await submitClaim(edi)

    logAudit({ action: "claim.create", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "claim", req })
    const claim = await prisma.claim.create({
      data: {
        practiceId: session.practiceId,
        providerId: input.providerId,
        patientId: input.patientId,
        serviceDate: new Date(input.serviceDate),
        totalCharge,
        placeOfService: input.placeOfService ?? "11",
        referringProviderNpi: input.referringProviderNpi,
        priorAuthId: input.priorAuthId,
        claimStatus: clearinghouseResult.status === "accepted" ? "SUBMITTED" : "REJECTED",
        stediClaimId: clearinghouseResult.claimId || null,
        stediResponse: clearinghouseResult.raw as object,
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
      clearinghouseStatus: clearinghouseResult.status,
      errors: clearinghouseResult.errors,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  logAudit({ action: "claim.list", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "claim", req })
  const claims = await prisma.claim.findMany({
    where: { practiceId: session.practiceId },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      provider: { select: { firstName: true, lastName: true } },
      lineItems: true,
      statement: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(claims)
}
