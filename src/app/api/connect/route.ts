import { NextRequest, NextResponse } from "next/server"
import { stripeClient } from "@/lib/stripe"
import { getSessionFromRequest } from "@/lib/auth"

// POST /api/connect — create or resume Stripe Connect Express onboarding
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripeClient) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to environment variables" }, { status: 503 })
  }

  const { prisma } = await import("@/lib/prisma")
  const practice = await prisma.practice.findUniqueOrThrow({ where: { id: session.practiceId } })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  try {
    let accountId = practice.stripeAccountId

    if (!accountId) {
      const account = await stripeClient.accounts.create({
        type: "express",
        email: session.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      accountId = account.id

      await prisma.practice.update({
        where: { id: session.practiceId },
        data: { stripeAccountId: accountId },
      })
    }

    const accountLink = await stripeClient.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/onboarding?retry=1`,
      return_url: `${baseUrl}/onboarding/complete?accountId=${accountId}`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url, accountId })
  } catch (err: unknown) {
    const stripeErr = err as { message?: string; code?: string; type?: string }
    console.error("Connect account creation failed:", stripeErr)
    return NextResponse.json({
      error: stripeErr?.message ?? "Failed to create Connect account",
    }, { status: 500 })
  }
}

// GET /api/connect — fetch live onboarding status from Stripe
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripeClient) return NextResponse.json({ configured: false, status: "not_configured" })

  const { prisma } = await import("@/lib/prisma")
  const practice = await prisma.practice.findUniqueOrThrow({ where: { id: session.practiceId } })

  if (!practice.stripeAccountId) {
    return NextResponse.json({ status: "not_started" })
  }

  try {
    const account = await stripeClient.accounts.retrieve(practice.stripeAccountId)

    const readyToReceivePayments = account.payouts_enabled === true
    const onboardingComplete = account.details_submitted === true

    if (readyToReceivePayments && !practice.stripeOnboarded) {
      await prisma.practice.update({
        where: { id: session.practiceId },
        data: { stripeOnboarded: true },
      })
    }

    return NextResponse.json({
      status: readyToReceivePayments ? "active" : onboardingComplete ? "pending_capability" : "onboarding_required",
      accountId: practice.stripeAccountId,
      readyToReceivePayments,
      onboardingComplete,
      platformFeePercent: practice.platformFeePercent,
    })
  } catch (err) {
    console.error("Failed to retrieve Connect account:", err)
    return NextResponse.json({ error: "Failed to retrieve account status" }, { status: 500 })
  }
}
