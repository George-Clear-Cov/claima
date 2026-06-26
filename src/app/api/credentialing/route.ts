import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  logAudit({ action: "credentialing.view", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const providers = await prisma.provider.findMany({
    where: { practiceId: session.practiceId },
    include: {
      payerCredentials: {
        orderBy: { payerName: "asc" },
      },
    },
    orderBy: { lastName: "asc" },
  })

  return NextResponse.json(providers)
}
