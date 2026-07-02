/**
 * Claim.MD response-shape validation — READ-ONLY.
 * Hits only read endpoints (payerlist, eralist, eradata, response) to inspect the
 * REAL JSON shapes so the parser field mappings in claimmd.ts can be verified.
 * Does NOT submit claims, meter usage, or send eligibility. Safe on any account.
 *
 * Run: ~/.bun/bin/bun scripts/claimmd-validate.ts
 */
const KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const BASE = "https://svc.claim.md/services"

async function call(path: string, params: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ AccountKey: KEY, ...params }),
  })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data, text }
}

function dump(label: string, r: { status: number; data: unknown; text: string }) {
  console.log(`\n===== ${label} (HTTP ${r.status}) =====`)
  if (r.data && typeof r.data === "object") {
    console.log("top-level keys:", Object.keys(r.data as object).join(", ") || "(none)")
  }
  const s = typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2)
  console.log(s.slice(0, 1400))
}

async function main() {
  if (!KEY) {
    console.error("✗ CLAIMMD_ACCOUNT_KEY not set")
    process.exit(1)
  }

  dump("payerlist", await call("/payerlist/", { payer_name: "aetna" }))

  const eralist = await call("/eralist/", { ERAID: "0" })
  dump("eralist", eralist)

  const eras = (eralist.data as { era?: unknown })?.era
  const first = Array.isArray(eras) ? (eras[0] as Record<string, unknown>) : (eras as Record<string, unknown> | undefined)
  const eraId = first?.eraid ?? first?.era_id
  if (eraId) {
    dump(`eradata (eraid=${eraId})`, await call("/eradata/", { eraid: String(eraId) }))
  } else {
    console.log("\n(no ERAs on account yet — eradata field mapping can't be validated until an 835 arrives)")
  }

  dump("response", await call("/response/", { ResponseID: "0" }))
}
main()

export {}
