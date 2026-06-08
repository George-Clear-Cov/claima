import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { stripe } from "@/lib/stripe"
import { getSessionFromRequest } from "@/lib/auth"

// POST /api/connect — create or resume Stripe Connect onboarding for the current practice
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : undefined
    const practiceId = session.practiceId

    const { prisma } = await import("@/lib/prisma")
    const practice = await prisma.practice.findUniqueOrThrow({ where: { id: practiceId } })

    // Create connected account if not exists
    let accountId = practice.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: undefined, // will be collected during onboarding
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          practiceId,
          practiceName: practice.name,
          npi: practice.npi,
        },
      })
      accountId = account.id
      await prisma.practice.update({
        where: { id: practiceId },
        data: { stripeAccountId: accountId },
      })
    }

    // Generate onboarding link
    const baseUrl = returnUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/refresh?practiceId=${practiceId}`,
      return_url: `${baseUrl}/onboarding/complete?practiceId=${practiceId}`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url, accountId })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to create Connect account" }, { status: 500 })
  }
}

// GET /api/connect — check onboarding status for current practice
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripe) return NextResponse.json({ configured: false })

  const practiceId = session.practiceId

  const { prisma } = await import("@/lib/prisma")
  const practice = await prisma.practice.findUniqueOrThrow({ where: { id: practiceId } })

  if (!practice.stripeAccountId) {
    return NextResponse.json({ status: "not_started", practiceId })
  }

  const account = await stripe.accounts.retrieve(practice.stripeAccountId)
  const onboarded = account.details_submitted && account.charges_enabled

  if (onboarded && !practice.stripeOnboarded) {
    await prisma.practice.update({
      where: { id: practiceId },
      data: { stripeOnboarded: true },
    })
  }

  return NextResponse.json({
    status: onboarded ? "active" : "pending",
    accountId: practice.stripeAccountId,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    platformFeePercent: practice.platformFeePercent,
  })
}
