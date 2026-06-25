import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: denialId } = await params
  const { prisma } = await import("@/lib/prisma")

  const denial = await prisma.denial.findUnique({
    where: { id: denialId },
    include: {
      claim: {
        include: {
          lineItems: true,
          practice: { select: { id: true } },
        },
      },
    },
  })

  if (!denial) return NextResponse.json({ error: "Denial not found" }, { status: 404 })
  if (denial.claim.practice.id !== session.practiceId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const original = denial.claim

  const newClaim = await prisma.claim.create({
    data: {
      practiceId: session.practiceId,
      patientId: original.patientId,
      providerId: original.providerId,
      serviceDate: original.serviceDate,
      claimStatus: "DRAFT",
      totalCharge: original.totalCharge,
      denialReason: `Resubmission — original denied CARC-${denial.carcCode}: ${denial.denialReason}`,
      lineItems: {
        create: original.lineItems.map((li) => ({
          cptCode: li.cptCode,
          icd10Codes: li.icd10Codes,
          modifier: li.modifier,
          units: li.units,
          chargeAmount: li.chargeAmount,
          description: li.description,
        })),
      },
    },
  })

  await prisma.denial.update({
    where: { id: denialId },
    data: { appealStatus: "IN_PROGRESS" },
  })

  logAudit({ action: "denial.resubmit_created", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "denial", resourceId: denialId, req })

  return NextResponse.json({ claimId: newClaim.id })
}
