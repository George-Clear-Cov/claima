import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { signToken, COOKIE_NAME } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = schema.parse(body)

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.user.findUnique({
      where: { email },
      include: { practice: { select: { name: true } } },
    })

    if (!user) {
      logAudit({ action: "auth.login_failed", userEmail: email, req })
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Check lockout before password verification
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
      logAudit({ action: "auth.login_blocked", userId: user.id, userEmail: email, practiceId: user.practiceId, req })
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` },
        { status: 429 },
      )
    }

    const valid = await bcrypt.compare(password, user.hashedPassword)

    if (!valid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1
      const lock = attempts >= MAX_ATTEMPTS
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          ...(lock ? { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } : {}),
        },
      })
      logAudit({ action: "auth.login_failed", userId: user.id, userEmail: email, practiceId: user.practiceId, req })
      if (lock) {
        return NextResponse.json(
          { error: "Too many failed attempts. Your account has been locked for 15 minutes." },
          { status: 429 },
        )
      }
      const remaining = MAX_ATTEMPTS - attempts
      return NextResponse.json(
        { error: `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
        { status: 401 },
      )
    }

    // Successful login — reset lockout counters
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      practiceId: user.practiceId,
      role: user.role,
    })

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, practiceName: user.practice.name },
    })

    logAudit({ action: "auth.login", userId: user.id, userEmail: user.email, practiceId: user.practiceId, req })

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    return res
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
