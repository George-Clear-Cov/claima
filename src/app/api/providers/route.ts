import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  npi: z.string().length(10),
  taxonomy: z.string().min(1),
})

// GET /api/providers — list providers for current practice
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 })

  const { prisma } = await import("@/lib/prisma")
  logAudit({ action: "provider.list", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "provider", req })
  const providers = await prisma.provider.findMany({
    where: { practiceId: session.practiceId },
    orderBy: { lastName: "asc" },
  })
  return NextResponse.json(providers)
}

// POST /api/providers — add a provider
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")
    logAudit({ action: "provider.create", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "provider", req })
    const provider = await prisma.provider.create({
      data: { ...data, practiceId: session.practiceId },
    })
    return NextResponse.json(provider, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A provider with this NPI already exists" }, { status: 409 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 })
  }
}
