#!/usr/bin/env bun
/**
 * Creates the Stripe webhook endpoint for claima.io and prints the signing secret.
 *
 * Run once:
 *   STRIPE_SECRET_KEY=sk_live_... bun run scripts/setup-stripe-webhook.ts
 *
 * Then paste the printed STRIPE_WEBHOOK_SECRET into Vercel:
 *   npx vercel env add STRIPE_WEBHOOK_SECRET production
 */

import Stripe from "stripe"

// [PLACEHOLDER] Set STRIPE_SECRET_KEY in your environment before running.
const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  console.error("ERROR: STRIPE_SECRET_KEY is not set.")
  console.error("Run: STRIPE_SECRET_KEY=sk_... bun run scripts/setup-stripe-webhook.ts")
  process.exit(1)
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://claima.io"
const webhookUrl = `${appUrl}/api/webhooks/stripe`

const stripeClient = new Stripe(secretKey)

async function main() {
  console.log(`\nCreating webhook endpoint → ${webhookUrl}\n`)

  // Check if a webhook already exists for this URL so we don't create duplicates.
  const existing = await stripeClient.webhookEndpoints.list({ limit: 100 })
  const duplicate = existing.data.find((w) => w.url === webhookUrl)

  if (duplicate) {
    console.log(`Webhook already exists (${duplicate.id}).`)
    console.log("To rotate the secret, delete it in the Stripe dashboard and re-run this script.")
    process.exit(0)
  }

  // V1 events this endpoint handles
  const v1Events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "checkout.session.completed",
    "account.application.deauthorized",
  ]

  const endpoint = await stripeClient.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: v1Events,
    // V2 thin events are delivered to the same URL but registered separately
    // in the Stripe dashboard under Developers → Webhooks → Connected accounts.
    // See: https://docs.stripe.com/webhooks?snapshot-or-thin=thin
  })

  // The signing secret is only returned once at creation time — save it now.
  const signingSecret = endpoint.secret

  console.log("✓ Webhook endpoint created")
  console.log(`  ID:  ${endpoint.id}`)
  console.log(`  URL: ${endpoint.url}`)
  console.log("")
  console.log("Add this to Vercel (production environment):")
  console.log("")
  console.log(`  STRIPE_WEBHOOK_SECRET=${signingSecret}`)
  console.log("")
  console.log("Or run:")
  console.log(`  npx vercel env add STRIPE_WEBHOOK_SECRET production`)
  console.log("")
  console.log("NOTE: V2 thin events (requirements.updated, capability_status_updated)")
  console.log("must be registered manually in the Stripe dashboard under")
  console.log("Developers → Webhooks → + Add destination → Connected accounts.")
  console.log("Select payload style: Thin, then add both v2 event types.")
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
