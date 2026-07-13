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

  // Hard-delete ALL practice PHI in FK-safe order (children before parents). Every table that
  // stores PHI or references the practice graph must be included, or (a) Postgres FK constraints
  // roll the whole transaction back and deletion silently fails, and (b) raw 271/835 payloads +
  // member IDs survive offboarding — breaching the BAA return/destroy obligation (45 CFR
  // §164.504(e)(2)(ii)).
  await prisma.$transaction(async (tx) => {
    // Claim-scoped children
    await tx.patientStatement.deleteMany({ where: { claim: { practiceId } } })
    await tx.denial.deleteMany({ where: { claim: { practiceId } } })
    await tx.claimLine.deleteMany({ where: { claim: { practiceId } } })
    await tx.eRA.deleteMany({ where: { practiceId } })
    // Patient-scoped children
    await tx.eligibilityCheck.deleteMany({ where: { patient: { practiceId } } })
    await tx.ccmTimeLog.deleteMany({ where: { practiceId } })
    // Provider-scoped children
    await tx.providerCredential.deleteMany({ where: { practiceId } })
    await tx.oigCheck.deleteMany({ where: { practiceId } })
    // Claims reference priorAuths (claim.priorAuthId), so delete claims before priorAuths —
    // and both before patients/providers.
    await tx.claim.deleteMany({ where: { practiceId } })
    await tx.priorAuthorization.deleteMany({ where: { practiceId } })
    // Practice graph roots
    await tx.patient.deleteMany({ where: { practiceId } })
    await tx.provider.deleteMany({ where: { practiceId } })
    // Practice-scoped standalone records
    await tx.aiUsage.deleteMany({ where: { practiceId } })
    await tx.practicePayerEnrollment.deleteMany({ where: { practiceId } })
    await tx.marketplaceSubscription.deleteMany({ where: { practiceId } })
    await tx.user.deleteMany({ where: { practiceId } })
    await tx.practice.delete({ where: { id: practiceId } })
    // NOTE: AuditLog is intentionally NOT deleted — it holds only metadata (action/resource/IP/
    // UA), no PHI, and must be retained for the HIPAA §164.316(b)(2) 6-year audit-trail
    // requirement. It has no FK to Practice, so retaining it does not block deletion.
  })

  const res = NextResponse.json({ deleted: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
