import { NextRequest, NextResponse } from "next/server"
import { resolveCustomer } from "@/lib/aws-marketplace"
import { parseJson, awsActivateSchema } from "@/lib/validation"

/**
 * POST /api/marketplace/aws/activate
 * Called by the AWS Marketplace landing page with the registration token.
 * Resolves the token → AWS customer ID, stores subscription, returns account info.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, awsActivateSchema)
  if (!parsed.ok) return parsed.response
  const { registrationToken } = parsed.data

  try {
    const customer = await resolveCustomer(registrationToken)

    const { prisma } = await import("@/lib/prisma")

    // Upsert subscription record
    const sub = await prisma.marketplaceSubscription.upsert({
      where: { externalId: customer.CustomerIdentifier },
      create: {
        marketplace: "aws",
        externalId: customer.CustomerIdentifier,
        productCode: customer.ProductCode,
        status: "pending",
        rawPayload: customer as unknown as object,
      },
      update: {
        status: "pending",
        rawPayload: customer as unknown as object,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      subscriptionId: sub.id,
      customerId: customer.CustomerIdentifier,
      productCode: customer.ProductCode,
    })
  } catch (err) {
    console.error("[marketplace/aws/activate]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Activation failed" },
      { status: 500 },
    )
  }
}
