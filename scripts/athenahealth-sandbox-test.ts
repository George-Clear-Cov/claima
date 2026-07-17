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

const CLIENT_ID = process.env.ATHENA_CLIENT_ID || ""
const CLIENT_SECRET = process.env.ATHENA_CLIENT_SECRET || ""
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

  console.log("\n── ⭐ wedge: claims + payment/denial detail (the make-or-break) ──")
  const patients = await get(token, "/patients", deptId ? { departmentid: deptId, limit: "5" } : { limit: "5" })
  const patient = summarize("patients", patients)
  const patientId = patient?.patientid ? String(patient.patientid) : undefined

  // Try the claims list a couple of ways (it usually needs departmentid or patientid).
  let claimsRes = await get(token, "/claims", deptId ? { departmentid: deptId, showunpostedcharges: "true" } : {})
  if (!claimsRes.ok && patientId) claimsRes = await get(token, "/claims", { patientid: patientId })
  const claim = summarize("claims", claimsRes)
  if (claim) {
    console.log("     first claim keys:", Object.keys(claim).join(", "))
    const claimId = claim.claimid ? String(claim.claimid) : undefined
    if (claimId) summarize(`claim ${claimId} detail`, await get(token, `/claims/${claimId}`))
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
