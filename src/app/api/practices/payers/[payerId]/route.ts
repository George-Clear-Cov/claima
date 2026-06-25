import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"

const updateSchema = z.object({
  enrollmentStatus: z.enum(["PENDING", "ACTIVE", "INACTIVE"]).optional(),
  claimMdPayerId: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
})

// PATCH /api/practices/payers/[payerId] — update a single enrollment
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ payerId: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { payerId } = await params

  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")

  const existing = await prisma.practicePayerEnrollment.findUnique({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.practicePayerEnrollment.update({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
    data: {
      ...input,
      enrolledAt: input.enrollmentStatus === "ACTIVE" && existing.enrollmentStatus !== "ACTIVE" ? new Date() : undefined,
    },
  })

  return NextResponse.json({ enrollment: updated })
}

// DELETE /api/practices/payers/[payerId] — remove enrollment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ payerId: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { payerId } = await params
  const { prisma } = await import("@/lib/prisma")

  const existing = await prisma.practicePayerEnrollment.findUnique({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.practicePayerEnrollment.delete({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
  })

  return NextResponse.json({ deleted: true })
}
