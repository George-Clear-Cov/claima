// Insurance eligibility verification via Claim.MD 270/271 transactions.
// Use getServiceTypeForCPT() from ./specialty to compute the correct serviceType
// before calling checkEligibility — it maps CPT codes → X12 service type codes.
export { getServiceTypeForCPT } from "./specialty"

const CLAIMMD_ACCOUNT_KEY = process.env.CLAIMMD_ACCOUNT_KEY || ""
const CLAIMMD_BASE_URL = "https://svc.claim.md/services"

export interface EligibilityRequest {
  payerId: string
  memberId: string
  firstName: string
  lastName: string
  dob: string // YYYY-MM-DD
  npi: string  // rendering provider NPI
  serviceType?: string // X12 service type code — "30" behavioral health, "98" professional physician visit, "1" medical care (generic)
}

export interface CoverageDetail {
  inNetwork: boolean
  deductible: number
  deductibleMet: number
  deductibleRemaining: number
  outOfPocketMax: number
  outOfPocketMet: number
  outOfPocketRemaining: number
  copay: number
  coinsurance: number // percentage e.g. 20
  visitLimit: number | null
  visitsUsed: number | null
  priorAuthRequired: boolean
  planName: string
  groupNumber: string
  effectiveDate: string
  terminationDate: string | null
}

export interface EligibilityResult {
  eligible: boolean
  coverageActive: boolean
  coverage: CoverageDetail | null
  rawResponse: unknown
  checkedAt: string
  errors?: string[]
}

// Mock payer responses for dev mode
const MOCK_RESPONSES: Record<string, EligibilityResult> = {
  default: {
    eligible: true,
    coverageActive: true,
    checkedAt: new Date().toISOString(),
    rawResponse: { mock: true },
    coverage: {
      inNetwork: true,
      deductible: 1500,
      deductibleMet: 800,
      deductibleRemaining: 700,
      outOfPocketMax: 4000,
      outOfPocketMet: 1200,
      outOfPocketRemaining: 2800,
      copay: 30,
      coinsurance: 20,
      visitLimit: 52,
      visitsUsed: 18,
      priorAuthRequired: false,
      planName: "BlueCross PPO Gold",
      groupNumber: "GRP-4892",
      effectiveDate: "2026-01-01",
      terminationDate: null,
    },
  },
  aetna: {
    eligible: true,
    coverageActive: true,
    checkedAt: new Date().toISOString(),
    rawResponse: { mock: true },
    coverage: {
      inNetwork: true,
      deductible: 2000,
      deductibleMet: 2000,
      deductibleRemaining: 0,
      outOfPocketMax: 6000,
      outOfPocketMet: 2200,
      outOfPocketRemaining: 3800,
      copay: 0,
      coinsurance: 20,
      visitLimit: null,
      visitsUsed: null,
      priorAuthRequired: true,
      planName: "Aetna Choice POS II",
      groupNumber: "AET-77421",
      effectiveDate: "2026-01-01",
      terminationDate: null,
    },
  },
  united: {
    eligible: true,
    coverageActive: true,
    checkedAt: new Date().toISOString(),
    rawResponse: { mock: true },
    coverage: {
      inNetwork: false,
      deductible: 3000,
      deductibleMet: 0,
      deductibleRemaining: 3000,
      outOfPocketMax: 8000,
      outOfPocketMet: 0,
      outOfPocketRemaining: 8000,
      copay: 60,
      coinsurance: 40,
      visitLimit: 30,
      visitsUsed: 4,
      priorAuthRequired: true,
      planName: "United Choice Plus",
      groupNumber: "UHC-12309",
      effectiveDate: "2026-03-01",
      terminationDate: null,
    },
  },
  inactive: {
    eligible: false,
    coverageActive: false,
    checkedAt: new Date().toISOString(),
    rawResponse: { mock: true },
    coverage: null,
    errors: ["Coverage terminated as of 2025-12-31"],
  },
}

function getMockResponse(payerId: string): EligibilityResult {
  const key = payerId.toLowerCase()
  if (key.includes("aetna")) return { ...MOCK_RESPONSES.aetna, checkedAt: new Date().toISOString() }
  if (key.includes("united") || key.includes("uhc")) return { ...MOCK_RESPONSES.united, checkedAt: new Date().toISOString() }
  if (key.includes("inactive") || key.includes("term")) return { ...MOCK_RESPONSES.inactive, checkedAt: new Date().toISOString() }
  return { ...MOCK_RESPONSES.default, checkedAt: new Date().toISOString() }
}

export async function checkEligibility(req: EligibilityRequest): Promise<EligibilityResult> {
  if (!CLAIMMD_ACCOUNT_KEY) {
    // Simulate 300ms network latency in dev
    await new Promise((r) => setTimeout(r, 300))
    return getMockResponse(req.payerId)
  }

  try {
    // Real-time 270/271 via POST /services/eligdata/ (parameter-based).
    // VERIFY: request field names + 271 response shape against a Claim.MD test account.
    const res = await fetch(`${CLAIMMD_BASE_URL}/eligdata/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        AccountKey: CLAIMMD_ACCOUNT_KEY,
        payerid: req.payerId,
        prov_npi: req.npi,
        ins_number: req.memberId,
        ins_name_f: req.firstName,
        ins_name_l: req.lastName,
        pat_dob: req.dob.replace(/-/g, ""),
        fdos: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        service_type: req.serviceType ?? "30",
      }),
    })

    const data = await res.json()

    // Claim.MD returns errors as HTTP 200 with an { error: { error_mesg, error_code } } body,
    // so surface an error field regardless of HTTP status (don't silently return "not eligible").
    const errObj = (data as Record<string, unknown>)?.error
    const errMsg =
      typeof errObj === "string" ? errObj
      : errObj && typeof errObj === "object"
        ? String((errObj as Record<string, unknown>).error_mesg ?? (errObj as Record<string, unknown>).message ?? JSON.stringify(errObj))
        : !res.ok ? String((data as Record<string, unknown>).message ?? "Eligibility check failed") : null
    if (errMsg) {
      return {
        eligible: false,
        coverageActive: false,
        coverage: null,
        rawResponse: data,
        checkedAt: new Date().toISOString(),
        errors: [errMsg],
      }
    }

    return parseClearinghouseResponse(data)
  } catch (err) {
    return {
      eligible: false,
      coverageActive: false,
      coverage: null,
      rawResponse: null,
      checkedAt: new Date().toISOString(),
      errors: [err instanceof Error ? err.message : "Network error"],
    }
  }
}

// Claim.MD's /eligdata/ 271 shape: { elig: { plan_begin_date, group_number, benefit: [...] } }.
// Each benefit: benefit_coverage_description ("Active Coverage"|"Deductible"|"Out of Pocket
// (Stop Loss)"|"Co-Payment"|"Co-Insurance"), benefit_amount, benefit_percent, and EB06
// benefit_period_code (23=Calendar Year total, 24=Year-to-Date met, 29=Remaining).
// Exported so it can be validated with a fixture (see scripts/eligibility-271-test.ts).
export function parseClearinghouseResponse(data: Record<string, unknown>): EligibilityResult {
  const elig = ((data.elig as Record<string, unknown>) ?? data) ?? {}
  const raw = elig.benefit
  const benefits: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : raw
      ? [raw as Record<string, unknown>]
      : []

  const cov = (b: Record<string, unknown>) => String(b.benefit_coverage_description ?? "").trim().toLowerCase()
  const per = (b: Record<string, unknown>) => String(b.benefit_period_code ?? "")
  const amt = (b: Record<string, unknown>) => {
    const n = parseFloat(String(b.benefit_amount ?? ""))
    return Number.isFinite(n) ? n : 0
  }

  // X12 EB01: active statuses start with "Active" (Active Coverage, Active - Full Risk Capitation…);
  // inactive/terminated start with "Inactive". Use startsWith so "Inactive" (which *contains*
  // "active") is never a false positive — a terminated member must parse as ineligible.
  const active = benefits.some((b) => cov(b).startsWith("active"))

  // First benefit matching a coverage keyword (+ optional EB06 period). 271 lists in-network first.
  const find = (kw: string, periods?: string[]) =>
    benefits.find((b) => cov(b).includes(kw) && (!periods || periods.includes(per(b))))

  const deductible = find("deductible", ["23"])    // Calendar-Year total
  const deductibleMet = find("deductible", ["24"]) // Year-to-Date met
  const deductibleRem = find("deductible", ["29"]) // Remaining (preferred when the payer sends it)
  const oopMax = find("out of pocket", ["23"])
  const oopMet = find("out of pocket", ["24"])
  const oopRem = find("out of pocket", ["29"])
  const copay = find("co-payment") ?? find("copay")
  const coins = benefits.find((b) => cov(b).includes("insurance"))

  const coinsurance = (() => {
    const p = parseFloat(String(coins?.benefit_percent ?? ""))
    if (!Number.isFinite(p)) return 0
    return p <= 1 ? Math.round(p * 100) : Math.round(p)
  })()

  const planName = String(benefits.find((b) => b.insurance_plan)?.insurance_plan ?? elig.plan_number ?? "") || "Unknown Plan"
  const begin = String(elig.plan_begin_date ?? "").split(/[-–]/)[0].trim()
  const effectiveDate = begin.length >= 8 ? `${begin.slice(0, 4)}-${begin.slice(4, 6)}-${begin.slice(6, 8)}` : ""

  return {
    eligible: active,
    coverageActive: active,
    checkedAt: new Date().toISOString(),
    rawResponse: data,
    coverage: active
      ? {
          inNetwork: true,
          deductible: deductible ? amt(deductible) : 0,
          deductibleMet: deductibleMet ? amt(deductibleMet) : 0,
          deductibleRemaining: deductibleRem ? amt(deductibleRem)
            : Math.max((deductible ? amt(deductible) : 0) - (deductibleMet ? amt(deductibleMet) : 0), 0),
          outOfPocketMax: oopMax ? amt(oopMax) : 0,
          outOfPocketMet: oopMet ? amt(oopMet) : 0,
          outOfPocketRemaining: oopRem ? amt(oopRem)
            : Math.max((oopMax ? amt(oopMax) : 0) - (oopMet ? amt(oopMet) : 0), 0),
          copay: copay ? amt(copay) : 0,
          coinsurance,
          visitLimit: null,
          visitsUsed: null,
          priorAuthRequired: false,
          planName,
          groupNumber: String(elig.group_number ?? ""),
          effectiveDate,
          terminationDate: null,
        }
      : null,
  }
}
