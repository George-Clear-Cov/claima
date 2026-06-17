import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { stripeClient } from "@/lib/stripe"

const schema = z.object({
  productId: z.string(),
  // Optional: override quantity (defaults to 1)
  quantity: z.number().int().positive().default(1),
})

// POST /api/checkout — create a Stripe Checkout Session using a Destination Charge
//
// Money flow:
//   Customer pays → Stripe holds funds → Claima's application_fee_amount is deducted
//   → Remainder is transferred to the practice's connected account
//
// This is a "destination charge" — the PaymentIntent is created on the platform
// account and Stripe automatically transfers funds to the connected account.
export async function POST(req: NextRequest) {
  if (!stripeClient) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY" }, { status: 503 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  try {
    const body = await req.json()
    const input = schema.parse(body)

    // Fetch the product to get its price and connected account ID
    const product = await stripeClient.products.retrieve(input.productId, {
      expand: ["default_price"],
    })

    const connectedAccountId = product.metadata?.connectedAccountId
    if (!connectedAccountId) {
      return NextResponse.json({ error: "Product is not linked to a connected account" }, { status: 400 })
    }

    const price = product.default_price as { unit_amount: number | null; currency: string; id: string } | null
    if (!price?.unit_amount) {
      return NextResponse.json({ error: "Product has no price configured" }, { status: 400 })
    }

    const totalAmount = price.unit_amount * input.quantity

    // Calculate the platform fee — 5% of the total charge
    // Claima keeps this; the rest is transferred to the practice
    const platformFeeCents = Math.round(totalAmount * 0.05)

    // Create a hosted Checkout Session — Stripe renders the payment page for us
    const checkoutSession = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: price.currency,
            unit_amount: price.unit_amount,
            product_data: {
              name: product.name,
              description: product.description ?? undefined,
            },
          },
          quantity: input.quantity,
        },
      ],
      payment_intent_data: {
        // Claima's cut — deducted before transferring to the practice
        application_fee_amount: platformFeeCents,
        // Route the remainder to the practice's connected Stripe account
        transfer_data: {
          destination: connectedAccountId,
        },
        metadata: {
          productId: input.productId,
          connectedAccountId,
        },
      },
      mode: "payment",
      // {CHECKOUT_SESSION_ID} is filled in by Stripe automatically
      success_url: `${baseUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error("Checkout session creation failed:", err)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
