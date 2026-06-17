import { NextResponse } from "next/server"
import { stripeClient } from "@/lib/stripe"

// GET /api/store/products — public endpoint, no auth required
// Returns ALL active products across all connected accounts so any visitor
// can browse the storefront and purchase without logging in.
export async function GET() {
  if (!stripeClient) return NextResponse.json([])

  try {
    const products = await stripeClient.products.list({
      active: true,
      expand: ["data.default_price"],
      limit: 100,
    })

    // Only return products that are linked to a connected account —
    // unlinked platform products are not for sale in the public storefront.
    const storeProducts = products.data.filter((p) => !!p.metadata?.connectedAccountId)

    return NextResponse.json(storeProducts)
  } catch (err) {
    console.error("Store product list failed:", err)
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 })
  }
}
