import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// Industry benchmark figures (standard RCM averages)
const BENCHMARKS = {
  collectionRate:  85,   // % — industry average
  denialRate:      10,   // % — industry average first-pass denial rate
  daysToPayment:   30,   // days — average commercial payer
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get("from")
  const toParam   = searchParams.get("to")
  const to   = toParam   ? new Date(toParam)   : new Date()
  const from = fromParam ? new Date(fromParam)  : new Date(to.getFullYear() - 1, to.getMonth(), 1)
  to.setHours(23, 59, 59, 999)

  const { prisma } = await import("@/lib/prisma")
  const practiceId = session.practiceId

  const [claims, denials, eras] = await Promise.all([
    prisma.claim.findMany({
      where: { practiceId, serviceDate: { gte: from, lte: to } },
      select: {
        id: true,
        claimStatus: true,
        totalCharge: true,
        paidAmount: true,
        submittedAt: true,
        paidAt: true,
        serviceDate: true,
        patient: { select: { payerId: true, payerName: true } },
        statement: { select: { insurancePaid: true, adjustments: true, balanceDue: true } },
        denial: { select: { carcCode: true, denialReason: true, category: true } },
      },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId, serviceDate: { gte: from, lte: to } } },
      select: {
        carcCode: true,
        denialReason: true,
        category: true,
        appealStatus: true,
        claim: { select: { patient: { select: { payerId: true, payerName: true } } } },
      },
    }),
    prisma.eRA.findMany({
      where: { practiceId, createdAt: { gte: from, lte: to } },
      select: { payerId: true, payerName: true, chargeAmount: true, insurancePaid: true, adjustments: true },
    }),
  ])

  // ── Per-payer aggregation ────────────────────────────────────────────────────
  interface PayerBucket {
    payerId: string
    payerName: string
    totalClaims: number
    billed: number
    paid: number
    openAR: number
    adjustments: number
    deniedCount: number
    submittedCount: number   // submitted+accepted+denied+paid (non-draft)
    paidDays: number[]       // days from submission to payment
    topCarcCodes: Map<string, { count: number; reason: string; category: string }>
    monthlyData: Map<string, { claims: number; billed: number; paid: number; denied: number }>
  }

  const payerMap = new Map<string, PayerBucket>()

  const getOrCreate = (payerId: string, payerName: string): PayerBucket => {
    const key = payerId || payerName
    if (!payerMap.has(key)) {
      payerMap.set(key, {
        payerId, payerName: payerName || "Unknown",
        totalClaims: 0, billed: 0, paid: 0, openAR: 0,
        adjustments: 0, deniedCount: 0, submittedCount: 0,
        paidDays: [],
        topCarcCodes: new Map(),
        monthlyData: new Map(),
      })
    }
    return payerMap.get(key)!
  }

  for (const claim of claims) {
    const { payerId, payerName } = claim.patient
    const b = getOrCreate(payerId, payerName)
    b.totalClaims++
    b.billed += Number(claim.totalCharge)

    const d = new Date(claim.serviceDate)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!b.monthlyData.has(monthKey)) b.monthlyData.set(monthKey, { claims: 0, billed: 0, paid: 0, denied: 0 })
    const m = b.monthlyData.get(monthKey)!
    m.claims++
    m.billed += Number(claim.totalCharge)

    if (claim.claimStatus !== "DRAFT") {
      b.submittedCount++
    }

    if (claim.claimStatus === "DENIED") {
      b.deniedCount++
      m.denied++
    }

    if (claim.claimStatus === "PAID") {
      const paid = Number(claim.statement?.insurancePaid ?? claim.paidAmount ?? 0)
      b.paid += paid
      m.paid += paid
      b.adjustments += Number(claim.statement?.adjustments ?? 0)
      if (claim.paidAt && claim.submittedAt) {
        const days = (new Date(claim.paidAt).getTime() - new Date(claim.submittedAt).getTime()) / 86400000
        if (days >= 0) b.paidDays.push(days)
      }
    }

    // Open AR: submitted/accepted claims with a balance
    if (["SUBMITTED", "ACCEPTED"].includes(claim.claimStatus)) {
      b.openAR += Number(claim.totalCharge)
    }

    // CARC codes from denial
    if (claim.denial) {
      const { carcCode, denialReason, category } = claim.denial
      if (!b.topCarcCodes.has(carcCode)) b.topCarcCodes.set(carcCode, { count: 0, reason: denialReason, category })
      b.topCarcCodes.get(carcCode)!.count++
    }
  }

  // Also aggregate ERA adjustments per payer (for adjustment rate)
  const eraByPayer = new Map<string, { totalCharge: number; paid: number; adjustments: number }>()
  for (const era of eras) {
    const key = era.payerId || era.payerName
    if (!eraByPayer.has(key)) eraByPayer.set(key, { totalCharge: 0, paid: 0, adjustments: 0 })
    const e = eraByPayer.get(key)!
    e.totalCharge  += Number(era.chargeAmount ?? 0)
    e.paid         += Number(era.insurancePaid)
    e.adjustments  += Number(era.adjustments)
  }

  // ── Build output ─────────────────────────────────────────────────────────────
  const totalBilledAll = Array.from(payerMap.values()).reduce((s, b) => s + b.billed, 0)

  const payers = Array.from(payerMap.values()).map((b) => {
    const eraKey = b.payerId || b.payerName
    const era = eraByPayer.get(eraKey)
    const adjustmentRate = era && era.totalCharge > 0
      ? Math.round((era.adjustments / era.totalCharge) * 100)
      : null

    const collectionRate = b.billed > 0 ? Math.round((b.paid / b.billed) * 100) : 0
    const denialRate     = b.submittedCount > 0 ? Math.round((b.deniedCount / b.submittedCount) * 100) : 0
    const avgDaysToPayment = b.paidDays.length > 0
      ? Math.round(b.paidDays.reduce((s, d) => s + d, 0) / b.paidDays.length)
      : null

    const topCarcCodes = Array.from(b.topCarcCodes.entries())
      .map(([code, { count, reason, category }]) => ({ code, count, reason, category }))
      .sort((a, c) => c.count - a.count)
      .slice(0, 5)

    const monthlyTrend = Array.from(b.monthlyData.entries())
      .sort(([a], [c]) => a.localeCompare(c))
      .map(([key, vals]) => {
        const [year, month] = key.split("-")
        return {
          month: new Date(Number(year), Number(month) - 1, 1).toLocaleString("default", { month: "short", year: "2-digit" }),
          ...vals,
        }
      })

    const vsCollectionRate  = collectionRate  - BENCHMARKS.collectionRate
    const vsDenialRate      = BENCHMARKS.denialRate - denialRate // positive = better than benchmark
    const vsDaysToPayment   = avgDaysToPayment !== null ? BENCHMARKS.daysToPayment - avgDaysToPayment : null

    return {
      payerId: b.payerId,
      payerName: b.payerName,
      totalClaims: b.totalClaims,
      submittedClaims: b.submittedCount,
      deniedClaims: b.deniedCount,
      billed: b.billed,
      paid: b.paid,
      openAR: b.openAR,
      adjustments: b.adjustments,
      adjustmentRate,
      collectionRate,
      denialRate,
      avgDaysToPayment,
      payerMix: totalBilledAll > 0 ? Math.round((b.billed / totalBilledAll) * 100) : 0,
      benchmarks: {
        collectionRateDelta: vsCollectionRate,   // positive = above benchmark
        denialRateDelta: vsDenialRate,           // positive = better than benchmark
        daysToPaymentDelta: vsDaysToPayment,     // positive = faster than benchmark
      },
      topCarcCodes,
      monthlyTrend,
    }
  }).sort((a, b) => b.billed - a.billed)

  const totalBilled    = payers.reduce((s, p) => s + p.billed, 0)
  const totalPaid      = payers.reduce((s, p) => s + p.paid, 0)
  const totalOpenAR    = payers.reduce((s, p) => s + p.openAR, 0)
  const totalDenied    = payers.reduce((s, p) => s + p.deniedClaims, 0)
  const totalSubmitted = payers.reduce((s, p) => s + p.submittedClaims, 0)

  const allDays = payers.flatMap((p) => (p.avgDaysToPayment ? [p.avgDaysToPayment] : []))
  const avgDaysToPaymentOverall = allDays.length > 0 ? Math.round(allDays.reduce((s, d) => s + d, 0) / allDays.length) : null

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    benchmarks: BENCHMARKS,
    summary: {
      totalBilled,
      totalPaid,
      totalOpenAR,
      overallCollectionRate:  totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0,
      overallDenialRate:      totalSubmitted > 0 ? Math.round((totalDenied / totalSubmitted) * 100) : 0,
      avgDaysToPaymentOverall,
      payerCount: payers.length,
    },
    payers,
  })
}
