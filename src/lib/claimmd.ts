/**
 * Claim.MD clearinghouse integration — REST API.
 * Docs: https://docs.claim.md  ·  API reference: https://api.claim.md
 *
 * Auth model: a SINGLE AccountKey (portal → Settings → Account Settings),
 * sent as a form field on every request. Responses are XML by default; we ask
 * for JSON via the Accept header. Base host: https://svc.claim.md/services.
 *
 * Field names below are sourced from Claim.MD's API reference (response schemas
 * for upload/response/eralist/eradata). Auth + payerlist are validated live;
 * ERA/status field mappings should still be spot-checked against the first real
 * 835 / claim response, since the account had no data at build time.
 */

const CLAIMMD_ACCOUNT_KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const CLAIMMD_BASE_URL = "https://svc.claim.md/services"

export function isClaimMdConfigured(): boolean {
  return Boolean(CLAIMMD_ACCOUNT_KEY)
}

/**
 * POST to a Claim.MD service endpoint with the AccountKey + params.
 * When `file` is supplied the request is multipart/form-data (for /upload/);
 * otherwise it's application/x-www-form-urlencoded. Always asks for JSON.
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

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (v == null ? "" : String(v))

// Claim.MD returns messages under a claim's nested `messages` (mesgid/message/status/fields).
function collectMessages(data: Record<string, unknown>): string[] {
  const out: string[] = []
  const claim = firstOf(data.claim)
  for (const m of asArray(claim?.messages)) {
    const msg = str(m.message ?? m.error ?? m.desc)
    if (msg) out.push(m.fields ? `${msg} (${str(m.fields)})` : msg)
  }
  if (typeof data.error === "string") out.push(data.error)
  for (const e of asArray(data.error)) {
    const msg = str(e.message ?? e.error)
    if (msg) out.push(msg)
  }
  return out
}

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

    const claim = firstOf(data.claim)
    const claimId = str(claim?.claimid ?? claim?.remote_claimid ?? data.batchid)
    const status = str(claim?.status).toUpperCase() // "A" = acknowledged/accepted
    const messages = collectMessages(data)
    const accepted = ok && (status.startsWith("A") || (status === "" && messages.length === 0))

    return {
      claimId,
      status: accepted ? "accepted" : "rejected",
      errors: accepted ? undefined : (messages.length ? messages : [`Claim not accepted (status: ${status || "unknown"})`]),
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

    const claim = firstOf(data.claim)
    const raw = str(claim?.status).toUpperCase() // "A" acknowledged
    const status: ClaimStatusResult["status"] =
      raw.startsWith("A") ? "accepted" :
      raw.startsWith("R") ? "rejected" :
      raw.startsWith("P") ? "paid" :
      raw.startsWith("D") ? "denied" : "pending"

    return { claimId, status, message: collectMessages(data)[0] }
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
    return asArray(data.era).map(mapERAEntry)
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
    const claims = asArray(data.claim).map(mapERAClaimLine)
    return {
      ...mapERAEntry(data),
      era_id: eraId,
      claim_count: claims.length,
      claims,
      raw_835: data.x12 ? str(data.x12) : undefined,
    }
  } catch {
    return null
  }
}

// eralist record + eradata top-level share these field names (Claim.MD API ref).
function mapERAEntry(e: Record<string, unknown>): ClaimMdERAEntry {
  return {
    era_id: str(e.eraid ?? e.era_id),
    check_number: str(e.check_number ?? e.checknum),
    payment_date: str(e.paid_date ?? e.payment_date ?? e.check_date),
    payer_id: str(e.payerid ?? e.payer_id),
    payer_name: str(e.payer_name ?? e.payername),
    total_payment: num(e.paid_amount ?? e.total_payment),
    claim_count: Math.round(num(e.claim_count ?? (Array.isArray(e.claim) ? (e.claim as unknown[]).length : 0))),
  }
}

// eradata hierarchy: claim → charge[] → adjustment[]. Gather adjustments from both levels.
function collectAdjustments(c: Record<string, unknown>): Record<string, unknown>[] {
  const out = asArray(c.adjustment)
  for (const charge of asArray(c.charge)) out.push(...asArray(charge.adjustment))
  return out
}

function mapERAClaimLine(c: Record<string, unknown>): ClaimMdERAClaimLine {
  const adjustments = collectAdjustments(c)
  const carc = adjustments.map((a) => str(a.code ?? a.carc ?? a.reason)).filter(Boolean)
  const adjustmentAmount = adjustments.reduce((s, a) => s + num(a.amount), 0)
  const patientResponsibility = adjustments
    .filter((a) => str(a.group).toUpperCase() === "PR")
    .reduce((s, a) => s + num(a.amount), 0)

  return {
    claim_id: str(c.claimid ?? c.remote_claimid ?? c.pcn ?? c.claim_id),
    patient_first: str(c.pat_name_f ?? c.patient_first),
    patient_last: str(c.pat_name_l ?? c.patient_last),
    service_date: str(c.from_dos ?? c.fdos ?? c.service_date),
    billed_amount: num(c.total_charge ?? c.charge),
    paid_amount: num(c.total_paid ?? c.paid),
    adjustment_amount: adjustmentAmount,
    patient_responsibility: patientResponsibility,
    carc_codes: carc,
  }
}
