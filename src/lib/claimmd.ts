/**
 * Claim.MD clearinghouse integration.
 * Docs: https://claimmd.com/developers
 * REST API — 837P claim submission, 270/271 eligibility, and 835 ERA retrieval.
 */

const CLAIMMD_ACCOUNT_KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const CLAIMMD_API_KEY = process.env.CLAIMMD_API_KEY || ""
const CLAIMMD_BASE_URL = "https://www.claimmd.com/api"

export function isClaimMdConfigured(): boolean {
  return Boolean(CLAIMMD_ACCOUNT_KEY && CLAIMMD_API_KEY)
}

function claimMdHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Account-Key": CLAIMMD_ACCOUNT_KEY,
    "X-API-Key": CLAIMMD_API_KEY,
  }
}

export interface ClearinghouseSubmitResult {
  claimId: string
  status: "accepted" | "rejected"
  errors?: string[]
  raw: unknown
}

// ERA types — Claim.MD 835 retrieval
// Endpoint: GET /api/eras/  (list available ERA files)
// Endpoint: GET /api/eras/{era_id}  (download specific ERA)
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
  claim_id: string        // matches stediClaimId on our Claim model
  patient_first: string
  patient_last: string
  service_date: string    // YYYY-MM-DD
  billed_amount: number
  paid_amount: number
  adjustment_amount: number
  patient_responsibility: number
  carc_codes: string[]
}

export interface ClaimMdERADetail extends ClaimMdERAEntry {
  claims: ClaimMdERAClaimLine[]
  raw_835?: string        // raw EDI if Claim.MD returns it
}

export async function submitClaim(edi837p: string): Promise<ClearinghouseSubmitResult> {
  if (!CLAIMMD_ACCOUNT_KEY || !CLAIMMD_API_KEY) {
    return {
      claimId: `MOCK-${Date.now()}`,
      status: "accepted",
      raw: { mock: true },
    }
  }

  try {
    const res = await fetch(`${CLAIMMD_BASE_URL}/claims/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Account-Key": CLAIMMD_ACCOUNT_KEY,
        "X-API-Key": CLAIMMD_API_KEY,
      },
      body: JSON.stringify({ transaction: edi837p }),
    })

    const data = await res.json()

    if (!res.ok) {
      return {
        claimId: "",
        status: "rejected",
        errors: [data.message || data.error || "Claim.MD submission failed"],
        raw: data,
      }
    }

    const hasErrors = data.status === "R" || (data.errors && data.errors.length > 0)

    return {
      claimId: data.claim_id ?? data.ClaimID ?? "",
      status: hasErrors ? "rejected" : "accepted",
      errors: hasErrors ? (data.errors ?? ["Claim rejected by clearinghouse"]) : undefined,
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

export async function getClaimStatus(claimId: string): Promise<ClaimStatusResult | null> {
  if (!isClaimMdConfigured()) return null
  try {
    const res = await fetch(`${CLAIMMD_BASE_URL}/claims/${claimId}`, {
      method: "GET",
      headers: claimMdHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const rawStatus = String(data.status ?? data.claim_status ?? "").toUpperCase()
    const status: ClaimStatusResult["status"] =
      rawStatus === "A" ? "accepted" :
      rawStatus === "R" ? "rejected" :
      rawStatus === "P" ? "paid" :
      rawStatus === "D" ? "denied" : "pending"
    return { claimId, status, message: data.message }
  } catch {
    return null
  }
}

export async function fetchAvailableERAs(): Promise<ClaimMdERAEntry[]> {
  if (!isClaimMdConfigured()) return []

  try {
    const res = await fetch(`${CLAIMMD_BASE_URL}/eras/`, {
      method: "GET",
      headers: claimMdHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    // Claim.MD returns { eras: [...] } or a top-level array
    return Array.isArray(data) ? data : (data.eras ?? [])
  } catch {
    return []
  }
}

export async function fetchERAById(eraId: string): Promise<ClaimMdERADetail | null> {
  if (!isClaimMdConfigured()) return null

  try {
    const res = await fetch(`${CLAIMMD_BASE_URL}/eras/${eraId}`, {
      method: "GET",
      headers: claimMdHeaders(),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
