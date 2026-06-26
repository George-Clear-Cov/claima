import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const CHRONIC_CONDITIONS: { name: string; prefixes: string[] }[] = [
  { name: "Type 2 Diabetes", prefixes: ["E11", "E13"] },
  { name: "Type 1 Diabetes", prefixes: ["E10"] },
  { name: "Hypertension", prefixes: ["I10", "I11", "I12", "I13"] },
  { name: "Heart Failure", prefixes: ["I50"] },
  { name: "COPD", prefixes: ["J44"] },
  { name: "Atrial Fibrillation", prefixes: ["I48"] },
  { name: "Chronic Kidney Disease", prefixes: ["N18"] },
  { name: "Coronary Artery Disease", prefixes: ["I25"] },
  { name: "Asthma (persistent)", prefixes: ["J45"] },
  { name: "Depression", prefixes: ["F32", "F33"] },
  { name: "Anxiety Disorder", prefixes: ["F41"] },
  { name: "Obesity", prefixes: ["E66"] },
  { name: "Hyperlipidemia", prefixes: ["E78"] },
  { name: "Hypothyroidism", prefixes: ["E03"] },
  { name: "Osteoarthritis", prefixes: ["M15", "M16", "M17", "M18", "M19"] },
  { name: "Osteoporosis", prefixes: ["M80", "M81"] },
  { name: "Rheumatoid Arthritis", prefixes: ["M05", "M06"] },
  { name: "GERD", prefixes: ["K21"] },
  { name: "Cerebrovascular Disease", prefixes: ["I63", "G45", "I65", "I66"] },
  { name: "Peripheral Artery Disease", prefixes: ["I70", "I73"] },
]

function detectChronicConditions(icd10Codes: string[]): string[] {
  const matched: string[] = []
  for (const cond of CHRONIC_CONDITIONS) {
    const hit = icd10Codes.some((code) =>
      cond.prefixes.some((prefix) => code.startsWith(prefix))
    )
    if (hit) matched.push(cond.name)
  }
  return matched
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  logAudit({ action: "ccm.eligible.view", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })

  const { prisma } = await import("@/lib/prisma")

  const patients = await prisma.patient.findMany({
    where: { practiceId: session.practiceId },
    include: {
      claims: {
        include: { lineItems: { select: { icd10Codes: true } } },
        where: { claimStatus: { not: "DRAFT" } },
      },
    },
    orderBy: { lastName: "asc" },
  })

  const results = patients.map((p) => {
    const allCodes = Array.from(
      new Set(p.claims.flatMap((c) => c.lineItems.flatMap((li) => li.icd10Codes)))
    )
    const conditions = detectChronicConditions(allCodes)
    const isMedicare = p.payerName.toLowerCase().includes("medicare")
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      dob: p.dob,
      payerId: p.payerId,
      payerName: p.payerName,
      isMedicare,
      ccmEnrolled: p.ccmEnrolled,
      ccmEnrolledAt: p.ccmEnrolledAt,
      ccmConsentedAt: p.ccmConsentedAt,
      conditions,
      eligibleConditionCount: conditions.length,
      eligible: conditions.length >= 2,
    }
  })

  return NextResponse.json(results)
}
