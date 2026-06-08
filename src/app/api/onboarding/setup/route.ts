import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { practiceName, npi, taxId, addressLine1, city, state, zip, phone, taxonomy } = body

    if (!practiceName || !npi || !taxId || !addressLine1 || !city || !state || !zip || !phone) {
      return NextResponse.json({ error: "All required fields must be filled in" }, { status: 400 })
    }

    const { prisma } = await import("@/lib/prisma")

    const practice = await prisma.practice.findUnique({ where: { id: session.practiceId } })
    if (!practice) return NextResponse.json({ error: "Practice not found" }, { status: 404 })

    const existingNpi = await prisma.practice.findUnique({ where: { npi } })
    if (existingNpi && existingNpi.id !== session.practiceId) {
      return NextResponse.json({ error: "That NPI is already registered" }, { status: 409 })
    }

    await prisma.practice.update({
      where: { id: session.practiceId },
      data: {
        name: practiceName,
        npi,
        taxId,
        taxonomy: taxonomy || "193200000X",
        addressLine1,
        city,
        state,
        zip,
        phone,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[onboarding/setup] failed:", err)
    return NextResponse.json({ error: "Setup failed" }, { status: 500 })
  }
}
