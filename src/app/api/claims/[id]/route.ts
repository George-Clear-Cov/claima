import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const eraSchema = z.object({
  insurancePaid: z.number().min(0),
  adjustments: z.number().min(0).default(0),
  notes: z.string().optional(),
})

// PATCH /api/claims/[id] — post ERA: mark claim as PAID and create PatientStatement
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const input = eraSchema.parse(body)

    const claim = await prisma.claim.findUniqueOrThrow({
      where: { id },
      include: { statement: { select: { id: true } } },
    })

    if (claim.statement) {
      return NextResponse.json({ error: "Statement already exists for this claim" }, { status: 409 })
    }

    const totalCharge = Number(claim.totalCharge)
    const patientOwes = Math.max(totalCharge - input.insurancePaid - input.adjustments, 0)

    const [updatedClaim, statement] = await prisma.$transaction([
      prisma.claim.update({
        where: { id },
        data: {
          claimStatus: "PAID",
          paidAmount: input.insurancePaid,
          paidAt: new Date(),
        },
      }),
      prisma.patientStatement.create({
        data: {
          patientId: claim.patientId,
          claimId: id,
          totalCharge,
          insurancePaid: input.insurancePaid,
          adjustments: input.adjustments,
          patientOwes,
          balanceDue: patientOwes,
          statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
          dueDate: new Date(Date.now() + 30 * 86400000),
          notes: input.notes,
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          claim: {
            include: {
              lineItems: true,
              provider: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ])

    return NextResponse.json({ claim: updatedClaim, statement })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
