import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { verifyTOTP, normalizeBackupCode } from "@/lib/mfa"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"

const schema = z.object({ code: z.string().min(6).max(40) })

// Disable MFA — requires a valid current TOTP or backup code so a hijacked session can't silently
// strip 2FA. Clears the secret and all backup codes.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { code } = schema.parse(await req.json())
    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
    })
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 })
    }

    let ok = verifyTOTP(user.mfaSecret, code)
    if (!ok) {
      const normalized = normalizeBackupCode(code)
      if (normalized.length >= 8) {
        for (const hash of user.mfaBackupCodes) {
          if (await bcrypt.compare(normalized, hash)) {
            ok = true
            break
          }
        }
      }
    }
    if (!ok) {
      logAudit({ action: "auth.mfa_disable_failed", userId: session.userId, userEmail: session.email, practiceId: session.practiceId, req })
      return NextResponse.json({ error: "Invalid verification code." }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    })
    logAudit({ action: "auth.mfa_disabled", userId: session.userId, userEmail: session.email, practiceId: session.practiceId, req })

    return NextResponse.json({ enabled: false })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    logError("mfa-disable", err)
    return NextResponse.json({ error: "Could not disable MFA" }, { status: 500 })
  }
}
