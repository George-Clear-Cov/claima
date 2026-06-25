import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// GET /api/era/unmatched — ERAs that couldn't be matched to a claim (need manual review)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const unmatched = await prisma.eRA.findMany({
    where: {
      practiceId: session.practiceId,
      claimId: null,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ unmatched, count: unmatched.length })
}
