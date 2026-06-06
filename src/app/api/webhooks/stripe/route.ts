import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

// Stripe requires the raw body for signature verification — disable body parsing
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const stripeClient = new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  let event: Stripe.Event

  if (webhookSecret && sig) {
    try {
      event = stripeClient.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  } else {
    // No webhook secret configured — accept unsigned (dev only)
    try {
      event = JSON.parse(body) as Stripe.Event
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
  }

  if (!process.env.DATABASE_URL) {
    // Acknowledge receipt but can't update DB
    return NextResponse.json({ received: true })
  }

  const { prisma } = await import("@/lib/prisma")

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent
        const statementId = intent.metadata?.statementId
        const amountPaid = intent.amount_received / 100 // cents → dollars

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
        // Log for visibility but no state change needed — statement stays PENDING/PARTIAL
        const intent = event.data.object as Stripe.PaymentIntent
        console.warn("Payment failed for statement:", intent.metadata?.statementId, "reason:", intent.last_payment_error?.message)
        break
      }

      case "account.updated": {
        // Stripe Connect onboarding completed or details changed
        const account = event.data.object as Stripe.Account
        if (account.details_submitted && account.charges_enabled) {
          await prisma.practice.updateMany({
            where: { stripeAccountId: account.id },
            data: { stripeOnboarded: true },
          })
        }
        break
      }

      case "account.application.deauthorized": {
        // Practice disconnected from Stripe Connect
        const deauth = event.data.object as { id: string }
        await prisma.practice.updateMany({
          where: { stripeAccountId: deauth.id },
          data: { stripeOnboarded: false, stripeAccountId: null },
        })
        break
      }

      default:
        // Unhandled event — acknowledge receipt
        break
    }
  } catch (err) {
    console.error("Webhook handler error:", err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
