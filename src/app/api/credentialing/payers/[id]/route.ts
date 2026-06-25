import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const updateSchema = z.object({
  status:          z.enum(["PENDING", "IN_REVIEW", "APPROVED", "DENIED", "EXPIRED", "RE_CREDENTIALING"]).optional(),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  approvedDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiryDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:           z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const input = updateSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const existing = await prisma.providerCredential.findUnique({ where: { id } })
    if (!existing || existing.practiceId !== session.practiceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const toDate = (s: string | null | undefined) =>
      s == null ? undefined : s === "" ? null : new Date(s)

    const updated = await prisma.providerCredential.update({
      where: { id },
      data: {
        status:          input.status,
        applicationDate: toDate(input.applicationDate),
        approvedDate:    toDate(input.approvedDate),
        expiryDate:      toDate(input.expiryDate),
        notes:           input.notes,
      },
    })

    logAudit({ action: "credentialing.payer.update", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "provider-credential", resourceId: id, req })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to update payer credential" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { prisma } = await import("@/lib/prisma")

  const existing = await prisma.providerCredential.findUnique({ where: { id } })
  if (!existing || existing.practiceId !== session.practiceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.providerCredential.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
