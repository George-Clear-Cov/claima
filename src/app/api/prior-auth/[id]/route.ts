import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const updateSchema = z.object({
  authNumber: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "DENIED", "EXPIRED", "CANCELLED"]).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sessionsApproved: z.number().int().positive().optional(),
  sessionsUsed: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const input = updateSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const existing = await prisma.priorAuthorization.findUnique({
      where: { id, practiceId: session.practiceId },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    logAudit({ action: "prior-auth.update", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "prior-auth", resourceId: id, req })

    const updated = await prisma.priorAuthorization.update({
      where: { id },
      data: {
        authNumber: input.authNumber,
        status: input.status,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        sessionsApproved: input.sessionsApproved,
        sessionsUsed: input.sessionsUsed,
        notes: input.notes,
        approvedAt: input.status === "APPROVED" && !existing.approvedAt ? new Date() : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: "Failed to update prior authorization" }, { status: 500 })
  }
}
