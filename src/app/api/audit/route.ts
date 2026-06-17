import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// GET /api/audit — paginated audit log for the current practice (admin only)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1")
  const limit = 50
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { practiceId: session.practiceId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: { practiceId: session.practiceId } }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
}
