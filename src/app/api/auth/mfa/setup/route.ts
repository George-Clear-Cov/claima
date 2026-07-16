import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { generateSecret, otpauthUri } from "@/lib/mfa"
import { logAudit } from "@/lib/audit"

// Begin TOTP enrollment: generate + store a pending secret and return it (with the otpauth URI) so
// the user can add it to an authenticator app. MFA is NOT active until /enable confirms a code.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { mfaEnabled: true } })
  if (user?.mfaEnabled) {
    return NextResponse.json({ error: "MFA is already enabled. Disable it first to re-enroll." }, { status: 400 })
  }

  const secret = generateSecret()
  await prisma.user.update({ where: { id: session.userId }, data: { mfaSecret: secret } })
  logAudit({ action: "auth.mfa_setup", userId: session.userId, userEmail: session.email, practiceId: session.practiceId, req })

  return NextResponse.json({ secret, otpauthUri: otpauthUri(secret, session.email) })
}
