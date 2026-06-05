import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { classifyDenial } from "@/lib/denial-codes"

const eraSchema = z.object({
  claimId: z.string().uuid(),
  carcCode: z.string(),
  denialReason: z.string(),
})

// POST: receive a denial from ERA processing (or manual entry)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = eraSchema.parse(body)

    const classification = classifyDenial(input.carcCode)

    // Update claim status to DENIED
    await prisma.claim.update({
      where: { id: input.claimId },
      data: {
        claimStatus: "DENIED",
        denialCode: input.carcCode,
        denialReason: input.denialReason,
      },
    })

    // Create denial record
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
        claim: {
          include: {
            patient: true,
            provider: true,
            lineItems: true,
          },
        },
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

// GET: list all denials sorted by priority
export async function GET() {
  const denials = await prisma.denial.findMany({
    include: {
      claim: {
        include: {
          patient: { select: { firstName: true, lastName: true, payerName: true } },
          provider: { select: { firstName: true, lastName: true } },
          lineItems: { select: { cptCode: true, chargeAmount: true } },
        },
      },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  })

  return NextResponse.json(denials)
}
