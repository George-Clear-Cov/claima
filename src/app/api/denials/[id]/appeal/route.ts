import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateAppealLetter } from "@/lib/appeal-generator"
import { getSessionFromRequest } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const denial = await prisma.denial.update({
    where: { id, claim: { practiceId: session.practiceId } },
    data: {
      appealStatus: body.appealStatus,
      resolution: body.resolution,
      resolvedAt: ["WON", "LOST", "WRITE_OFF"].includes(body.appealStatus) ? new Date() : undefined,
    },
  })

  if (body.appealStatus === "WON") {
    await prisma.claim.update({
      where: { id: denial.claimId },
      data: { claimStatus: "SUBMITTED" },
    })
  }

  return NextResponse.json(denial)
}
