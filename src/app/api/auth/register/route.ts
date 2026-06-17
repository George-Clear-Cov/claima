import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { v4 as uuid } from "uuid"
import { signToken, COOKIE_NAME } from "@/lib/auth"
import { validatePassword } from "@/lib/password"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, practiceName, baaAccepted } = await req.json()

    if (!name || !email || !password || !practiceName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (!baaAccepted) {
      return NextResponse.json({ error: "You must accept the Business Associate Agreement to create an account" }, { status: 400 })
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Password requirements not met: ${pwCheck.errors.join(", ")}` }, { status: 400 })
    }

    const { prisma } = await import("@/lib/prisma")

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown"

    const hashedPassword = await bcrypt.hash(password, 12)
    const practiceId = uuid()
    const userId = uuid()

    await prisma.$transaction([
      prisma.practice.create({
        data: {
          id: practiceId,
          name: practiceName,
          npi: `PENDING-${practiceId}`,
          taxId: "PENDING",
          taxonomy: "193200000X",
          addressLine1: "PENDING",
          city: "PENDING",
          state: "XX",
          zip: "00000",
          phone: "0000000000",
          baaAcceptedAt: new Date(),
          baaAcceptedIp: ip,
        },
      }),
      prisma.user.create({
        data: {
          id: userId,
          email,
          name,
          hashedPassword,
          practiceId,
          role: "ADMIN",
        },
      }),
    ])

    const token = await signToken({ userId, email, name, practiceId, role: "ADMIN" })

    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return res
  } catch (err) {
    console.error("[register] failed:", err)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
