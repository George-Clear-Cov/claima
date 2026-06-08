import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

export interface DenialRiskResult {
  denialRate: number
  sampleSize: number
  topReasons: { reason: string; count: number }[]
  riskLevel: "low" | "moderate" | "high"
  message: string
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ denialRate: 0, sampleSize: 0, topReasons: [], riskLevel: "low", message: "No history yet" })
  }

  const { payerName, cptCode } = await req.json()
  if (!payerName || !cptCode) {
    return NextResponse.json({ error: "payerName and cptCode required" }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")

  const [totalClaims, deniedClaims] = await Promise.all([
    prisma.claim.count({
      where: {
        practiceId: session.practiceId,
        patient: { payerName },
        lineItems: { some: { cptCode } },
        claimStatus: { in: ["PAID", "DENIED", "REJECTED"] },
      },
    }),
    prisma.denial.findMany({
      where: {
        claim: {
          practiceId: session.practiceId,
          patient: { payerName },
          lineItems: { some: { cptCode } },
        },
      },
      select: { denialReason: true, carcCode: true },
    }),
  ])

  if (totalClaims === 0) {
    return NextResponse.json<DenialRiskResult>({
      denialRate: 0,
      sampleSize: 0,
      topReasons: [],
      riskLevel: "low",
      message: `No prior claims for ${payerName} + ${cptCode} in your history`,
    })
  }

  const denialRate = Math.round((deniedClaims.length / totalClaims) * 100)

  const reasonCounts: Record<string, number> = {}
  for (const d of deniedClaims) {
    const key = d.denialReason || `CARC-${d.carcCode}`
    reasonCounts[key] = (reasonCounts[key] ?? 0) + 1
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => ({ reason, count }))

  const riskLevel: DenialRiskResult["riskLevel"] =
    denialRate >= 30 ? "high" : denialRate >= 15 ? "moderate" : "low"

  const message = denialRate === 0
    ? `${payerName} has paid all ${totalClaims} of your ${cptCode} claims`
    : `${payerName} denied ${cptCode} in ${denialRate}% of your ${totalClaims} prior claims`

  return NextResponse.json<DenialRiskResult>({ denialRate, sampleSize: totalClaims, topReasons, riskLevel, message })
}
