import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { stripeClient } from "@/lib/stripe"
import { getSessionFromRequest } from "@/lib/auth"

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  // Price in dollars (we convert to cents for Stripe)
  price: z.number().positive(),
  currency: z.string().length(3).default("usd"),
})

// POST /api/products — create a product at the platform level
// Products are created on the platform account, NOT on the connected account.
// The connected account ID is stored in product metadata so we know where to
// route the payment when a customer buys.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripeClient) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY" }, { status: 503 })
  }

  const { prisma } = await import("@/lib/prisma")
  const practice = await prisma.practice.findUniqueOrThrow({ where: { id: session.practiceId } })

  if (!practice.stripeAccountId) {
    return NextResponse.json({ error: "Complete Stripe onboarding before creating products" }, { status: 400 })
  }

  try {
    const body = await req.json()
    const input = createSchema.parse(body)

    // Create the product on the platform account with a default price.
    // Store the connected account ID in metadata so checkout can route funds correctly.
    const product = await stripeClient.products.create({
      name: input.name,
      description: input.description,
      default_price_data: {
        unit_amount: Math.round(input.price * 100), // convert dollars → cents
        currency: input.currency,
      },
      metadata: {
        // This maps the product back to the practice that should receive payment
        connectedAccountId: practice.stripeAccountId,
        practiceId: session.practiceId,
        practiceName: practice.name,
      },
    })

    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error("Product creation failed:", err)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}

// GET /api/products — list all products for the current practice
// Filters by practiceId in metadata so each practice only sees their own products.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!stripeClient) return NextResponse.json([])

  try {
    // Fetch all active products from the platform account
    const products = await stripeClient.products.list({
      active: true,
      expand: ["data.default_price"], // include price details inline
      limit: 100,
    })

    // Filter to just this practice's products using the metadata we stored
    const practiceProducts = products.data.filter(
      (p) => p.metadata?.practiceId === session.practiceId
    )

    return NextResponse.json(practiceProducts)
  } catch (err) {
    console.error("Product list failed:", err)
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 })
  }
}
