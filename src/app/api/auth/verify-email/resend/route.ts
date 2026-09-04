import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { issueVerificationCode } from "@/lib/email-verification"

/** POST /api/auth/verify-email/resend — issue a fresh code, invalidating any outstanding one. */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await issueVerificationCode(session.userId, session.email)

  logAudit({
    action: "auth.verify_email.resend",
    practiceId: session.practiceId,
    userId: session.userId,
    userEmail: session.email,
    req,
  })
  return NextResponse.json({ ok: true })
}
