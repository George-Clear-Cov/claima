/**
 * Claim.MD clearinghouse integration — REST API.
 * Docs: https://docs.claim.md  ·  API reference: https://api.claim.md
 *
 * Auth model: a SINGLE AccountKey (portal → Settings → Account Settings),
 * sent as a form field on every request. Responses are XML by default; we ask
 * for JSON via the Accept header. Base host: https://svc.claim.md/services.
 *
 * Request/auth/endpoints follow Claim.MD's published API and are correct.
 * Fields tagged `VERIFY:` are response-shape guesses — confirm them against a
 * Claim.MD TEST account (https://docs.claim.md test-account quickstart) before
 * trusting this in production. Never validate against the live account.
 */

const CLAIMMD_ACCOUNT_KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const CLAIMMD_BASE_URL = "https://svc.claim.md/services"

export function isClaimMdConfigured(): boolean {
  return Boolean(CLAIMMD_ACCOUNT_KEY)
}

/**
 * POST to a Claim.MD service endpoint with the AccountKey + params.
 * When `file` is supplied the request is multipart/form-data (for /upload/ and
 * /elig/); otherwise it's application/x-www-form-urlencoded. Always asks for JSON.
 */
async function claimMdPost(
  path: string,
  params: Record<string, string> = {},
  file?: { content: string; filename: string },
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { Accept: "application/json" }
  let body: BodyInit

  if (file) {
    const form = new FormData()
    form.set("AccountKey", CLAIMMD_ACCOUNT_KEY)
    for (const [k, v] of Object.entries(params)) form.set(k, v)
    form.set("File", new Blob([file.content], { type: "text/plain" }), file.filename)
    body = form // fetch sets the multipart boundary + Content-Type itself
  } else {
    body = new URLSearchParams({ AccountKey: CLAIMMD_ACCOUNT_KEY, ...params })
    headers["Content-Type"] = "application/x-www-form-urlencoded"
  }

  const res = await fetch(`${CLAIMMD_BASE_URL}${path}`, { method: "POST", headers, body })
  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    data = { raw: text }
  }
  return { ok: res.ok, status: res.status, data }
}

function firstOf(v: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(v)) return v[0] as Record<string, unknown> | undefined
  if (v && typeof v === "object") return v as Record<string, unknown>
  return undefined
}

function asArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[]
  if (v && typeof v === "object") return [v as Record<string, unknown>]
  return []
}

function extractErrors(data: Record<string, unknown>): string[] {
  const errs: string[] = []
  const push = (v: unknown) => {
    if (!v) return
    if (Array.isArray(v)) return v.forEach(push)
    if (typeof v === "object") {
      const o = v as Record<string, unknown>
      const m = o.error_mesg ?? o.message ?? o.error ?? o.desc
      if (m) errs.push(String(m))
    } else {
      errs.push(String(v))
    }
  }
  push(data.error)
  push(data.errors)
  return errs
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (v == null ? "" : String(v))

export interface ClearinghouseSubmitResult {
  claimId: string
  status: "accepted" | "rejected"
  errors?: string[]
  raw: unknown
}

// ERA types — Claim.MD 835 retrieval
export interface ClaimMdERAEntry {
  era_id: string
  check_number: string
  payment_date: string
  payer_id: string
  payer_name: string
  total_payment: number
  claim_count: number
}

export interface ClaimMdERAClaimLine {
  claim_id: string
  patient_first: string
  patient_last: string
  service_date: string // YYYY-MM-DD
  billed_amount: number
  paid_amount: number
  adjustment_amount: number
  patient_responsibility: number
  carc_codes: string[]
}

export interface ClaimMdERADetail extends ClaimMdERAEntry {
  claims: ClaimMdERAClaimLine[]
  raw_835?: string
}

/** Submit an 837P as a file to POST /services/upload/. */
export async function submitClaim(edi837p: string): Promise<ClearinghouseSubmitResult> {
  if (!isClaimMdConfigured()) {
    return { claimId: `MOCK-${Date.now()}`, status: "accepted", raw: { mock: true } }
  }

  try {
    const { ok, data } = await claimMdPost("/upload/", {}, {
      content: edi837p,
      filename: `claima-837p-${Date.now()}.txt`,
    })

    const claim = firstOf(data.claim) // VERIFY: upload returns `claim` (single/array)
    const claimId = str(claim?.claimid ?? claim?.remote_claimid ?? data.batchid) // VERIFY
    const errors = extractErrors(data)
    const rejected = !ok || errors.length > 0

    return {
      claimId,
      status: rejected ? "rejected" : "accepted",
      errors: rejected ? (errors.length ? errors : ["Claim rejected by Claim.MD"]) : undefined,
      raw: data,
    }
  } catch (err) {
    return {
      claimId: "",
      status: "rejected",
      errors: [err instanceof Error ? err.message : "Network error"],
      raw: null,
    }
  }
}

export interface ClaimStatusResult {
  claimId: string
  status: "pending" | "accepted" | "rejected" | "paid" | "denied"
  message?: string
}

/** Poll claim status via POST /services/response/ (ResponseID=0 for a full pull). */
export async function getClaimStatus(claimId: string): Promise<ClaimStatusResult | null> {
  if (!isClaimMdConfigured()) return null
  try {
    const { ok, data } = await claimMdPost("/response/", { ResponseID: "0", ClaimID: claimId })
    if (!ok) return null

    const claim = firstOf(data.claim) ?? firstOf(data.response) // VERIFY
    const raw = str(claim?.status ?? claim?.claim_status).toUpperCase()
    const status: ClaimStatusResult["status"] =
      raw.startsWith("A") ? "accepted" :
      raw.startsWith("R") ? "rejected" :
      raw.startsWith("P") ? "paid" :
      raw.startsWith("D") ? "denied" : "pending"

    return { claimId, status, message: claim?.status_mesg ? str(claim.status_mesg) : undefined }
  } catch {
    return null
  }
}

/** List received ERAs via POST /services/eralist/ (ERAID=0 pulls all). */
export async function fetchAvailableERAs(): Promise<ClaimMdERAEntry[]> {
  if (!isClaimMdConfigured()) return []
  try {
    const { ok, data } = await claimMdPost("/eralist/", { ERAID: "0" })
    if (!ok) return []
    return asArray(data.era).map(mapERAEntry) // VERIFY: list key is `era`
  } catch {
    return []
  }
}

/** Fetch structured ERA detail (claims + CARC) via POST /services/eradata/. */
export async function fetchERAById(eraId: string): Promise<ClaimMdERADetail | null> {
  if (!isClaimMdConfigured()) return null
  try {
    const { ok, data } = await claimMdPost("/eradata/", { eraid: eraId })
    if (!ok) return null
    const entry = mapERAEntry({ era_id: eraId, ...data })
    return {
      ...entry,
      era_id: eraId,
      claims: asArray(data.claim).map(mapERAClaimLine), // VERIFY: claim lines under `claim`
      raw_835: data.x12 ? str(data.x12) : undefined,
    }
  } catch {
    return null
  }
}

// VERIFY: the field names below are inferred; confirm against a test-account response.
function mapERAEntry(e: Record<string, unknown>): ClaimMdERAEntry {
  return {
    era_id: str(e.era_id ?? e.eraid),
    check_number: str(e.check_number ?? e.checknum ?? e.check),
    payment_date: str(e.payment_date ?? e.checkdate ?? e.check_date),
    payer_id: str(e.payer_id ?? e.payerid),
    payer_name: str(e.payer_name ?? e.payername),
    total_payment: num(e.total_payment ?? e.checkamt ?? e.check_amount),
    claim_count: Math.round(num(e.claim_count ?? e.claims)),
  }
}

function mapERAClaimLine(c: Record<string, unknown>): ClaimMdERAClaimLine {
  const adjustments = asArray(c.adjustment ?? c.adj)
  const carc = adjustments
    .map((a) => str(a.carc ?? a.reason ?? a.code))
    .filter(Boolean)
  return {
    claim_id: str(c.claimid ?? c.claim_id ?? c.remote_claimid),
    patient_first: str(c.pat_name_f ?? c.patient_first),
    patient_last: str(c.pat_name_l ?? c.patient_last),
    service_date: str(c.fdos ?? c.service_date),
    billed_amount: num(c.charge ?? c.billed_amount),
    paid_amount: num(c.paid ?? c.paid_amount),
    adjustment_amount: num(c.adj_amount ?? c.adjustment_amount),
    patient_responsibility: num(c.patient_resp ?? c.patient_responsibility),
    carc_codes: carc,
  }
}
