import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// Returns all providers with their most recent OIG check result
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  logAudit({ action: "oig.checks.view", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const providers = await prisma.provider.findMany({
    where: { practiceId: session.practiceId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      npi: true,
      taxonomy: true,
      oigChecks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
        select: {
          id: true,
          checkedAt: true,
          status: true,
          matchFound: true,
          matchDetails: true,
          error: true,
        },
      },
    },
    orderBy: { lastName: "asc" },
  })

  return NextResponse.json(providers)
}
