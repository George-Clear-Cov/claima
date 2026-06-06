import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { stripe } from "@/lib/stripe"

const schema = z.object({
  amount: z.number().positive(),       // dollars
  statementId: z.string(),
  patientName: z.string(),
  claimId: z.string(),
  practiceId: z.string().uuid().optional(),
})

// POST /api/payments — create Stripe PaymentIntent via Connect
// Money flows: patient → practice's Stripe account, MediBill takes platform fee
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = schema.parse(body)

    if (!stripe) {
      // Demo mode — no Stripe key
      return NextResponse.json({
        clientSecret: null,
        mock: true,
        amount: input.amount,
        message: "Payment recorded (demo mode — add STRIPE_SECRET_KEY to go live)",
      })
    }

    const amountCents = Math.round(input.amount * 100)
    let connectedAccountId: string | undefined
    let platformFeeCents = 0

    // Look up practice's connected account + fee %
    if (input.practiceId) {
      const { prisma } = await import("@/lib/prisma")
      const practice = await prisma.practice.findUnique({ where: { id: input.practiceId } })
      if (practice?.stripeAccountId && practice.stripeOnboarded) {
        connectedAccountId = practice.stripeAccountId
        platformFeeCents = Math.round(amountCents * (practice.platformFeePercent / 100))
      }
    }

    const paymentIntentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `MediBill patient copay — ${input.claimId}`,
      metadata: {
        statementId: input.statementId,
        patientName: input.patientName,
        claimId: input.claimId,
        practiceId: input.practiceId ?? "",
      },
    }

    if (connectedAccountId) {
      // Connect: charge on behalf of practice, MediBill collects platform fee
      paymentIntentParams.application_fee_amount = platformFeeCents
      paymentIntentParams.transfer_data = { destination: connectedAccountId }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: input.amount,
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
