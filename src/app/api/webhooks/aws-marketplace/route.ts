import { NextRequest, NextResponse } from "next/server"
import { createHash, createVerify } from "crypto"

/**
 * POST /api/webhooks/aws-marketplace
 * Receives SNS notifications from AWS Marketplace for subscription events.
 * AWS sends: subscribe-success, subscribe-fail, unsubscribe-pending, unsubscribe-success
 */

async function verifySNSSignature(message: Record<string, unknown>): Promise<boolean> {
  const certUrl = message.SigningCertURL as string
  if (!certUrl) return false

  let certHostname: string
  try {
    certHostname = new URL(certUrl).hostname
  } catch {
    return false
  }
  if (!certHostname.endsWith(".amazonaws.com")) return false

  try {
    const certRes = await fetch(certUrl)
    if (!certRes.ok) return false
    const cert = await certRes.text()

    const messageType = message.Type as string
    const fields =
      messageType === "SubscriptionConfirmation"
        ? ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]
        : ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"].filter(
            (f) => message[f] !== undefined
          )

    const stringToSign = fields.map((f) => `${f}\n${message[f]}\n`).join("")
    const verifier = createVerify("RSA-SHA1")
    verifier.update(stringToSign)
    return verifier.verify(cert, Buffer.from(message.Signature as string, "base64"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let message: Record<string, unknown>

  try {
    message = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const valid = await verifySNSSignature(message)
  if (!valid) {
    return NextResponse.json({ error: "Invalid SNS signature" }, { status: 403 })
  }

  const messageType = req.headers.get("x-amz-sns-message-type")

  if (messageType === "SubscriptionConfirmation") {
    const subscribeUrl = message.SubscribeURL as string
    if (subscribeUrl) {
      try {
        await fetch(subscribeUrl)
        console.log("[aws-marketplace/webhook] SNS subscription confirmed")
      } catch (err) {
        console.error("[aws-marketplace/webhook] Failed to confirm SNS subscription:", err)
      }
    }
    return NextResponse.json({ ok: true })
  }

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

      void externalId
    } catch (err) {
      console.error("[aws-marketplace/webhook] DB error:", err)
      // Return 200 so AWS doesn't retry — log and investigate separately
    }
  }

  return NextResponse.json({ ok: true })
}
