import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"

const enrollmentSchema = z.object({
  payers: z.array(z.object({
    payerId: z.string().min(1).max(50),
    payerName: z.string().min(1).max(100),
    enrollmentStatus: z.enum(["PENDING", "ACTIVE", "INACTIVE"]).default("PENDING"),
    claimMdPayerId: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
  })).min(1),
})

// GET /api/practices/payers — list enrolled payers for this practice
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const enrollments = await prisma.practicePayerEnrollment.findMany({
    where: { practiceId: session.practiceId },
    orderBy: { payerName: "asc" },
  })

  return NextResponse.json({ enrollments })
}

// POST /api/practices/payers — upsert payer enrollments
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  let input: z.infer<typeof enrollmentSchema>
  try {
    input = enrollmentSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")
  const { v4: uuidv4 } = await import("uuid")

  const results = await Promise.all(
    input.payers.map((payer) =>
      prisma.practicePayerEnrollment.upsert({
        where: {
          practiceId_payerId: {
            practiceId: session.practiceId,
            payerId: payer.payerId,
          },
        },
        update: {
          payerName: payer.payerName,
          enrollmentStatus: payer.enrollmentStatus,
          claimMdPayerId: payer.claimMdPayerId ?? null,
          notes: payer.notes ?? null,
          enrolledAt: payer.enrollmentStatus === "ACTIVE" ? new Date() : undefined,
        },
        create: {
          id: uuidv4(),
          practiceId: session.practiceId,
          payerId: payer.payerId,
          payerName: payer.payerName,
          enrollmentStatus: payer.enrollmentStatus,
          claimMdPayerId: payer.claimMdPayerId ?? null,
          notes: payer.notes ?? null,
          enrolledAt: payer.enrollmentStatus === "ACTIVE" ? new Date() : null,
        },
      })
    )
  )

  return NextResponse.json({ saved: results.length, enrollments: results })
}
