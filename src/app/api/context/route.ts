import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

// GET /api/context — return practice, providers, and patients for the session
// Used by claim submission and other forms that need real entity selectors
export async function GET() {
  const session = await getSession()
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

  return NextResponse.json({ practice, providers, patients })
}
