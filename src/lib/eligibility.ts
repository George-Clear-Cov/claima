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
  outOfPocketMax: number
  outOfPocketMet: number
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
      outOfPocketMax: 4000,
      outOfPocketMet: 1200,
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
      outOfPocketMax: 6000,
      outOfPocketMet: 2200,
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
      outOfPocketMax: 8000,
      outOfPocketMet: 0,
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

function parseClearinghouseResponse(data: Record<string, unknown>): EligibilityResult {
  // Parse 271 response format into our normalized structure
  const benefits = (data.benefitsInformation as Record<string, unknown>[] | undefined) ?? []

  const active = benefits.some(
    (b: Record<string, unknown>) =>
      (b.code as string) === "1" && (b.name as string)?.toLowerCase().includes("active")
  )

  const deductibleBenefit = benefits.find(
    (b: Record<string, unknown>) => (b.code as string) === "C" && (b.name as string)?.toLowerCase().includes("deductible")
  ) as Record<string, unknown> | undefined

  const oopBenefit = benefits.find(
    (b: Record<string, unknown>) =>
      (b.code as string) === "G" && (b.name as string)?.toLowerCase().includes("out-of-pocket")
  ) as Record<string, unknown> | undefined

  const copayBenefit = benefits.find(
    (b: Record<string, unknown>) => (b.code as string) === "B"
  ) as Record<string, unknown> | undefined

  const subscriber = data.subscriber as Record<string, unknown> | undefined
  const plan = (subscriber?.eligibilityBeginDate as string) ?? ""

  return {
    eligible: active,
    coverageActive: active,
    checkedAt: new Date().toISOString(),
    rawResponse: data,
    coverage: active
      ? {
          inNetwork: true,
          deductible: parseFloat(String((deductibleBenefit?.benefitAmount as string) ?? "0")),
          deductibleMet: 0,
          outOfPocketMax: parseFloat(String((oopBenefit?.benefitAmount as string) ?? "0")),
          outOfPocketMet: 0,
          copay: parseFloat(String((copayBenefit?.benefitAmount as string) ?? "0")),
          coinsurance: 20,
          visitLimit: null,
          visitsUsed: null,
          priorAuthRequired: false,
          planName: String((data.planDescription as string) ?? "Unknown Plan"),
          groupNumber: String((subscriber?.groupNumber as string) ?? ""),
          effectiveDate: plan,
          terminationDate: null,
        }
      : null,
  }
}
