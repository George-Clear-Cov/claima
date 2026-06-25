import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const schema = z.object({
  patientId: z.string().uuid(),
  consentObtained: z.boolean(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { patientId, consentObtained } = schema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const patient = await prisma.patient.findUnique({
      where: { id: patientId, practiceId: session.practiceId },
    })
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    if (!consentObtained) return NextResponse.json({ error: "Patient consent is required" }, { status: 400 })

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ccmEnrolled: true,
        ccmEnrolledAt: new Date(),
        ccmConsentedAt: new Date(),
      },
    })

    logAudit({ action: "ccm.enroll", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "patient", resourceId: patientId, req })

    return NextResponse.json({ ok: true, patient: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to enroll patient" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const patientId = req.nextUrl.searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const { prisma } = await import("@/lib/prisma")
  const patient = await prisma.patient.findUnique({
    where: { id: patientId, practiceId: session.practiceId },
  })
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.patient.update({
    where: { id: patientId },
    data: { ccmEnrolled: false },
  })

  logAudit({ action: "ccm.unenroll", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "patient", resourceId: patientId, req })

  return NextResponse.json({ ok: true })
}
