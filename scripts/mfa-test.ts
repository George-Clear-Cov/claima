/**
 * MFA/TOTP test — validates src/lib/mfa.ts against the RFC 6238 known-answer vectors
 * plus drift window, base32 round-trip, and backup codes. No network.
 *
 * Run:  ~/.bun/bin/bun scripts/mfa-test.ts
 */
import {
  base32Encode,
  base32Decode,
  generateSecret,
  currentTOTP,
  verifyTOTP,
  generateBackupCodes,
  normalizeBackupCode,
  otpauthUri,
} from "../src/lib/mfa"

let pass = 0,
  fail = 0
const ok = (n: string, c: boolean) => {
  c ? pass++ : fail++
  console.log(`${c ? "✓" : "✗"} ${n}`)
}

// RFC 6238 Appendix B (SHA-1, secret = ASCII "12345678901234567890"). 8-digit → last 6 digits.
const rfc = base32Encode(Buffer.from("12345678901234567890"))
ok("RFC6238 T=59s → 287082", currentTOTP(rfc, 59 * 1000) === "287082")
ok("RFC6238 T=1111111109 → 081804", currentTOTP(rfc, 1111111109 * 1000) === "081804")
ok("RFC6238 T=1234567890 → 005924", currentTOTP(rfc, 1234567890 * 1000) === "005924")

// base32 round-trip
const b = Buffer.from("hello world totp!")
ok("base32 round-trip", base32Decode(base32Encode(b)).equals(b))

// verify: current passes, malformed fails
const s = generateSecret()
const t = 1700000000000
ok("current code verifies", verifyTOTP(s, currentTOTP(s, t), t))
ok("5-digit / non-digit rejected", !verifyTOTP(s, "12345", t) && !verifyTOTP(s, "abcdef", t))
ok("wrong code rejected", !verifyTOTP(s, "000000", t) || currentTOTP(s, t) === "000000")

// ±1 step drift tolerated, ±3 steps not
ok("prev-step accepted (drift)", verifyTOTP(s, currentTOTP(s, t - 30_000), t))
ok("next-step accepted (drift)", verifyTOTP(s, currentTOTP(s, t + 30_000), t))
ok("3-steps-away rejected", !verifyTOTP(s, currentTOTP(s, t - 90_000), t))

// backup codes
const codes = generateBackupCodes(10)
ok("10 backup codes, correct shape", codes.length === 10 && codes.every((c) => /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c)))
ok("backup codes unique", new Set(codes).size === 10)
ok("normalizeBackupCode strips punctuation/case", normalizeBackupCode("ABcd1-2Ef3g") === "abcd12ef3g")

// otpauth uri
ok("otpauth uri well-formed", otpauthUri(s, "a@b.com").startsWith("otpauth://totp/Claima:a%40b.com?secret="))

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
