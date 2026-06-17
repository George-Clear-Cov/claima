import { NextRequest, NextResponse } from "next/server"
import { resolveSubscription, activateSubscription } from "@/lib/azure-marketplace"

/**
 * POST /api/marketplace/azure/activate
 * Called by the Azure Marketplace landing page with the marketplace token.
 * Resolves the token → subscription details, activates it, stores in DB.
 */
export async function POST(req: NextRequest) {
  const { marketplaceToken } = await req.json()

  if (!marketplaceToken) {
    return NextResponse.json({ error: "marketplaceToken required" }, { status: 400 })
  }

  try {
    const azureSub = await resolveSubscription(marketplaceToken)

    const { prisma } = await import("@/lib/prisma")

    const sub = await prisma.marketplaceSubscription.upsert({
      where: { externalId: azureSub.id },
      create: {
        marketplace: "azure",
        externalId: azureSub.id,
        planId: azureSub.planId,
        status: "pending",
        rawPayload: azureSub as unknown as object,
      },
      update: {
        planId: azureSub.planId,
        status: "pending",
        rawPayload: azureSub as unknown as object,
        updatedAt: new Date(),
      },
    })

    // Activate the subscription with Microsoft
    await activateSubscription(azureSub.id, azureSub.planId, azureSub.quantity ?? 1)

    // Mark as active
    await prisma.marketplaceSubscription.update({
      where: { id: sub.id },
      data: { status: "active", activatedAt: new Date() },
    })

    return NextResponse.json({
      ok: true,
      subscriptionId: sub.id,
      azureSubscriptionId: azureSub.id,
      planId: azureSub.planId,
      purchaserEmail: azureSub.subscription?.purchaser?.emailId,
      beneficiaryEmail: azureSub.subscription?.beneficiary?.emailId,
    })
  } catch (err) {
    console.error("[marketplace/azure/activate]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Activation failed" },
      { status: 500 },
    )
  }
}
