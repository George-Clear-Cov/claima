import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateAppealLetter } from "@/lib/appeal-generator"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params

    const { prisma } = await import("@/lib/prisma")
    logAudit({ action: "denial.appeal_generate", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "denial", resourceId: id, req })
    const denial = await prisma.denial.findUniqueOrThrow({
      where: { id, claim: { practiceId: session.practiceId } },
      include: {
        claim: {
          include: { patient: true, provider: true, practice: true, lineItems: true },
        },
      },
    })

    if (!denial.appealable) {
      return NextResponse.json({ error: "This denial is not appealable" }, { status: 400 })
    }

    const { claim } = denial
    const cptCodes = claim.lineItems.map((l) => l.cptCode)
    const icd10Codes = [...new Set(claim.lineItems.flatMap((l) => l.icd10Codes))]

    const letter = await generateAppealLetter({
      patientName: `${claim.patient.firstName} ${claim.patient.lastName}`,
      patientDob: claim.patient.dob.toISOString().slice(0, 10),
      memberId: claim.patient.memberId,
      payerName: claim.patient.payerName,
      claimId: claim.stediClaimId ?? claim.id,
      serviceDate: claim.serviceDate.toISOString().slice(0, 10),
      cptCodes,
      icd10Codes,
      totalCharge: Number(claim.totalCharge),
      carcCode: denial.carcCode,
      denialReason: denial.denialReason,
      providerName: `${claim.provider.firstName} ${claim.provider.lastName}`,
      providerNpi: claim.provider.npi,
      practiceName: claim.practice.name,
    })

    const updated = await prisma.denial.update({
      where: { id },
      data: { appealLetter: letter, appealStatus: "IN_PROGRESS", appealedAt: new Date() },
    })

    return NextResponse.json({ letter, denial: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate appeal" }, { status: 500 })
  }
}

const patchSchema = z.object({
  appealStatus: z.enum(["IN_PROGRESS", "WON", "LOST", "WRITE_OFF"]),
  resolution: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const input = patchSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")
    logAudit({ action: "denial.appeal_update", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "denial", resourceId: id, req })
    const denial = await prisma.denial.update({
      where: { id, claim: { practiceId: session.practiceId } },
      data: {
        appealStatus: input.appealStatus,
        resolution: input.resolution,
        resolvedAt: ["WON", "LOST", "WRITE_OFF"].includes(input.appealStatus) ? new Date() : undefined,
      },
    })

    if (input.appealStatus === "WON") {
      await prisma.claim.update({
        where: { id: denial.claimId },
        data: { claimStatus: "SUBMITTED" },
      })
    }

    return NextResponse.json(denial)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
