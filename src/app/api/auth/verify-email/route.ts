import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { parseJson, verifyEmailSchema } from "@/lib/validation"
import { confirmVerificationCode } from "@/lib/email-verification"

const MESSAGES: Record<string, string> = {
  no_code: "That code has expired or was already used. Request a new one.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many incorrect attempts. Request a new code.",
  mismatch: "That code is not right. Check the email and try again.",
}

/** POST /api/auth/verify-email — redeem the 6-digit code and mark the address verified. */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = await parseJson(req, verifyEmailSchema)
  if (!parsed.ok) return parsed.response

  const result = await confirmVerificationCode(session.userId, parsed.data.code)
  if (!result.ok) {
    logAudit({
      action: "auth.verify_email.failed",
      practiceId: session.practiceId,
      userId: session.userId,
      userEmail: session.email,
      req,
    })
    return NextResponse.json({ error: MESSAGES[result.reason] }, { status: 400 })
  }

  logAudit({
    action: "auth.verify_email",
    practiceId: session.practiceId,
    userId: session.userId,
    userEmail: session.email,
    req,
  })
  return NextResponse.json({ ok: true })
}
