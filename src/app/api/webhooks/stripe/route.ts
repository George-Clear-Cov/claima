import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  // V2 thin event destinations and V1 webhook endpoints each have their own signing secret.
  // STRIPE_WEBHOOK_SECRET      → V2 event destination (thin events)
  // STRIPE_V1_WEBHOOK_SECRET   → V1 webhook endpoint (payment_intent, checkout.session, etc.)
  const v2WebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const v1WebhookSecret = process.env.STRIPE_V1_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY" }, { status: 503 })
  }

  // Use a local Stripe client here (not the shared singleton) so we can call
  // parseThinEvent which requires a client bound to the same secret key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeClient = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" as any })

  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  // Detect whether this is a V2 thin event or a V1 event by checking the type prefix.
  // V2 thin events have types like "v2.core.account[requirements].updated".
  // V1 events have types like "payment_intent.succeeded".
  let parsedBody: { type?: string; id?: string }
  try {
    parsedBody = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const isV2ThinEvent = typeof parsedBody.type === "string" && parsedBody.type.startsWith("v2.")

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ received: true })
  }

  const { prisma } = await import("@/lib/prisma")

  // ─── V2 Thin Event Handler ───────────────────────────────────────────────
  if (isV2ThinEvent) {
    if (!v2WebhookSecret || !sig) {
      console.warn("V2 webhook received without STRIPE_WEBHOOK_SECRET — skipping verification (dev only)")
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(stripeClient as any).parseThinEvent(body, sig, v2WebhookSecret)
      } catch (err) {
        console.error("V2 webhook signature verification failed:", err)
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
      }
    }

    try {
      // Fetch the full event from Stripe using the thin event's ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = await (stripeClient as any).v2.core.events.retrieve(parsedBody.id)

      switch (event.type) {
        // Fires when a connected account's requirements change (e.g. regulators
        // require additional verification). Use this to prompt re-onboarding.
        case "v2.core.account[requirements].updated": {
          const accountId = event.related_object?.id
          if (accountId) {
            const requirementsStatus =
              event.data?.requirements?.summary?.minimum_deadline?.status
            const hasOutstandingRequirements =
              requirementsStatus === "currently_due" || requirementsStatus === "past_due"

            if (hasOutstandingRequirements) {
              // Flag the practice as needing re-onboarding
              await prisma.practice.updateMany({
                where: { stripeAccountId: accountId },
                data: { stripeOnboarded: false },
              })
            }
          }
          break
        }

        // Fires when a capability status changes on the recipient configuration.
        // Use this to update whether the practice can receive payments.
        case "v2.core.account[.recipient].capability_status_updated": {
          const accountId = event.related_object?.id
          if (accountId) {
            const isActive = event.data?.capability_status === "active"
            await prisma.practice.updateMany({
              where: { stripeAccountId: accountId },
              data: { stripeOnboarded: isActive },
            })
          }
          break
        }

        default:
          break
      }
    } catch (err) {
      console.error("V2 event handler failed:", err)
      return NextResponse.json({ error: "V2 event handler failed" }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  }

  // ─── V1 Event Handler ────────────────────────────────────────────────────
  let event: Stripe.Event

  if (v1WebhookSecret && sig) {
    try {
      event = stripeClient.webhooks.constructEvent(body, sig, v1WebhookSecret)
    } catch (err) {
      console.error("V1 webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  } else {
    // No secret — accept unsigned (dev only)
    try {
      event = parsedBody as Stripe.Event
    } catch {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 })
    }
  }

  try {
    switch (event.type) {
      // Patient successfully paid their copay/balance via Stripe Checkout or PaymentIntent
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent
        const statementId = intent.metadata?.statementId
        const amountPaid = intent.amount_received / 100

        if (statementId && statementId !== "demo") {
          const stmt = await prisma.patientStatement.findUnique({ where: { id: statementId } })
          if (stmt) {
            const newPaid = Number(stmt.patientPaid) + amountPaid
            const newBalance = Math.max(Number(stmt.patientOwes) - newPaid, 0)
            await prisma.patientStatement.update({
              where: { id: statementId },
              data: {
                patientPaid: newPaid,
                balanceDue: newBalance,
                statementStatus: newBalance === 0 ? "PAID" : "PARTIAL",
                paidAt: newBalance === 0 ? new Date() : undefined,
              },
            })
          }
        }
        break
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent
        console.warn(
          "Payment failed — statement:",
          intent.metadata?.statementId,
          "reason:",
          intent.last_payment_error?.message
        )
        break
      }

      // Checkout session completed (used by /api/checkout destination charges)
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        const statementId = checkoutSession.metadata?.statementId
        if (statementId) {
          const amountPaid = (checkoutSession.amount_total ?? 0) / 100
          const stmt = await prisma.patientStatement.findUnique({ where: { id: statementId } })
          if (stmt) {
            const newPaid = Number(stmt.patientPaid) + amountPaid
            const newBalance = Math.max(Number(stmt.patientOwes) - newPaid, 0)
            await prisma.patientStatement.update({
              where: { id: statementId },
              data: {
                patientPaid: newPaid,
                balanceDue: newBalance,
                statementStatus: newBalance === 0 ? "PAID" : "PARTIAL",
                paidAt: newBalance === 0 ? new Date() : undefined,
              },
            })
          }
        }
        break
      }

      // Practice disconnected their Stripe account from Claima
      case "account.application.deauthorized": {
        const deauth = event.data.object as { id: string }
        await prisma.practice.updateMany({
          where: { stripeAccountId: deauth.id },
          data: { stripeOnboarded: false, stripeAccountId: null },
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error("V1 event handler failed:", err)
    return NextResponse.json({ error: "Event handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
