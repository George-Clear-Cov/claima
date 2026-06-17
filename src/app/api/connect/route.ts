import { NextRequest, NextResponse } from "next/server"
import { stripeClient } from "@/lib/stripe"
import { getSessionFromRequest } from "@/lib/auth"

// POST /api/connect — create or resume Stripe Connect onboarding (V2 API)
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
      // Create a V2 connected account where Claima (the platform) is responsible
      // for collecting fees and absorbing losses — practice is the recipient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (stripeClient as any).v2.core.accounts.create({
        display_name: practice.name,
        contact_email: session.email,
        identity: { country: "us" },
        // Express dashboard so the practice can view payouts without a full Stripe account
        dashboard: "express",
        defaults: {
          responsibilities: {
            // Claima collects platform fees and is responsible for disputes/losses
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                // Request the ability to receive transfers from the platform
                stripe_transfers: { requested: true },
              },
            },
          },
        },
      })

      accountId = account.id

      // Store the connected account ID on the practice record
      await prisma.practice.update({
        where: { id: session.practiceId },
        data: { stripeAccountId: accountId },
      })
    }

    // Generate a V2 Account Link — sends the practice through Stripe's hosted onboarding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountLink = await (stripeClient as any).v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          // Only configure the "recipient" (payout) capability — we handle billing
          configurations: ["recipient"],
          // If the session expires, send them back to start onboarding again
          refresh_url: `${baseUrl}/onboarding?retry=1`,
          // On success, send them to the completion page with their account ID
          return_url: `${baseUrl}/onboarding/complete?accountId=${accountId}`,
        },
      },
    })

    return NextResponse.json({ url: accountLink.url, accountId })
  } catch (err) {
    console.error("Connect account creation failed:", err)
    return NextResponse.json({ error: "Failed to create Connect account" }, { status: 500 })
  }
}

// GET /api/connect — fetch live onboarding status from Stripe V2 API
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
    // Fetch the V2 account with recipient config and requirements included
    // Always fetch fresh from Stripe — never rely on cached DB status for UI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = await (stripeClient as any).v2.core.accounts.retrieve(
      practice.stripeAccountId,
      { include: ["configuration.recipient", "requirements"] }
    )

    // The practice can receive payments when stripe_transfers capability is active
    const readyToReceivePayments =
      account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active"

    // Check if there are any outstanding requirements blocking onboarding
    const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status
    const onboardingComplete =
      requirementsStatus !== "currently_due" && requirementsStatus !== "past_due"

    // Sync the DB flag if the practice just completed onboarding
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
      requirementsStatus,
      platformFeePercent: practice.platformFeePercent,
    })
  } catch (err) {
    console.error("Failed to retrieve Connect account:", err)
    return NextResponse.json({ error: "Failed to retrieve account status" }, { status: 500 })
  }
}
