import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { verifyTOTP, generateBackupCodes, normalizeBackupCode } from "@/lib/mfa"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/log"

const schema = z.object({ code: z.string().min(6).max(10) })

// Confirm enrollment: verify a code against the pending secret, then activate MFA and return
// single-use backup codes (shown once; stored bcrypt-hashed).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { code } = schema.parse(await req.json())
    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mfaSecret: true, mfaEnabled: true },
    })
    if (!user?.mfaSecret) return NextResponse.json({ error: "Start MFA setup first." }, { status: 400 })
    if (user.mfaEnabled) return NextResponse.json({ error: "MFA is already enabled." }, { status: 400 })

    if (!verifyTOTP(user.mfaSecret, code)) {
      logAudit({ action: "auth.mfa_enable_failed", userId: session.userId, userEmail: session.email, practiceId: session.practiceId, req })
      return NextResponse.json({ error: "That code didn't match. Check your authenticator app and try again." }, { status: 401 })
    }

    const backupCodes = generateBackupCodes(10)
    const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)))
    await prisma.user.update({
      where: { id: session.userId },
      data: { mfaEnabled: true, mfaBackupCodes: hashes },
    })
    logAudit({ action: "auth.mfa_enabled", userId: session.userId, userEmail: session.email, practiceId: session.practiceId, req })

    return NextResponse.json({ enabled: true, backupCodes })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    logError("mfa-enable", err)
    return NextResponse.json({ error: "Could not enable MFA" }, { status: 500 })
  }
}
