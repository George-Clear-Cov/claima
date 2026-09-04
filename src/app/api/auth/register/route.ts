import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { v4 as uuid } from "uuid"
import { signToken, COOKIE_NAME, SESSION_MAX_AGE_S } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { validatePassword } from "@/lib/password"
import { logError } from "@/lib/log"
import { parseJson, registerSchema } from "@/lib/validation"
import { issueVerificationCode } from "@/lib/email-verification"

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, registerSchema)
    if (!parsed.ok) return parsed.response
    const { name, email, password, practiceName, baaAccepted, npi, taxId, servicesAgreementAccepted } = parsed.data

    const emailNorm = email.toLowerCase().trim()

    if (!baaAccepted) {
      return NextResponse.json({ error: "You must accept the Business Associate Agreement to create an account" }, { status: 400 })
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: `Password requirements not met: ${pwCheck.errors.join(", ")}` }, { status: 400 })
    }

    const { prisma } = await import("@/lib/prisma")

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
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
          // A real, check-digit-valid NPI when the caller supplied one (self-serve
          // activation requires it). The PENDING sentinel remains for the plain signup
          // page, and is what checkNpis() in the claims route rejects — a practice cannot
          // submit claims until it has a real one.
          npi: npi ?? `PENDING-${practiceId}`,
          taxId: taxId ?? "PENDING",
          taxonomy: "193200000X",
          addressLine1: "PENDING",
          city: "PENDING",
          state: "XX",
          zip: "00000",
          phone: "0000000000",
          baaAcceptedAt: new Date(),
          baaAcceptedIp: ip,
          // Recorded only when actually accepted. The BAA governs data; this is what
          // creates the engagement and the right to be paid, and the two are never
          // inferred from one another.
          servicesAgreementAcceptedAt: servicesAgreementAccepted ? new Date() : null,
          servicesAgreementAcceptedIp: servicesAgreementAccepted ? ip : null,
        },
      }),
      prisma.user.create({
        data: {
          id: userId,
          email: emailNorm,
          name,
          hashedPassword,
          practiceId,
          role: "ADMIN",
        },
      }),
    ])

    // Prove control of the address before the account is allowed to send us PHI. Best
    // effort — a delivery failure must not fail an account that already exists.
    await issueVerificationCode(userId, emailNorm)

    const token = await signToken({ userId, email: emailNorm, name, practiceId, role: "ADMIN" })

    logAudit({ action: "auth.register", practiceId, userId, userEmail: emailNorm, req })

    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_S,
      path: "/",
    })
    return res
  } catch (err) {
    // Practice.npi is unique. A collision means this practice is already registered, which
    // is a legitimate answer to give the caller rather than a 500.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        {
          error: "A practice with this NPI is already registered",
          detail: "Sign in to that account, or use a different NPI if this was a typo.",
        },
        { status: 409 },
      )
    }
    logError("register", err)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
