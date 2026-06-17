import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { classifyDenial } from "@/lib/denial-codes"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const eraSchema = z.object({
  claimId: z.string().uuid(),
  carcCode: z.string(),
  denialReason: z.string(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const input = eraSchema.parse(body)

    const classification = classifyDenial(input.carcCode)

    const { prisma } = await import("@/lib/prisma")
    // Verify claim belongs to this practice
    const claim = await prisma.claim.findUnique({ where: { id: input.claimId } })
    if (!claim || claim.practiceId !== session.practiceId) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    await prisma.claim.update({
      where: { id: input.claimId },
      data: { claimStatus: "DENIED", denialCode: input.carcCode, denialReason: input.denialReason },
    })

    const denial = await prisma.denial.create({
      data: {
        claimId: input.claimId,
        carcCode: input.carcCode,
        denialReason: input.denialReason,
        category: classification.category,
        priority: classification.priority,
        action: classification.action,
        appealable: classification.appealable,
      },
      include: {
        claim: { include: { patient: true, provider: true, lineItems: true } },
      },
    })

    return NextResponse.json(denial)
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
  logAudit({ action: "denial.list", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "denial", req })
  const denials = await prisma.denial.findMany({
    where: { claim: { practiceId: session.practiceId } },
    include: {
      claim: {
        include: {
          patient: { select: { firstName: true, lastName: true, payerName: true } },
          provider: { select: { firstName: true, lastName: true } },
          lineItems: { select: { cptCode: true, chargeAmount: true } },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  })

  return NextResponse.json(denials)
}
