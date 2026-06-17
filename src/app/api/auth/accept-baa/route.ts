import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"

  await prisma.practice.update({
    where: { id: session.practiceId },
    data: { baaAcceptedAt: new Date(), baaAcceptedIp: ip },
  })

  logAudit({
    action: "baa.accepted",
    practiceId: session.practiceId,
    userId: session.userId,
    userEmail: session.email,
    req,
  })

  return NextResponse.json({ ok: true })
}
