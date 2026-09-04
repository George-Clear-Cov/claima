/**
 * athenahealth (athenaOne) PREVIEW sandbox validation.
 *
 * Proves whether the Athenanet.MDP API exposes the data Claima's denial-recovery wedge needs
 * (claims + payment/denial detail), so we can decide native-athenahealth vs. Redox — task #12.
 * No PHI (synthetic preview practice only).
 *
 * Setup — add to .env.local (do NOT commit / do NOT paste in chat):
 *   ATHENA_CLIENT_ID=...
 *   ATHENA_CLIENT_SECRET=...
 *   ATHENA_PRACTICE_ID=195900     # preview practice id — override if 195900 doesn't work for you
 *   # ATHENA_ENV=preview          # or "prod" later
 *
 * Run:  ~/.bun/bin/bun scripts/athenahealth-sandbox-test.ts
 */

const CLIENT_ID = process.env.ATHENA_CLIENT_ID || process.env.ATHENACLIENT_ID || ""
const CLIENT_SECRET = process.env.ATHENA_CLIENT_SECRET || process.env.ATHENACLIENT_SECRET || ""
const PRACTICE_ID = process.env.ATHENA_PRACTICE_ID || "195900" // athenahealth preview practice (override if needed)
const ENVNAME = (process.env.ATHENA_ENV || "preview").toLowerCase()
const HOST =
  ENVNAME === "prod" || ENVNAME === "production"
    ? "https://api.platform.athenahealth.com"
    : "https://api.preview.platform.athenahealth.com"
const SCOPE = process.env.ATHENA_SCOPE || "athena/service/Athenanet.MDP.*"

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("✗ Set ATHENA_CLIENT_ID and ATHENA_CLIENT_SECRET in .env.local first (never paste them in chat).")
  process.exit(1)
}

type Res = { status: number; ok: boolean; body: unknown; url: string }

async function getToken(): Promise<string> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
  const res = await fetch(`${HOST}/oauth2/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`token ${res.status}: ${text.slice(0, 400)}`)
  const json = JSON.parse(text) as { access_token: string; expires_in: number }
  console.log(`✓ token acquired (expires_in=${json.expires_in}s)`)
  return json.access_token
}

async function get(token: string, path: string, query: Record<string, string> = {}): Promise<Res> {
  const qs = new URLSearchParams(query).toString()
  const url = `${HOST}/v1/${PRACTICE_ID}${path}${qs ? `?${qs}` : ""}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body, url }
}

function pickArray(body: unknown): Record<string, unknown>[] | undefined {
  if (Array.isArray(body)) return body as Record<string, unknown>[]
  if (body && typeof body === "object") {
    const arr = Object.values(body as Record<string, unknown>).find((v) => Array.isArray(v))
    return arr as Record<string, unknown>[] | undefined
  }
  return undefined
}

function summarize(label: string, r: Res): Record<string, unknown> | undefined {
  if (!r.ok) {
    const b = r.body as Record<string, unknown>
    const msg =
      b && typeof b === "object"
        ? String(b.error ?? b.detailedmessage ?? b.message ?? JSON.stringify(b).slice(0, 200))
        : String(r.body).slice(0, 200)
    console.log(`  ✗ ${label}: HTTP ${r.status} — ${msg}`)
    return undefined
  }
  const arr = pickArray(r.body)
  const total = (r.body as Record<string, unknown>)?.totalcount ?? arr?.length ?? "?"
  const first = arr?.[0]
  const fields = first ? Object.keys(first).slice(0, 12).join(", ") : ""
  console.log(`  ✓ ${label}: HTTP ${r.status} · count=${total}${fields ? ` · fields: ${fields}` : ""}`)
  return first
}

async function main() {
  console.log(`athenahealth ${ENVNAME.toUpperCase()} · practice ${PRACTICE_ID} · scope ${SCOPE}\n`)
  const token = await getToken()

  console.log("\n── sanity: auth + practice access ──")
  const dept = summarize("departments", await get(token, "/departments"))
  summarize("providers", await get(token, "/providers"))
  const deptId = dept?.departmentid ? String(dept.departmentid) : undefined

  console.log("\n── ⭐ wedge: claims + transactions (denial/payment detail) ──")
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmtDT = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const fmtD = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`
  const now = new Date()
  const past = new Date(now.getTime() - 730 * 86400000)

  // (A) Bulk sync endpoint an RCM tool would actually use — claims changed in a window, WITH the
  // charge/payment/adjustment transactions that carry denial (CARC) + remittance detail.
  const changed = await get(token, "/claims/changed", {
    showprocessedstartdatetime: fmtDT(past),
    showprocessedenddatetime: fmtDT(now),
    showtransactioninformation: "true",
    limit: "10",
  })
  const changedClaim = summarize("claims/changed (+transactions)", changed)
  if (changedClaim) {
    console.log("     claim keys:", Object.keys(changedClaim).join(", "))
    const tx = (changedClaim.transactions ?? changedClaim.claimtransactions) as Record<string, unknown>[] | undefined
    if (Array.isArray(tx) && tx[0]) console.log("     transaction keys:", Object.keys(tx[0]).join(", "))
  }

  // (B) Cross-check: pull a patient from a booked appointment, then that patient's claims.
  let patientId: string | undefined
  if (deptId) {
    const appts = await get(token, "/appointments/booked", { departmentid: deptId, startdate: fmtD(past), enddate: fmtD(now), limit: "5" })
    patientId = pickArray(appts.body)?.[0]?.patientid ? String(pickArray(appts.body)![0].patientid) : undefined
  }
  if (patientId) {
    const byPatient = await get(token, "/claims", { patientid: patientId, showtransactioninformation: "true" })
    // Scan the patient's claims for one that actually has payment/adjustment transactions.
    const allClaims = pickArray(byPatient.body) ?? []
    summarize(`claims for patient ${patientId}`, byPatient)
    const hasTxn = (cl: Record<string, unknown>) => Array.isArray(cl.transactiondetails) && (cl.transactiondetails as unknown[]).length > 0
    // Find an ADJUDICATED claim (more than one transaction = charge + payment/adjustment).
    const txnCount = (cl: Record<string, unknown>) =>
      cl.transactiondetails && typeof cl.transactiondetails === "object" ? Object.keys(cl.transactiondetails as object).length : 0
    const adjudicated = allClaims.filter((cl) => txnCount(cl) > 1)
    console.log(`     claims with >1 transaction (charge + payment/adjustment): ${adjudicated.length} of ${allClaims.length}`)
    const c = adjudicated[0] ?? allClaims.find(hasTxn) ?? allClaims[0]
    if (c) {
      console.log(`     sample claim ${c.claimid} full detail (status + adjustment/reason fields):`)
      const detail = await get(token, `/claims/${c.claimid}`, { showtransactioninformation: "true" })
      console.log("     " + JSON.stringify(detail.body).slice(0, 1100))
    }
  } else {
    console.log("  (no booked appointment found to derive a patientid — /claims/changed above is the key signal)")
  }

  console.log("\n── verdict ──")
  console.log("  If `claims` returned records with status + charge/payment/adjustment fields → native")
  console.log("  athenahealth covers the denial-recovery wedge. If empty or blocked → use Redox or the")
  console.log("  native billing API (task #12). Paste this output back and we'll decide.")
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e)
  process.exit(1)
})
export {}
