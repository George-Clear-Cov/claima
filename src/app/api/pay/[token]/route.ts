import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { stripe } from "@/lib/stripe"

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "")
}

async function verifyPaymentToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.type !== "payment_link") return null
    return payload as { statementId: string; practiceId: string; type: string }
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await verifyPaymentToken(token)
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 })

  const { prisma } = await import("@/lib/prisma")

  const statement = await prisma.patientStatement.findFirst({
    where: { id: payload.statementId, patient: { practiceId: payload.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      claim: {
        select: { serviceDate: true, practice: { select: { name: true } } },
      },
    },
  })

  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    statementId: statement.id,
    practiceName: statement.claim.practice.name,
    patientFirstName: statement.patient.firstName,
    balanceDue: Number(statement.balanceDue),
    totalCharge: Number(statement.totalCharge),
    insurancePaid: Number(statement.insurancePaid),
    adjustments: Number(statement.adjustments),
    serviceDate: statement.claim.serviceDate,
    dueDate: statement.dueDate,
    status: statement.statementStatus,
    alreadyPaid: statement.statementStatus === "PAID" || Number(statement.balanceDue) <= 0,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await verifyPaymentToken(token)
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 })

  const { prisma } = await import("@/lib/prisma")

  const statement = await prisma.patientStatement.findFirst({
    where: { id: payload.statementId, patient: { practiceId: payload.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      claim: { select: { id: true, practice: { select: { stripeAccountId: true, stripeOnboarded: true, platformFeePercent: true } } } },
    },
  })

  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (Number(statement.balanceDue) <= 0) {
    return NextResponse.json({ error: "No balance due" }, { status: 400 })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 })
  }

  const amountCents = Math.round(Number(statement.balanceDue) * 100)
  const practice = statement.claim.practice
  let platformFeeCents = 0

  const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: `Patient balance — ${statement.patient.firstName} ${statement.patient.lastName}`,
    metadata: {
      statementId: statement.id,
      claimId: statement.claim.id,
      practiceId: payload.practiceId,
    },
  }

  if (practice.stripeAccountId && practice.stripeOnboarded) {
    platformFeeCents = Math.round(amountCents * (practice.platformFeePercent / 100))
    intentParams.application_fee_amount = platformFeeCents
    intentParams.transfer_data = { destination: practice.stripeAccountId }
  }

  const intent = await stripe.paymentIntents.create(intentParams)

  return NextResponse.json({
    clientSecret: intent.client_secret,
    amount: Number(statement.balanceDue),
    platformFee: platformFeeCents / 100,
  })
}
