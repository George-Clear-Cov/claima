import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logError } from "@/lib/log"
import { parseJson, onboardingSetupSchema } from "@/lib/validation"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const parsed = await parseJson(req, onboardingSetupSchema)
    if (!parsed.ok) return parsed.response
    const { practiceName, npi, taxId, addressLine1, city, state, zip, phone, taxonomy } = parsed.data

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
    logError("onboarding/setup", err)
    return NextResponse.json({ error: "Setup failed" }, { status: 500 })
  }
}
