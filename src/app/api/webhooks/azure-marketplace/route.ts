import { NextRequest, NextResponse } from "next/server"
import { acknowledgeOperation } from "@/lib/azure-marketplace"

/**
 * POST /api/webhooks/azure-marketplace
 * Receives operation notifications from Microsoft Azure Marketplace.
 * Microsoft sends: ChangePlan, ChangeQuantity, Suspend, Reinstate, Unsubscribe
 *
 * IMPORTANT: Acknowledge within 10 seconds or Microsoft will retry and eventually
 * block the subscription. We ack immediately then process async.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    id: operationId,
    subscriptionId,
    action,
    planId,
    quantity,
    status,
  } = body as {
    id: string
    subscriptionId: string
    action: string
    planId?: string
    quantity?: number
    status?: string
  }

  if (!operationId || !subscriptionId) {
    return NextResponse.json({ error: "Missing operationId or subscriptionId" }, { status: 400 })
  }

  // Process async — ack first, then update DB
  void processAzureWebhook({ operationId, subscriptionId, action, planId, quantity, status })

  // Azure requires a 200 within 10 seconds
  return NextResponse.json({ ok: true })
}

async function processAzureWebhook(params: {
  operationId: string
  subscriptionId: string
  action: string
  planId?: string
  quantity?: number
  status?: string
}): Promise<void> {
  const { operationId, subscriptionId, action, planId, quantity } = params

  try {
    const { prisma } = await import("@/lib/prisma")

    switch (action) {
      case "ChangePlan":
      case "ChangeQuantity":
        await prisma.marketplaceSubscription.updateMany({
          where: { marketplace: "azure", externalId: subscriptionId },
          data: {
            ...(planId ? { planId } : {}),
            ...(quantity !== undefined ? { quantity } : {}),
            updatedAt: new Date(),
          },
        })
        await acknowledgeOperation(subscriptionId, operationId, "Success", planId, quantity)
        break

      case "Suspend":
        await prisma.marketplaceSubscription.updateMany({
          where: { marketplace: "azure", externalId: subscriptionId },
          data: { status: "suspended", updatedAt: new Date() },
        })
        await acknowledgeOperation(subscriptionId, operationId, "Success")
        break

      case "Reinstate":
        await prisma.marketplaceSubscription.updateMany({
          where: { marketplace: "azure", externalId: subscriptionId },
          data: { status: "active", updatedAt: new Date() },
        })
        await acknowledgeOperation(subscriptionId, operationId, "Success")
        break

      case "Unsubscribe":
        await prisma.marketplaceSubscription.updateMany({
          where: { marketplace: "azure", externalId: subscriptionId },
          data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() },
        })
        await acknowledgeOperation(subscriptionId, operationId, "Success")
        break

      default:
        console.warn(`[azure-marketplace/webhook] Unknown action: ${action}`)
        await acknowledgeOperation(subscriptionId, operationId, "Failure")
    }
  } catch (err) {
    console.error("[azure-marketplace/webhook] Error:", err)
    try {
      await acknowledgeOperation(subscriptionId, operationId, "Failure")
    } catch {
      // best-effort ack
    }
  }
}
