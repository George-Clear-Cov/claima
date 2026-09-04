import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { logAudit } from "@/lib/audit"
import { validatePassword } from "@/lib/password"
import { parseJson, resetPasswordSchema } from "@/lib/validation"

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, resetPasswordSchema)
  if (!parsed.ok) return parsed.response
  const { token, password } = parsed.data

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

  logAudit({ action: "auth.password_reset", practiceId: user.practiceId, userId: user.id, userEmail: user.email, req })

  return NextResponse.json({ ok: true })
}
