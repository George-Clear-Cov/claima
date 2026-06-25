import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { sendEmail } from "@/lib/email"

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

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { prisma } = await import("@/lib/prisma")

    if (body.action === "pay") {
      const input = paySchema.parse(body)
      const stmt = await prisma.patientStatement.findUniqueOrThrow({
        where: { id: input.statementId, claim: { practiceId: session.practiceId } },
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

    const input = createSchema.parse(body)

    // Verify the claim belongs to this practice
    const claim = await prisma.claim.findUnique({
      where: { id: input.claimId, practiceId: session.practiceId },
    })
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 })

    const patientOwes = Math.max(input.totalCharge - input.insurancePaid - input.adjustments, 0)
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

    if (patientOwes > 0 && stmt.patient.email) {
      const dueDate = stmt.dueDate ? new Date(stmt.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "30 days"
      void sendEmail({
        to: stmt.patient.email,
        subject: `Your statement is ready — $${patientOwes.toFixed(2)} due`,
        html: `<p>Dear ${stmt.patient.firstName},</p>
<p>A statement has been generated for your recent visit. Your patient balance is <strong>$${patientOwes.toFixed(2)}</strong>, due by ${dueDate}.</p>
<p>Please contact our office if you have any questions about your bill.</p>
<p>Thank you,<br>Billing Department</p>`,
      }).catch((e) => console.error("[email] statement notification failed:", e))
    }

    return NextResponse.json(stmt)
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
  logAudit({ action: "statement.list", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "statement", req })
  const statements = await prisma.patientStatement.findMany({
    where: { claim: { practiceId: session.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      claim: { include: { lineItems: true, provider: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(statements)
}
