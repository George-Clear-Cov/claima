import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export interface ClaimRisk {
  claimId: string
  risk: "high" | "medium" | "low"
  reason: string
  action: string
  daysPending: number
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json([])

  const { claimIds } = await req.json()
  if (!Array.isArray(claimIds) || claimIds.length === 0) return NextResponse.json([])
  logAudit({ action: "claims.risk_check", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const [claims, denialHistory] = await Promise.all([
    prisma.claim.findMany({
      where: { id: { in: claimIds }, practiceId: session.practiceId },
      select: {
        id: true,
        submittedAt: true,
        claimStatus: true,
        patient: { select: { payerName: true } },
        lineItems: { select: { cptCode: true } },
      },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId: session.practiceId } },
      select: {
        claim: {
          select: {
            patient: { select: { payerName: true } },
            lineItems: { select: { cptCode: true } },
          },
        },
      },
    }),
  ])

  // Build denial frequency map: "Payer:CPT" → count
  const denialMap: Record<string, number> = {}
  for (const d of denialHistory) {
    const payer = d.claim.patient.payerName
    const cpt = d.claim.lineItems[0]?.cptCode ?? ""
    if (payer && cpt) {
      const key = `${payer}:${cpt}`
      denialMap[key] = (denialMap[key] ?? 0) + 1
    }
  }

  const now = Date.now()

  const results: ClaimRisk[] = claims.map((claim) => {
    const daysPending = claim.submittedAt
      ? Math.floor((now - new Date(claim.submittedAt).getTime()) / 86400000)
      : 0
    const payer = claim.patient.payerName
    const cpt = claim.lineItems[0]?.cptCode ?? ""
    const priorDenials = denialMap[`${payer}:${cpt}`] ?? 0

    if (daysPending > 45) {
      return {
        claimId: claim.id,
        risk: "high",
        reason: `${daysPending}d with no response from ${payer}`,
        action: "Call payer to check claim status — possible silent denial",
        daysPending,
      }
    }
    if (daysPending > 30 && priorDenials > 0) {
      return {
        claimId: claim.id,
        risk: "high",
        reason: `${daysPending}d pending + ${payer} denied ${cpt} ${priorDenials}× before`,
        action: "Proactively verify prior auth and confirm claim receipt",
        daysPending,
      }
    }
    if (priorDenials >= 2) {
      return {
        claimId: claim.id,
        risk: "medium",
        reason: `${payer} has denied ${cpt} ${priorDenials}× in your history`,
        action: "Confirm prior auth and validate claim data before deadline",
        daysPending,
      }
    }
    if (daysPending > 21) {
      return {
        claimId: claim.id,
        risk: "medium",
        reason: `${daysPending}d since submission — follow up recommended`,
        action: "Check payer portal for processing status",
        daysPending,
      }
    }
    return {
      claimId: claim.id,
      risk: "low",
      reason: daysPending <= 7 ? "Recently submitted" : `${daysPending}d pending — on track`,
      action: "No action needed yet",
      daysPending,
    }
  })

  return NextResponse.json(results)
}
