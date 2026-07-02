/**
 * Claim.MD END-TO-END validation against a TEST/sandbox account.
 *
 * ⚠️ Requires CLAIMMD_TEST_ACCOUNT_KEY (a Claim.MD *test* account key — NOT the
 * live 31008 key). It scopes the real claimmd.ts client to that test key for this
 * run only, so nothing touches production or real payers.
 *
 * Claim.MD test accounts simulate responses by the insured/member ID:
 *   memberId "REJECT" -> forced rejection
 *   memberId "DENY"   -> forced denial (shows up on the ERA)
 *   anything else     -> accepted
 *
 * It submits all three via the real `submitClaim`, polls `getClaimStatus`, then
 * pulls `fetchAvailableERAs` + `fetchERAById`, printing parsed output + raw JSON
 * so every field mapping in claimmd.ts can be confirmed against live responses.
 *
 * Run (after adding CLAIMMD_TEST_ACCOUNT_KEY to .env.local):
 *   ~/.bun/bin/bun scripts/claimmd-test-submit.ts
 */

const testKey = process.env.CLAIMMD_TEST_ACCOUNT_KEY || ""
if (!testKey) {
  console.error("✗ CLAIMMD_TEST_ACCOUNT_KEY not set.")
  console.error("  Add your Claim.MD *test/sandbox* account key to .env.local and re-run.")
  console.error("  (Do NOT reuse CLAIMMD_ACCOUNT_KEY — that is the live account 31008.)")
  process.exit(1)
}
// claimmd.ts reads CLAIMMD_ACCOUNT_KEY at import time — point it at the test key
// BEFORE importing (the dynamic imports happen inside main(), after this line).
process.env.CLAIMMD_ACCOUNT_KEY = testKey

// ── Dummy but structurally-valid claim data. Adjust NPIs / payer to whatever the
//    sandbox expects if Claim.MD support specifies test values. ──
const practice = {
  npi: "1234567893",
  taxId: "123456789",
  name: "CLAIMA TEST CLINIC",
  taxonomy: "207Q00000X",
  addressLine1: "1 TEST ST",
  city: "NEWARK",
  state: "NJ",
  zip: "07102",
  phone: "5555550100",
}
const provider = { npi: "1234567893", firstName: "TEST", lastName: "PROVIDER", taxonomy: "207Q00000X" }

function buildClaim(memberId: string) {
  return {
    practice,
    provider,
    patient: {
      memberId, // "REJECT" | "DENY" | normal — drives the sandbox simulation
      firstName: "TEST",
      lastName: "PATIENT",
      dob: new Date("1980-01-01"),
      gender: "M",
      addressLine1: "2 TEST AVE",
      city: "NEWARK",
      state: "NJ",
      zip: "07102",
      payerId: "60054",
      payerName: "AETNA",
    },
    serviceDate: new Date(),
    lineItems: [{ cptCode: "99213", icd10Codes: ["I10"], units: 1, chargeAmount: 150 }],
    totalCharge: 150,
    placeOfService: "11",
  }
}

function show(label: string, v: unknown) {
  console.log(`\n----- ${label} -----`)
  console.log(JSON.stringify(v, null, 2).slice(0, 1800))
}

async function main() {
  const { generate837P } = await import("../src/lib/837p")
  const { submitClaim, getClaimStatus, fetchAvailableERAs, fetchERAById } = await import("../src/lib/claimmd")

  for (const member of ["REJECT", "DENY", "TESTOK123"]) {
    const edi = generate837P(buildClaim(member))
    const res = await submitClaim(edi)
    show(`submit (memberId=${member}) → parsed`, { claimId: res.claimId, status: res.status, errors: res.errors })
    show(`submit (memberId=${member}) → raw`, res.raw)
    if (res.claimId) show(`status ${res.claimId}`, await getClaimStatus(res.claimId))
  }

  console.log("\n===== ERA (the DENY claim should produce an 835; may take a minute on the sandbox) =====")
  const eras = await fetchAvailableERAs()
  show("fetchAvailableERAs → parsed", eras)
  const first = eras[0]
  if (first?.era_id) {
    show(`fetchERAById(${first.era_id}) → parsed`, await fetchERAById(first.era_id))
  } else {
    console.log("(no ERA yet — re-run in a minute to pull the 835 once the sandbox generates it)")
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ test run failed:", err instanceof Error ? err.message : err)
    process.exit(2)
  })

export {}
