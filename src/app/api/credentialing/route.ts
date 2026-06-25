import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
