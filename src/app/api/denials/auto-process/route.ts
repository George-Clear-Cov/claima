import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { generateAppealLetter } from "@/lib/appeal-generator"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const denials = await prisma.denial.findMany({
    where: {
      claim: { practiceId: session.practiceId },
      appealStatus: "PENDING",
      appealLetter: null,
    },
    include: {
      claim: {
        include: {
          patient: true,
          provider: true,
          practice: true,
          lineItems: true,
        },
      },
    },
  })

  if (denials.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  const results = await Promise.all(
    denials.map(async (denial) => {
      try {
        if (!denial.appealable) {
          return {
            id: denial.id,
            patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
            action: denial.category,
            letterGenerated: false,
            note: "Not appealable — biller action required",
          }
        }

        const letter = await generateAppealLetter({
          patientName: `${denial.claim.patient.firstName} ${denial.claim.patient.lastName}`,
          patientDob: denial.claim.patient.dob.toISOString().slice(0, 10),
          memberId: denial.claim.patient.memberId,
          payerName: denial.claim.patient.payerName,
          claimId: denial.claimId,
          serviceDate: denial.claim.serviceDate.toISOString().slice(0, 10),
          cptCodes: denial.claim.lineItems.map((l) => l.cptCode),
          icd10Codes: denial.claim.lineItems.flatMap((l) => l.icd10Codes as string[]),
          totalCharge: Number(denial.claim.totalCharge),
          carcCode: denial.carcCode,
          denialReason: denial.denialReason,
          providerName: `${denial.claim.provider.firstName} ${denial.claim.provider.lastName}`,
          providerNpi: denial.claim.provider.npi,
          practiceName: denial.claim.practice.name,
        })

        await prisma.denial.update({
          where: { id: denial.id },
          data: { appealLetter: letter, appealStatus: "IN_PROGRESS" },
        })

        return {
          id: denial.id,
          patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
          action: "APPEAL",
          letterGenerated: true,
          note: `CARC-${denial.carcCode} appeal letter drafted`,
        }
      } catch (err) {
        return {
          id: denial.id,
          patient: `${denial.claim.patient.lastName}, ${denial.claim.patient.firstName}`,
          action: "ERROR",
          letterGenerated: false,
          note: err instanceof Error ? err.message : "Failed",
        }
      }
    })
  )

  const processed = results.filter((r) => r.action !== "ERROR").length
  return NextResponse.json({ processed, total: denials.length, results })
}
