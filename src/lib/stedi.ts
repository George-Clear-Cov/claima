/**
 * Stedi clearinghouse integration.
 * Docs: https://www.stedi.com/docs/api/claims
 * Using REST API directly (their SDK v0.0.5 is minimal).
 */

const STEDI_API_KEY = process.env.STEDI_API_KEY || ""
const STEDI_BASE_URL = "https://healthcare.us.stedi.com/2024-04-01"

export interface StediSubmitResult {
  claimId: string
  status: "accepted" | "rejected"
  errors?: string[]
  raw: unknown
}

export async function submitClaimToStedi(
  edi837p: string
): Promise<StediSubmitResult> {
  if (!STEDI_API_KEY) {
    // Dev mode: simulate acceptance
    return {
      claimId: `MOCK-${Date.now()}`,
      status: "accepted",
      raw: { mock: true },
    }
  }

  const res = await fetch(`${STEDI_BASE_URL}/claims`, {
    method: "POST",
    headers: {
      Authorization: `Key ${STEDI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ edi: edi837p }),
  })

  const data = await res.json()

  if (!res.ok) {
    return {
      claimId: "",
      status: "rejected",
      errors: [data.message || "Stedi submission failed"],
      raw: data,
    }
  }

  const hasErrors =
    data.acknowledgement?.functionalAcknowledgements?.some(
      (fa: { acknowledgementCode: string }) => fa.acknowledgementCode === "R"
    ) ?? false

  return {
    claimId: data.claimId ?? data.id ?? "",
    status: hasErrors ? "rejected" : "accepted",
    errors: hasErrors ? ["Claim rejected by clearinghouse"] : undefined,
    raw: data,
  }
}
