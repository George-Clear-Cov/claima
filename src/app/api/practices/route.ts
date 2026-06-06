import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  npi: z.string().length(10).optional(),
  taxId: z.string().optional(),
  taxonomy: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
})

// GET /api/practices — return the current practice
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")
  const practice = await prisma.practice.findUnique({ where: { id: session.practiceId } })
  return NextResponse.json(practice)
}

// PATCH /api/practices — update current practice details
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")
    const practice = await prisma.practice.update({ where: { id: session.practiceId }, data })
    return NextResponse.json(practice)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
