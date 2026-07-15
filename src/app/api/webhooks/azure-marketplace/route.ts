import { NextRequest, NextResponse } from "next/server"
import { acknowledgeOperation } from "@/lib/azure-marketplace"
import { parseJson, azureWebhookSchema } from "@/lib/validation"

/**
 * POST /api/webhooks/azure-marketplace
 * Receives operation notifications from Microsoft Azure Marketplace.
 * Microsoft sends: ChangePlan, ChangeQuantity, Suspend, Reinstate, Unsubscribe
 *
 * IMPORTANT: Acknowledge within 10 seconds or Microsoft will retry and eventually
 * block the subscription. We ack immediately then process async.
 */

async function validateAzureWebhookToken(req: NextRequest): Promise<boolean> {
  const tenantId = process.env.AZURE_MARKETPLACE_TENANT_ID
  const clientId = process.env.AZURE_MARKETPLACE_CLIENT_ID
  if (!tenantId || !clientId) {
    // Not yet configured — warn and allow so dev/staging aren't blocked before setup
    console.warn("[azure-marketplace/webhook] Marketplace env vars not set; skipping JWT validation")
    return true
  }

  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return false
  const token = auth.slice(7)

  try {
    const { createRemoteJWKSet, jwtVerify } = await import("jose")
    const JWKS = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    )
    await jwtVerify(token, JWKS, {
      issuer: `https://sts.windows.net/${tenantId}/`,
      audience: clientId,
    })
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!await validateAzureWebhookToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = await parseJson(req, azureWebhookSchema)
  if (!parsed.ok) return parsed.response
  const { id: operationId, subscriptionId, action, planId, quantity, status } = parsed.data

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
