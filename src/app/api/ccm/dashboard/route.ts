import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const CCM_RATE_99490 = 62.43  // Medicare rate for 99490 (20+ min/month)
const CCM_RATE_99439 = 47.15  // Add-on for additional 20 min

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  logAudit({ action: "ccm.dashboard.view", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [enrolledPatients, monthLogs] = await Promise.all([
    prisma.patient.findMany({
      where: { practiceId: session.practiceId, ccmEnrolled: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.ccmTimeLog.findMany({
      where: {
        practiceId: session.practiceId,
        logDate: { gte: monthStart, lte: monthEnd },
      },
    }),
  ])

  // Aggregate minutes per patient this month
  const minutesByPatient = new Map<string, number>()
  for (const log of monthLogs) {
    minutesByPatient.set(log.patientId, (minutesByPatient.get(log.patientId) ?? 0) + log.minutes)
  }

  const enrolledWithMinutes = enrolledPatients.map((p) => {
    const minutes = minutesByPatient.get(p.id) ?? 0
    const billable = minutes >= 20
    const additionalUnit = minutes >= 40
    const isMedicare = p.payerName.toLowerCase().includes("medicare")
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      payerName: p.payerName,
      isMedicare,
      ccmEnrolledAt: p.ccmEnrolledAt,
      minutesThisMonth: minutes,
      billable,
      additionalUnit,
    }
  })

  const billableCount = enrolledWithMinutes.filter((p) => p.billable).length
  const estimatedRevenue = enrolledWithMinutes.reduce((sum, p) => {
    if (!p.billable) return sum
    return sum + CCM_RATE_99490 + (p.additionalUnit ? CCM_RATE_99439 : 0)
  }, 0)

  return NextResponse.json({
    enrolled: enrolledWithMinutes,
    stats: {
      enrolledCount: enrolledPatients.length,
      billableThisMonth: billableCount,
      estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
      monthLabel: now.toLocaleString("default", { month: "long", year: "numeric" }),
    },
  })
}
