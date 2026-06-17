import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set — Stripe features will run in demo mode")
}

// Single Stripe client used for ALL requests (never instantiate Stripe elsewhere)
export const stripeClient = process.env.STRIPE_SECRET_KEY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" as any })
  : null

// Backward-compat alias
export const stripe = stripeClient

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
