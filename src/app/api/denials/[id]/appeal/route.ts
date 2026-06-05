import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateAppealLetter } from "@/lib/appeal-generator"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const denial = await prisma.denial.findUniqueOrThrow({
      where: { id },
      include: {
        claim: {
          include: {
            patient: true,
            provider: true,
            practice: true,
            lineItems: true,
          },
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
      data: {
        appealLetter: letter,
        appealStatus: "IN_PROGRESS",
        appealedAt: new Date(),
      },
    })

    return NextResponse.json({ letter, denial: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate appeal" }, { status: 500 })
  }
}

// PATCH: update appeal status (submitted, won, lost, write_off)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const denial = await prisma.denial.update({
    where: { id },
    data: {
      appealStatus: body.appealStatus,
      resolution: body.resolution,
      resolvedAt: body.appealStatus === "WON" || body.appealStatus === "LOST" || body.appealStatus === "WRITE_OFF"
        ? new Date()
        : undefined,
    },
  })

  // If won, update claim status back to SUBMITTED for re-processing
  if (body.appealStatus === "WON") {
    await prisma.claim.update({
      where: { id: denial.claimId },
      data: { claimStatus: "SUBMITTED" },
    })
  }

  return NextResponse.json(denial)
}
