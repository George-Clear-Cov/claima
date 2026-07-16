import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { signToken, setSessionCookie, verifyMfaChallenge } from "@/lib/auth"
import { verifyTOTP, normalizeBackupCode } from "@/lib/mfa"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"

const schema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(1).max(40),
})

// Second step of MFA login: the challenge token proves the password step passed; this verifies a
// TOTP or a single-use backup code, then issues the real session cookie.
export async function POST(req: NextRequest) {
  try {
    const { mfaToken, code } = schema.parse(await req.json())

    const userId = await verifyMfaChallenge(mfaToken)
    if (!userId) {
      return NextResponse.json({ error: "Your verification session expired — please sign in again." }, { status: 401 })
    }

    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { practice: { select: { name: true } } },
    })
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: "MFA is not enabled for this account." }, { status: 400 })
    }

    // 1) TOTP code from the authenticator app.
    let ok = verifyTOTP(user.mfaSecret, code)

    // 2) Otherwise a single-use backup code (bcrypt-hashed; consumed on use).
    if (!ok) {
      const normalized = normalizeBackupCode(code)
      if (normalized.length >= 8) {
        for (const hash of user.mfaBackupCodes) {
          if (await bcrypt.compare(normalized, hash)) {
            ok = true
            await prisma.user.update({
              where: { id: user.id },
              data: { mfaBackupCodes: user.mfaBackupCodes.filter((h) => h !== hash) },
            })
            break
          }
        }
      }
    }

    if (!ok) {
      logAudit({ action: "auth.mfa_failed", userId: user.id, userEmail: user.email, practiceId: user.practiceId, req })
      return NextResponse.json({ error: "Invalid verification code." }, { status: 401 })
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
    setSessionCookie(res, token)
    return res
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    logError("login-mfa", err)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
