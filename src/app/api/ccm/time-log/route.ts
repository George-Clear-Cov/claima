import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"

const createSchema = z.object({
  patientId: z.string().uuid(),
  minutes: z.number().int().min(1).max(120),
  description: z.string().optional(),
  logDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const patientId = req.nextUrl.searchParams.get("patientId")
  const { prisma } = await import("@/lib/prisma")

  const logs = await prisma.ccmTimeLog.findMany({
    where: {
      practiceId: session.practiceId,
      ...(patientId ? { patientId } : {}),
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { logDate: "desc" },
  })

  return NextResponse.json(logs)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { patientId, minutes, description, logDate } = createSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const patient = await prisma.patient.findUnique({
      where: { id: patientId, practiceId: session.practiceId },
    })
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    if (!patient.ccmEnrolled) return NextResponse.json({ error: "Patient not enrolled in CCM" }, { status: 400 })

    const log = await prisma.ccmTimeLog.create({
      data: {
        practiceId: session.practiceId,
        patientId,
        minutes,
        description,
        logDate: logDate ? new Date(logDate) : new Date(),
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to log time" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { prisma } = await import("@/lib/prisma")
  const log = await prisma.ccmTimeLog.findUnique({ where: { id } })
  if (!log || log.practiceId !== session.practiceId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.ccmTimeLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
