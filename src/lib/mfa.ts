import { createHmac, randomBytes, timingSafeEqual } from "crypto"

// TOTP multi-factor auth (RFC 6238), implemented with Node crypto — no external dependency.
// SHA-1 / 6 digits / 30s step: the defaults every authenticator app (Google/Microsoft/Authy/1P) uses.

// RFC 4648 base32 alphabet — the shared secret is base32 so it can be typed into any app.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP_S = 30

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** New base32 TOTP secret (160-bit — the authenticator-app standard). */
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

/** HOTP (RFC 4226) for a counter — the building block of TOTP. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac("sha1", secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (bin % 1_000_000).toString().padStart(6, "0")
}

/** The current 6-digit code (tests / display only). */
export function currentTOTP(secretBase32: string, now = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(now / 1000 / STEP_S))
}

/**
 * Verify a 6-digit TOTP against the secret, allowing ±1 step (±30s) for clock drift.
 * Constant-time comparison; `now` is injectable for tests.
 */
export function verifyTOTP(secretBase32: string, token: string, now = Date.now()): boolean {
  const cleaned = (token ?? "").replace(/\s/g, "")
  if (!/^\d{6}$/.test(cleaned)) return false
  const secret = base32Decode(secretBase32)
  if (secret.length === 0) return false
  const counter = Math.floor(now / 1000 / STEP_S)
  const given = Buffer.from(cleaned)
  for (let w = -1; w <= 1; w++) {
    const expected = Buffer.from(hotp(secret, counter + w))
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true
  }
  return false
}

/** otpauth:// URI that authenticator apps scan / import (also shown for manual entry). */
export function otpauthUri(secretBase32: string, account: string, issuer = "Claima"): string {
  // Conventional label form: "Issuer:account" with a literal colon delimiter, each part encoded.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(STEP_S),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** N single-use backup codes in xxxxx-xxxxx form (plaintext — shown to the user once, stored hashed). */
export function generateBackupCodes(n = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    const raw = randomBytes(5).toString("hex") // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

/** Normalize a backup code for comparison (case-insensitive, ignore spaces/dashes). */
export function normalizeBackupCode(code: string): string {
  return (code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
