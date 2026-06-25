import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// GET /api/context — return practice, providers, and patients for the session
// Used by claim submission and other forms that need real entity selectors
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ practice: null, providers: [], patients: [] })
  }

  const { prisma } = await import("@/lib/prisma")
  const [practice, providers, patients] = await Promise.all([
    prisma.practice.findUnique({ where: { id: session.practiceId } }),
    prisma.provider.findMany({
      where: { practiceId: session.practiceId },
      orderBy: { lastName: "asc" },
    }),
    prisma.patient.findMany({
      where: { practiceId: session.practiceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ])

  return NextResponse.json({
    practice,
    providers,
    patients,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    clearinghouseConfigured: !!(process.env.CLAIMMD_ACCOUNT_KEY && process.env.CLAIMMD_API_KEY),
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
    dbConfigured: !!process.env.DATABASE_URL,
  })
}
