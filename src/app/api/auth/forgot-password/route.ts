import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { sendEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")

  // Always return success even if email not found — prevents user enumeration
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return NextResponse.json({ ok: true })

  // Invalidate any existing unused tokens for this email
  await prisma.passwordResetToken.updateMany({
    where: { email: email.toLowerCase(), usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await prisma.passwordResetToken.create({
    data: { email: email.toLowerCase(), token, expiresAt },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://claima.io"
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  await sendEmail({
    to: email,
    subject: "Reset your Claima password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">Reset your password</div>
        <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:24px">
          We received a request to reset your Claima password. Click the button below to choose a new one.
          This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none">
          Reset password →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
