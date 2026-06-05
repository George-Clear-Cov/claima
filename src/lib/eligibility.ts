/**
 * Insurance eligibility verification via Stedi 270/271 transactions.
 * 270 = provider asks insurer: "is this patient covered?"
 * 271 = insurer responds with coverage details
 */

const STEDI_API_KEY = process.env.STEDI_API_KEY || ""
const STEDI_BASE_URL = "https://healthcare.us.stedi.com/2024-04-01"

export interface EligibilityRequest {
  payerId: string
  memberId: string
  firstName: string
  lastName: string
  dob: string // YYYY-MM-DD
  npi: string  // rendering provider NPI
  serviceType?: string // default "30" = mental health
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

// Mock payer responses for dev mode — realistic mental health coverage data
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
  if (!STEDI_API_KEY) {
    // Simulate 300ms network latency in dev
    await new Promise((r) => setTimeout(r, 300))
    return getMockResponse(req.payerId)
  }

  try {
    const res = await fetch(`${STEDI_BASE_URL}/eligibility`, {
      method: "POST",
      headers: {
        Authorization: `Key ${STEDI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        controlNumber: Math.floor(Math.random() * 999999999).toString().padStart(9, "0"),
        tradingPartnerServiceId: req.payerId,
        provider: { npi: req.npi },
        subscriber: {
          memberId: req.memberId,
          firstName: req.firstName,
          lastName: req.lastName,
          dateOfBirth: req.dob.replace(/-/g, ""),
        },
        encounter: {
          serviceTypeCodes: [req.serviceType ?? "30"], // 30 = Mental Health
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return {
        eligible: false,
        coverageActive: false,
        coverage: null,
        rawResponse: data,
        checkedAt: new Date().toISOString(),
        errors: [data.message ?? "Eligibility check failed"],
      }
    }

    return parseStediResponse(data)
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

function parseStediResponse(data: Record<string, unknown>): EligibilityResult {
  // Parse Stedi 271 response format into our normalized structure
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
