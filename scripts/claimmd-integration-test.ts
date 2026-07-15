/**
 * Claim.MD TEST-account integration validation.
 *
 * Exercises the real 270/271 eligibility, 837P submit + response, and 835 ERA parsing
 * (the "VERIFY" field mappings in src/lib/claimmd.ts + eligibility.ts) against the Claim.MD
 * TEST account. Synthetic data only — NO PHI. The one write is a test 837P upload to the sandbox.
 *
 * Run:  ~/.bun/bin/bun scripts/claimmd-integration-test.ts
 * (Bun auto-loads .env.local → CLAIMMD_ACCOUNT_KEY.)
 */
import { isClaimMdConfigured, lookupPayer, submitClaim, getClaimStatus, fetchAvailableERAs, fetchERAById } from "../src/lib/claimmd"
import { checkEligibility } from "../src/lib/eligibility"
import { generate837P } from "../src/lib/837p"

function hr(t: string) { console.log("\n" + "─".repeat(64) + "\n" + t) }
const trunc = (v: unknown, n = 900) => JSON.stringify(v)?.slice(0, n)

async function main() {
  if (!isClaimMdConfigured()) { console.error("✗ CLAIMMD_ACCOUNT_KEY not set"); process.exit(1) }
  console.log("Claim.MD TEST-account integration validation (synthetic data, no PHI)")

  // 1) Payer lookup — get a real Claim.MD payer id to use downstream
  hr("1) lookupPayer('aetna')")
  const payer = await lookupPayer("aetna")
  console.log(payer ? { payerId: payer.payerId, payerName: payer.payerName, claimsSupported: payer.claimsSupported, eligibilitySupported: payer.eligibilitySupported, eraMode: payer.eraMode } : "null")
  const payerId = payer?.payerId || "60054"

  // 2) Eligibility 270/271
  hr("2) checkEligibility (270/271 via /eligdata/)")
  const elig = await checkEligibility({ payerId, memberId: "W123456789", firstName: "Sarah", lastName: "Johnson", dob: "1985-03-15", npi: "1111111112", serviceType: "30" })
  console.log("PARSED:", { eligible: elig.eligible, coverageActive: elig.coverageActive, errors: elig.errors, coverage: elig.coverage })
  const rr = elig.rawResponse
  console.log("RAW keys:", rr && typeof rr === "object" ? Object.keys(rr as object) : rr)
  console.log("RAW:", trunc(rr))

  // 3) Claim submit 837P
  hr("3) submitClaim (837P upload via /upload/)")
  const edi = generate837P({
    practice: { npi: "1111111112", taxId: "999999999", name: "Sample Practice", taxonomy: "193400000X", addressLine1: "123 Main St", city: "New York", state: "NY", zip: "10001", phone: "2125551234" },
    provider: { npi: "1111111112", firstName: "Emily", lastName: "Chen", taxonomy: "207Q00000X" },
    patient: { memberId: "W123456789", firstName: "Sarah", lastName: "Johnson", dob: new Date("1985-03-15"), gender: "F", addressLine1: "1 Test St", city: "New York", state: "NY", zip: "10001", payerId, payerName: payer?.payerName || "Aetna", relationshipToSubscriber: "18" },
    serviceDate: new Date(),
    lineItems: [{ cptCode: "99213", icd10Codes: ["I10"], units: 1, chargeAmount: 150 }],
    totalCharge: 150,
    placeOfService: "11",
  })
  console.log("837P bytes:", edi.length, "| ISA seg:", edi.split("~")[0])
  const submit = await submitClaim(edi)
  console.log("PARSED:", { claimId: submit.claimId, status: submit.status, errors: submit.errors })
  console.log("RAW:", trunc(submit.raw, 1200))

  // 4) Claim status
  if (submit.claimId) {
    hr("4) getClaimStatus (/response/)")
    console.log(await getClaimStatus(submit.claimId))
  }

  // 5) ERA list + detail
  hr("5) fetchAvailableERAs (/eralist/)")
  const eras = await fetchAvailableERAs()
  console.log(`${eras.length} ERA(s)`)
  console.log(eras.slice(0, 3))
  if (eras[0]) {
    hr("5b) fetchERAById (835 parse via /eradata/)")
    const detail = await fetchERAById(eras[0].era_id)
    console.log("ENTRY:", detail && { era_id: detail.era_id, payer: detail.payer_name, total: detail.total_payment, claims: detail.claim_count })
    console.log("FIRST CLAIM LINE:", detail?.claims?.[0])
  }

  console.log("\n✓ Integration validation run complete.")
}
main()
export {}
