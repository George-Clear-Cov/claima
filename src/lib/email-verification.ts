/**
 * Email verification for self-serve activation.
 *
 * Why this exists: a backlog import is the single largest PHI ingress in the product, and
 * before this gate anyone with a link could create an account and push a practice's entire
 * A/R into it. An unverified email address is an unidentified counterparty — we would be
 * taking on Business Associate obligations for a practice we cannot even contact. Proving
 * control of the address is the cheapest identity signal that meaningfully raises that bar.
 *
 * The code is never stored. Only a SHA-256 hash is persisted, so a database read cannot be
 * replayed to verify someone else's address.
 */
import { createHash, randomInt, timingSafeEqual } from "crypto"
import { sendEmail } from "./email"
import { logError } from "./log"

const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5

export function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex")
}

/** Six digits, uniformly distributed. randomInt is CSPRNG-backed; Math.random is not. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function equal(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Issue a fresh code and email it. Any outstanding codes for the user are consumed first so
 * only the newest one can ever be redeemed.
 *
 * Email delivery failure is logged but not thrown: the account already exists at this point,
 * and failing the whole registration because ACS is down would be worse than letting the user
 * request a resend.
 */
export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const { prisma } = await import("./prisma")
  const code = generateCode()

  await prisma.emailVerificationCode.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  await prisma.emailVerificationCode.create({
    data: {
      userId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  })

  try {
    await sendEmail({
      to: email,
      subject: `${code} is your Claima verification code`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px">
          <p style="font-size:15px;color:#111">Enter this code to finish setting up your Claima account:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0;color:#1D4ED8">${code}</p>
          <p style="font-size:13px;color:#666">The code expires in ${CODE_TTL_MINUTES} minutes.
          If you did not request it, you can ignore this email and no data will be received.</p>
        </div>`,
    })
  } catch (err) {
    logError("email-verification/send", err)
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "mismatch" }

/** Redeem a code. Marks the user verified on success. */
export async function confirmVerificationCode(userId: string, code: string): Promise<VerifyResult> {
  const { prisma } = await import("./prisma")

  const record = await prisma.emailVerificationCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })

  if (!record) return { ok: false, reason: "no_code" }
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" }
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" }

  if (!equal(record.codeHash, hashCode(code))) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, reason: "mismatch" }
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ])

  return { ok: true }
}
