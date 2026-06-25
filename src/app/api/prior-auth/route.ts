import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const createSchema = z.object({
  patientId: z.string().uuid(),
  payerId: z.string().min(1),
  payerName: z.string().min(1),
  cptCodes: z.array(z.string()).min(1),
  authNumber: z.string().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sessionsApproved: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const patientId = req.nextUrl.searchParams.get("patientId")

  const priorAuths = await prisma.priorAuthorization.findMany({
    where: {
      practiceId: session.practiceId,
      ...(patientId ? { patientId } : {}),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(priorAuths)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const input = createSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId, practiceId: session.practiceId },
    })
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

    logAudit({ action: "prior-auth.create", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "prior-auth", req })

    const pa = await prisma.priorAuthorization.create({
      data: {
        practiceId: session.practiceId,
        patientId: input.patientId,
        payerId: input.payerId,
        payerName: input.payerName,
        cptCodes: input.cptCodes,
        authNumber: input.authNumber,
        status: input.authNumber ? "APPROVED" : "PENDING",
        approvedAt: input.authNumber ? new Date() : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        sessionsApproved: input.sessionsApproved,
        notes: input.notes,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(pa, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: "Failed to create prior authorization" }, { status: 500 })
  }
}
