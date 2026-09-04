/**
 * Claim.MD auth smoke test — READ-ONLY.
 *
 * Calls POST /services/payerlist/ (a harmless payer-directory lookup) to confirm
 * your AccountKey authenticates against Claim.MD. It does NOT submit claims,
 * pull ERA, or touch any PHI — safe to run against the live account.
 *
 * Run:  ~/.bun/bin/bun scripts/claimmd-smoke.ts
 * (Bun auto-loads .env.local, so CLAIMMD_ACCOUNT_KEY is picked up automatically.)
 */

const KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const BASE = "https://svc.claim.md/services"

async function main() {
  if (!KEY) {
    console.error("✗ CLAIMMD_ACCOUNT_KEY is not set (checked env + .env.local).")
    console.error("  Add it to .env.local, then re-run.")
    process.exit(1)
  }
  console.log(`→ Testing Claim.MD auth with key ending …${KEY.slice(-4)}`)

  let res: Response
  try {
    res = await fetch(`${BASE}/payerlist/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ AccountKey: KEY, payer_name: "aetna" }),
    })
  } catch (err) {
    console.error("✗ Network error reaching Claim.MD:", err instanceof Error ? err.message : err)
    process.exit(2)
  }

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  console.log(`← HTTP ${res.status}`)

  // Claim.MD often returns 200 with an error field rather than a 401, so check both.
  const looksAuthError =
    res.status === 401 ||
    res.status === 403 ||
    /invalid.*(account|key)|not.*authoriz|\bauth\b.*fail/i.test(text)

  if (!res.ok || looksAuthError) {
    console.error("✗ Auth or request failed. Response (truncated):")
    const preview = typeof data === "string" ? data : JSON.stringify(data, null, 2)
    console.error(preview.slice(0, 600))
    process.exit(3)
  }

  const rec = data as Record<string, unknown>
  const payers = Array.isArray(rec?.payer) ? rec.payer : rec?.payer ? [rec.payer] : []
  console.log(`✓ Key authenticates. payerlist returned ${payers.length || "some"} payer record(s).`)
  console.log("  Claim.MD is reachable and your AccountKey is valid. (No claims or PHI touched.)")
}

main()

export {}
