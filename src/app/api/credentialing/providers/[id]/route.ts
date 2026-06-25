import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const updateSchema = z.object({
  deaNumber:          z.string().optional(),
  deaExpiry:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  stateLicense:       z.string().optional(),
  stateLicenseState:  z.string().max(2).optional(),
  stateLicenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  boardCertExpiry:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  malpracticeCarrier: z.string().optional(),
  malpracticeExpiry:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  caqhProviderId:     z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const input = updateSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const provider = await prisma.provider.findUnique({
      where: { id, practiceId: session.practiceId },
    })
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const toDate = (s: string | null | undefined) =>
      s == null ? undefined : s === "" ? null : new Date(s)

    const updated = await prisma.provider.update({
      where: { id },
      data: {
        deaNumber:          input.deaNumber,
        deaExpiry:          toDate(input.deaExpiry),
        stateLicense:       input.stateLicense,
        stateLicenseState:  input.stateLicenseState,
        stateLicenseExpiry: toDate(input.stateLicenseExpiry),
        boardCertExpiry:    toDate(input.boardCertExpiry),
        malpracticeCarrier: input.malpracticeCarrier,
        malpracticeExpiry:  toDate(input.malpracticeExpiry),
        caqhProviderId:     input.caqhProviderId,
        caqhLastUpdated:    input.caqhProviderId ? new Date() : undefined,
      },
    })

    logAudit({ action: "credentialing.update", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "provider", resourceId: id, req })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to update provider credentials" }, { status: 500 })
  }
}
