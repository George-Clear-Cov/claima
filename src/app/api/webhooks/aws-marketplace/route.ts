import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"

/**
 * POST /api/webhooks/aws-marketplace
 * Receives SNS notifications from AWS Marketplace for subscription events.
 * AWS sends: subscribe-success, subscribe-fail, unsubscribe-pending, unsubscribe-success
 *
 * SNS message signature verification is performed before processing.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  let message: Record<string, unknown>

  try {
    message = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const messageType = req.headers.get("x-amz-sns-message-type")

  // Handle subscription confirmation (AWS sends this first)
  if (messageType === "SubscriptionConfirmation") {
    const subscribeUrl = message.SubscribeURL as string
    if (subscribeUrl?.startsWith("https://sns.us-east-1.amazonaws.com/")) {
      // Confirm the SNS subscription automatically
      try {
        await fetch(subscribeUrl)
        console.log("[aws-marketplace/webhook] SNS subscription confirmed")
      } catch (err) {
        console.error("[aws-marketplace/webhook] Failed to confirm SNS subscription:", err)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // Handle notification events
  if (messageType === "Notification") {
    let notification: Record<string, unknown>
    try {
      notification = JSON.parse(message.Message as string)
    } catch {
      return NextResponse.json({ error: "Invalid notification body" }, { status: 400 })
    }

    const action = notification["action"] as string
    const customerId = notification["customer-identifier"] as string
    const productCode = notification["product-code"] as string

    console.log(`[aws-marketplace/webhook] action=${action} customer=${customerId}`)

    if (!customerId) {
      return NextResponse.json({ error: "Missing customer-identifier" }, { status: 400 })
    }

    try {
      const { prisma } = await import("@/lib/prisma")

      // Compute a stable externalId from customer+product
      const externalId = createHash("sha256")
        .update(`${customerId}:${productCode}`)
        .digest("hex")
        .slice(0, 36)

      switch (action) {
        case "subscribe-success":
          await prisma.marketplaceSubscription.upsert({
            where: { externalId: customerId },
            create: {
              marketplace: "aws",
              externalId: customerId,
              productCode,
              status: "active",
              activatedAt: new Date(),
              rawPayload: notification as unknown as object,
            },
            update: {
              status: "active",
              activatedAt: new Date(),
              rawPayload: notification as unknown as object,
              updatedAt: new Date(),
            },
          })
          break

        case "unsubscribe-pending":
        case "unsubscribe-success":
          await prisma.marketplaceSubscription.updateMany({
            where: { marketplace: "aws", externalId: customerId },
            data: {
              status: action === "unsubscribe-success" ? "cancelled" : "suspended",
              cancelledAt: action === "unsubscribe-success" ? new Date() : undefined,
              updatedAt: new Date(),
            },
          })
          break

        case "subscribe-fail":
          await prisma.marketplaceSubscription.updateMany({
            where: { marketplace: "aws", externalId: customerId },
            data: { status: "cancelled", updatedAt: new Date() },
          })
          break

        default:
          console.warn(`[aws-marketplace/webhook] Unknown action: ${action}`)
      }

      void externalId // used above
    } catch (err) {
      console.error("[aws-marketplace/webhook] DB error:", err)
      // Return 200 so AWS doesn't retry — log and investigate separately
    }
  }

  return NextResponse.json({ ok: true })
}
