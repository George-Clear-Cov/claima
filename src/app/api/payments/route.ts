import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { stripe } from "@/lib/stripe"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const schema = z.object({
  statementId: z.string(),
})

// POST /api/payments — create Stripe PaymentIntent via Connect.
// The statement is verified against the session's practice, and the charge
// amount + patient name are derived from the DB — never trusted from the client.
// Money flows: patient → practice's Stripe account; Claima takes the platform fee.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { statementId } = schema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    // Verify ownership: the statement must belong to the session's practice.
    const statement = await prisma.patientStatement.findFirst({
      where: { id: statementId, patient: { practiceId: session.practiceId } },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        claim: { select: { id: true } },
      },
    })
    if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 })

    const balance = Number(statement.balanceDue)
    if (balance <= 0) return NextResponse.json({ error: "No balance due" }, { status: 400 })

    if (!stripe) {
      return NextResponse.json({
        clientSecret: null,
        mock: true,
        amount: balance,
        message: "Payment recorded (demo mode — add STRIPE_SECRET_KEY to go live)",
      })
    }

    logAudit({ action: "payment.create", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "statement", resourceId: statement.id, req })

    // Amount is derived from the DB balance, NOT the request body.
    const amountCents = Math.round(balance * 100)
    let connectedAccountId: string | undefined
    let platformFeeCents = 0

    const practice = await prisma.practice.findUnique({ where: { id: session.practiceId } })
    if (practice?.stripeAccountId && practice.stripeOnboarded) {
      connectedAccountId = practice.stripeAccountId
      platformFeeCents = Math.round(amountCents * (practice.platformFeePercent / 100))
    }

    const paymentIntentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Patient balance — ${statement.patient.firstName} ${statement.patient.lastName}`,
      metadata: {
        statementId: statement.id,
        practiceId: session.practiceId,
        ...(statement.claim ? { claimId: statement.claim.id } : {}),
      },
    }

    if (connectedAccountId) {
      paymentIntentParams.application_fee_amount = platformFeeCents
      paymentIntentParams.transfer_data = { destination: connectedAccountId }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: balance,
      platformFee: platformFeeCents / 100,
      practiceReceives: (amountCents - platformFeeCents) / 100,
      connected: !!connectedAccountId,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
