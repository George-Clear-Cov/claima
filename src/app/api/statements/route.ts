import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  patientId: z.string().uuid(),
  claimId: z.string().uuid(),
  totalCharge: z.number().positive(),
  insurancePaid: z.number().min(0),
  adjustments: z.number().min(0).default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

const paySchema = z.object({
  statementId: z.string().uuid(),
  amount: z.number().positive(),
})

// POST /api/statements — create statement from ERA data
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Handle payment action
    if (body.action === "pay") {
      const input = paySchema.parse(body)
      if (process.env.DATABASE_URL) {
        const { prisma } = await import("@/lib/prisma")
        const stmt = await prisma.patientStatement.findUniqueOrThrow({
          where: { id: input.statementId },
        })
        const newPaid = Number(stmt.patientPaid) + input.amount
        const newBalance = Math.max(Number(stmt.patientOwes) - newPaid, 0)
        const updated = await prisma.patientStatement.update({
          where: { id: input.statementId },
          data: {
            patientPaid: newPaid,
            balanceDue: newBalance,
            statementStatus: newBalance === 0 ? "PAID" : "PARTIAL",
            paidAt: newBalance === 0 ? new Date() : undefined,
          },
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json({ error: "No database configured" }, { status: 503 })
    }

    const input = createSchema.parse(body)
    const patientOwes = Math.max(input.totalCharge - input.insurancePaid - input.adjustments, 0)

    if (process.env.DATABASE_URL) {
      const { prisma } = await import("@/lib/prisma")
      const stmt = await prisma.patientStatement.create({
        data: {
          patientId: input.patientId,
          claimId: input.claimId,
          totalCharge: input.totalCharge,
          insurancePaid: input.insurancePaid,
          adjustments: input.adjustments,
          patientOwes,
          balanceDue: patientOwes,
          dueDate: input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 86400000),
          notes: input.notes,
          statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
        },
        include: { patient: true, claim: { include: { lineItems: true } } },
      })
      return NextResponse.json(stmt)
    }

    // No DB: return computed values without persisting
    return NextResponse.json({
      id: "demo",
      patientOwes,
      balanceDue: patientOwes,
      statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
      ...input,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/statements — list all statements
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([])
  }
  const { prisma } = await import("@/lib/prisma")
  const statements = await prisma.patientStatement.findMany({
    include: {
      patient: { select: { firstName: true, lastName: true } },
      claim: { include: { lineItems: true, provider: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(statements)
}
