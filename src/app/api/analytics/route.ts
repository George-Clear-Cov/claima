import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  const to = toParam ? new Date(toParam) : new Date()
  to.setHours(23, 59, 59, 999)

  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getFullYear(), to.getMonth() - 5, 1) // default: 6 months

  const { prisma } = await import("@/lib/prisma")
  const practiceId = session.practiceId
  logAudit({ action: "analytics.view", practiceId, userId: session.userId, userEmail: session.email, resource: "analytics", req })

  const [claims, statements, denials] = await Promise.all([
    prisma.claim.findMany({
      where: { practiceId, serviceDate: { gte: from, lte: to } },
      include: {
        patient: { select: { payerName: true } },
        provider: { select: { firstName: true, lastName: true } },
        statement: { select: { insurancePaid: true, patientPaid: true, balanceDue: true, statementStatus: true, createdAt: true } },
      },
      orderBy: { serviceDate: "asc" },
    }),
    prisma.patientStatement.findMany({
      where: {
        claim: { practiceId, serviceDate: { gte: from, lte: to } },
        statementStatus: { not: "WRITE_OFF" },
      },
      select: { balanceDue: true, patientOwes: true, createdAt: true },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId, serviceDate: { gte: from, lte: to } } },
      select: { appealStatus: true },
    }),
  ])

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalBilled = claims.reduce((s, c) => s + Number(c.totalCharge), 0)
  const insurancePaid = claims.reduce((s, c) => s + Number(c.statement?.insurancePaid ?? 0), 0)
  const patientCollected = claims.reduce((s, c) => s + Number(c.statement?.patientPaid ?? 0), 0)
  const totalCollected = insurancePaid + patientCollected
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0
  const openDenials = denials.filter((d) => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus)).length
  const deniedClaims = claims.filter((c) => c.claimStatus === "DENIED").length
  const denialRate = claims.length > 0 ? Math.round((deniedClaims / claims.length) * 100) : 0

  // Avg days from serviceDate to paidAt (for PAID claims)
  const paidClaims = claims.filter((c) => c.claimStatus === "PAID" && c.paidAt)
  const avgDaysToPayment = paidClaims.length > 0
    ? Math.round(paidClaims.reduce((s, c) => {
        const days = (new Date(c.paidAt!).getTime() - new Date(c.serviceDate).getTime()) / 86400000
        return s + days
      }, 0) / paidClaims.length)
    : null

  // ── Monthly revenue ──────────────────────────────────────────────────────────
  const monthMap = new Map<string, { billed: number; insurancePaid: number; patientCollected: number }>()

  for (const c of claims) {
    const d = new Date(c.serviceDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) monthMap.set(key, { billed: 0, insurancePaid: 0, patientCollected: 0 })
    const m = monthMap.get(key)!
    m.billed += Number(c.totalCharge)
    m.insurancePaid += Number(c.statement?.insurancePaid ?? 0)
    m.patientCollected += Number(c.statement?.patientPaid ?? 0)
  }

  const monthlyRevenue = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => {
      const [year, month] = key.split("-")
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString("default", { month: "short", year: "2-digit" })
      return { month: label, ...vals }
    })

  // ── Claim status breakdown ───────────────────────────────────────────────────
  const statusMap = new Map<string, { count: number; amount: number }>()
  for (const c of claims) {
    if (!statusMap.has(c.claimStatus)) statusMap.set(c.claimStatus, { count: 0, amount: 0 })
    const s = statusMap.get(c.claimStatus)!
    s.count++
    s.amount += Number(c.totalCharge)
  }
  const claimsByStatus = Array.from(statusMap.entries()).map(([status, vals]) => ({ status, ...vals }))

  // ── AR aging (outstanding statements) ───────────────────────────────────────
  const now = Date.now()
  const aging = { "0–30 days": { count: 0, amount: 0 }, "31–60 days": { count: 0, amount: 0 }, "61–90 days": { count: 0, amount: 0 }, "90+ days": { count: 0, amount: 0 } }
  for (const s of statements) {
    const bal = Number(s.balanceDue)
    if (bal <= 0) continue
    const ageDays = Math.floor((now - new Date(s.createdAt).getTime()) / 86400000)
    const bucket = ageDays <= 30 ? "0–30 days" : ageDays <= 60 ? "31–60 days" : ageDays <= 90 ? "61–90 days" : "90+ days"
    aging[bucket].count++
    aging[bucket].amount += bal
  }
  const arAging = Object.entries(aging).map(([bucket, vals]) => ({ bucket, ...vals }))

  // ── By payer ────────────────────────────────────────────────────────────────
  const payerMap = new Map<string, { claimCount: number; billed: number; insurancePaid: number; patientPaid: number }>()
  for (const c of claims) {
    const payer = c.patient.payerName || "Unknown"
    if (!payerMap.has(payer)) payerMap.set(payer, { claimCount: 0, billed: 0, insurancePaid: 0, patientPaid: 0 })
    const p = payerMap.get(payer)!
    p.claimCount++
    p.billed += Number(c.totalCharge)
    p.insurancePaid += Number(c.statement?.insurancePaid ?? 0)
    p.patientPaid += Number(c.statement?.patientPaid ?? 0)
  }
  const byPayer = Array.from(payerMap.entries())
    .map(([payerName, vals]) => ({
      payerName,
      claimCount: vals.claimCount,
      billed: vals.billed,
      collected: vals.insurancePaid + vals.patientPaid,
      collectionRate: vals.billed > 0 ? Math.round(((vals.insurancePaid + vals.patientPaid) / vals.billed) * 100) : 0,
    }))
    .sort((a, b) => b.billed - a.billed)

  // ── By provider ─────────────────────────────────────────────────────────────
  const provMap = new Map<string, { claimCount: number; billed: number; insurancePaid: number; patientPaid: number }>()
  for (const c of claims) {
    const name = `${c.provider.firstName} ${c.provider.lastName}`
    if (!provMap.has(name)) provMap.set(name, { claimCount: 0, billed: 0, insurancePaid: 0, patientPaid: 0 })
    const p = provMap.get(name)!
    p.claimCount++
    p.billed += Number(c.totalCharge)
    p.insurancePaid += Number(c.statement?.insurancePaid ?? 0)
    p.patientPaid += Number(c.statement?.patientPaid ?? 0)
  }
  const byProvider = Array.from(provMap.entries())
    .map(([name, vals]) => ({
      name,
      claimCount: vals.claimCount,
      billed: vals.billed,
      collected: vals.insurancePaid + vals.patientPaid,
      collectionRate: vals.billed > 0 ? Math.round(((vals.insurancePaid + vals.patientPaid) / vals.billed) * 100) : 0,
    }))
    .sort((a, b) => b.billed - a.billed)

  return NextResponse.json({
    summary: { totalBilled, insurancePaid, patientCollected, totalCollected, collectionRate, openDenials, denialRate, avgDaysToPayment },
    monthlyRevenue,
    claimsByStatus,
    arAging,
    byPayer,
    byProvider,
  })
}
