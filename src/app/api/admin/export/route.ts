import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// GET /api/admin/export — export all practice data as JSON (ADMIN only)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")
  logAudit({ action: "practice.export", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "practice", req })

  const [practice, providers, patients, claims, statements, denials, auditLogs, users] = await Promise.all([
    prisma.practice.findUnique({ where: { id: session.practiceId } }),
    prisma.provider.findMany({ where: { practiceId: session.practiceId } }),
    prisma.patient.findMany({ where: { practiceId: session.practiceId } }),
    prisma.claim.findMany({
      where: { practiceId: session.practiceId },
      include: { lineItems: true },
    }),
    prisma.patientStatement.findMany({
      where: { claim: { practiceId: session.practiceId } },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId: session.practiceId } },
    }),
    prisma.auditLog.findMany({
      where: { practiceId: session.practiceId },
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    prisma.user.findMany({
      where: { practiceId: session.practiceId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.email,
    practice,
    users,
    providers,
    patients,
    claims,
    statements,
    denials,
    auditLogs,
  }

  const filename = `claima-export-${session.practiceId}-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
