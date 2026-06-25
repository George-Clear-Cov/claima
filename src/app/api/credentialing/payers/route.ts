import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const createSchema = z.object({
  providerId:      z.string().uuid(),
  payerId:         z.string().min(1),
  payerName:       z.string().min(1),
  status:          z.enum(["PENDING", "IN_REVIEW", "APPROVED", "DENIED", "EXPIRED", "RE_CREDENTIALING"]).optional(),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  approvedDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:           z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const providerId = req.nextUrl.searchParams.get("providerId")
  const { prisma } = await import("@/lib/prisma")

  const creds = await prisma.providerCredential.findMany({
    where: {
      practiceId: session.practiceId,
      ...(providerId ? { providerId } : {}),
    },
    orderBy: { payerName: "asc" },
  })

  return NextResponse.json(creds)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const input = createSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const provider = await prisma.provider.findUnique({
      where: { id: input.providerId, practiceId: session.practiceId },
    })
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const cred = await prisma.providerCredential.upsert({
      where: { providerId_payerId: { providerId: input.providerId, payerId: input.payerId } },
      create: {
        practiceId:      session.practiceId,
        providerId:      input.providerId,
        payerId:         input.payerId,
        payerName:       input.payerName,
        status:          input.status ?? "PENDING",
        applicationDate: input.applicationDate ? new Date(input.applicationDate) : undefined,
        approvedDate:    input.approvedDate ? new Date(input.approvedDate) : undefined,
        expiryDate:      input.expiryDate ? new Date(input.expiryDate) : undefined,
        notes:           input.notes,
      },
      update: {
        payerName:       input.payerName,
        status:          input.status ?? "PENDING",
        applicationDate: input.applicationDate ? new Date(input.applicationDate) : undefined,
        approvedDate:    input.approvedDate ? new Date(input.approvedDate) : undefined,
        expiryDate:      input.expiryDate ? new Date(input.expiryDate) : undefined,
        notes:           input.notes,
      },
    })

    logAudit({ action: "credentialing.payer.add", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "provider-credential", resourceId: cred.id, req })

    return NextResponse.json(cred, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to add payer credential" }, { status: 500 })
  }
}
