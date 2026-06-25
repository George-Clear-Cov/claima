import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, COOKIE_NAME } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// DELETE /api/admin/practice — hard-delete all practice PHI (ADMIN only)
// Body: { confirm: "DELETE MY PRACTICE" }
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  let body: { confirm?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (body.confirm !== "DELETE MY PRACTICE") {
    return NextResponse.json({ error: "Confirmation phrase required" }, { status: 400 })
  }

  logAudit({ action: "practice.delete", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "practice", req })

  const { prisma } = await import("@/lib/prisma")
  const practiceId = session.practiceId

  // Delete in FK-safe order
  await prisma.$transaction(async (tx) => {
    await tx.patientStatement.deleteMany({ where: { claim: { practiceId } } })
    await tx.denial.deleteMany({ where: { claim: { practiceId } } })
    await tx.claimLine.deleteMany({ where: { claim: { practiceId } } })
    await tx.claim.deleteMany({ where: { practiceId } })
    await tx.patient.deleteMany({ where: { practiceId } })
    await tx.provider.deleteMany({ where: { practiceId } })
    await tx.marketplaceSubscription.deleteMany({ where: { practiceId } })
    await tx.auditLog.deleteMany({ where: { practiceId } })
    await tx.user.deleteMany({ where: { practiceId } })
    await tx.practice.delete({ where: { id: practiceId } })
  })

  const res = NextResponse.json({ deleted: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
