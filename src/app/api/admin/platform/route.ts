import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase())
  return admins.includes(email.toLowerCase())
}

// GET /api/admin/platform — aggregate stats across all practices
// Gated by PLATFORM_ADMIN_EMAILS env var
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isPlatformAdmin(session.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  logAudit({ action: "platform.admin.view", userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const practices = await prisma.practice.findMany({
    include: {
      users: { select: { email: true, name: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      providers: { select: { id: true } },
      _count: { select: { claims: true, patients: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const practiceStats = await Promise.all(
    practices.map(async (practice) => {
      const [claims, denials, statements] = await Promise.all([
        prisma.claim.findMany({
          where: { practiceId: practice.id },
          select: {
            claimStatus: true,
            totalCharge: true,
            paidAmount: true,
            submittedAt: true,
            paidAt: true,
          },
        }),
        prisma.denial.findMany({
          where: { claim: { practiceId: practice.id } },
          select: { appealStatus: true },
        }),
        prisma.patientStatement.findMany({
          where: { claim: { practiceId: practice.id } },
          select: { insurancePaid: true, patientPaid: true, balanceDue: true },
        }),
      ])

      const totalBilled = claims.reduce((s, c) => s + Number(c.totalCharge), 0)
      const totalCollected = claims.reduce((s, c) => s + Number(c.paidAmount ?? 0), 0)
      const patientCollected = statements.reduce((s, s2) => s + Number(s2.patientPaid ?? 0), 0)
      const platformFee = (totalCollected + patientCollected) * (practice.platformFeePercent / 100)
      const deniedCount = claims.filter(c => c.claimStatus === "DENIED").length
      const denialRate = claims.length > 0 ? Math.round((deniedCount / claims.length) * 100) : 0
      const openDenials = denials.filter(d => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus)).length
      const pendingAR = statements.reduce((s, s2) => s + Number(s2.balanceDue ?? 0), 0)

      const paidClaims = claims.filter(c => c.claimStatus === "PAID" && c.paidAt && c.submittedAt)
      const avgDaysToPayment = paidClaims.length > 0
        ? Math.round(paidClaims.reduce((s, c) => {
            return s + (new Date(c.paidAt!).getTime() - new Date(c.submittedAt!).getTime()) / 86400000
          }, 0) / paidClaims.length)
        : null

      const adminUser = practice.users.find(u => u.role === "ADMIN") ?? practice.users[0]

      return {
        id: practice.id,
        name: practice.name,
        npi: practice.npi,
        city: practice.city,
        state: practice.state,
        createdAt: practice.createdAt,
        adminEmail: adminUser?.email ?? null,
        stripeOnboarded: practice.stripeOnboarded,
        platformFeePercent: practice.platformFeePercent,
        providerCount: practice.providers.length,
        patientCount: practice._count.patients,
        claimCount: practice._count.claims,
        totalBilled,
        totalCollected,
        patientCollected,
        platformFeeEarned: Math.round(platformFee * 100) / 100,
        denialRate,
        openDenials,
        pendingAR: Math.round(pendingAR * 100) / 100,
        avgDaysToPayment,
        collectionRate: totalBilled > 0 ? Math.round(((totalCollected + patientCollected) / totalBilled) * 100) : 0,
      }
    })
  )

  const totals = {
    practices: practices.length,
    totalBilled: practiceStats.reduce((s, p) => s + p.totalBilled, 0),
    totalCollected: practiceStats.reduce((s, p) => s + p.totalCollected + p.patientCollected, 0),
    totalPlatformFee: practiceStats.reduce((s, p) => s + p.platformFeeEarned, 0),
    totalPendingAR: practiceStats.reduce((s, p) => s + p.pendingAR, 0),
    avgDenialRate: practiceStats.length > 0
      ? Math.round(practiceStats.reduce((s, p) => s + p.denialRate, 0) / practiceStats.length)
      : 0,
  }

  return NextResponse.json({ totals, practices: practiceStats })
}
