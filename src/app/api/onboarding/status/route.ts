import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// GET /api/onboarding/status — 6-step completion derived from existing data
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const [practice, providerCount, patientCount, claimCount, payerCount] = await Promise.all([
    prisma.practice.findUnique({
      where: { id: session.practiceId },
      select: { npi: true, taxId: true, stripeOnboarded: true },
    }),
    prisma.provider.count({ where: { practiceId: session.practiceId } }),
    prisma.patient.count({ where: { practiceId: session.practiceId } }),
    prisma.claim.count({ where: { practiceId: session.practiceId } }),
    prisma.practicePayerEnrollment.count({ where: { practiceId: session.practiceId } }),
  ])

  const steps = {
    practiceSetup: Boolean(practice?.npi && practice?.taxId),
    stripeConnect: Boolean(practice?.stripeOnboarded),
    payerEnrollment: payerCount > 0,
    firstProvider: providerCount > 0,
    firstPatient: patientCount > 0,
    firstClaim: claimCount > 0,
  }

  const complete = Object.values(steps).every(Boolean)

  return NextResponse.json({ steps, complete })
}
