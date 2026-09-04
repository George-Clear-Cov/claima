import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { setAiPracticeContext } from "@/lib/ai-context"

export const COOKIE_NAME = "claima_session"
// Absolute session window — the server-side backstop to the client idle-timeout in
// SessionTimeout. Sliding: middleware re-issues the token on activity, so an active user is
// never logged out mid-work, while an idle/leaked/copied token expires SESSION_MAX_AGE_S after
// its last use (was a 7-day static token — HIPAA §164.312(a)(2)(iii) automatic logoff).
export const JWT_EXPIRY = "8h"
export const SESSION_MAX_AGE_S = 60 * 60 * 8 // 8h — matches JWT_EXPIRY (used for cookie maxAge)
export const REFRESH_AFTER_S = 5 * 60 // re-issue the sliding token at most once per 5 minutes

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET not set")
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  practiceId: string
  role: string
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifyToken(token)
  if (session?.practiceId) setAiPracticeContext(session.practiceId)
  return session
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifyToken(token)
  if (session?.practiceId) setAiPracticeContext(session.practiceId)
  return session
}

/** Set the signed session cookie on a response (shared by login + MFA-completion routes). */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  })
}

// ── MFA challenge token ──────────────────────────────────────────────────────
// Short-lived, single-purpose token issued after a correct password when MFA is on. It proves
// "password step passed" between the two login calls — it is NOT a session and grants no access.
const MFA_CHALLENGE_EXPIRY = "5m"

export async function signMfaChallenge(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(MFA_CHALLENGE_EXPIRY)
    .sign(getSecret())
}

export async function verifyMfaChallenge(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    if (payload.purpose !== "mfa" || typeof payload.userId !== "string") return null
    return payload.userId
  } catch {
    return null
  }
}
