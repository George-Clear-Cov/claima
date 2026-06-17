import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { validatePassword } from "@/lib/password"

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.errors.join(", ") }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: resetToken.email } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  // Mark token used and update password atomically
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword, failedLoginAttempts: 0, lockedUntil: null },
    }),
  ])

  return NextResponse.json({ ok: true })
}
