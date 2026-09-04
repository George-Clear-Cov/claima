/**
 * Claim.MD 835 (ERA) parser test — validates parseERADetail / parseERAList field mappings
 * against fixtures matching Claim.MD's documented /eradata/ + /eralist/ response schema.
 * No network, no PHI, no NPI required. Confirms the parsing LOGIC: multi-level adjustment
 * aggregation (claim-level + charge/service-line level), PR patient-responsibility, CARC
 * collection, decimal parsing, and single-object coercion (Claim.MD collapses single items).
 *
 * The live round-trip (scripts/claimmd-integration-test.ts) confirms the docs match reality
 * once a valid test NPI produces a real ERA.
 *
 * Run:  ~/.bun/bin/bun scripts/claimmd-835-test.ts
 */
import { parseERADetail, parseERAList } from "../src/lib/claimmd"

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${g}\n      want: ${w}`) }
}

// ── /eradata/ fixture (835 detail): claim-level (PR) + charge/service-line-level (CO) adjustments ──
const eradata = {
  eraid: "884412",
  check_number: "EFT-7781234",
  paid_date: "2026-07-10",
  payerid: "60054",
  payer_name: "Aetna",
  paid_amount: "230.00",
  x12: "ISA*00*...~",
  claim: [
    {
      claimid: "CLM-1001", pat_name_f: "Sarah", pat_name_l: "Johnson", from_dos: "2026-07-01",
      total_charge: "150.00", total_paid: "120.00",
      adjustment: [{ group: "PR", code: "1", amount: "10.00" }],
      charge: [{ adjustment: [{ group: "CO", code: "45", amount: "20.00" }] }],
    },
    {
      claimid: "CLM-1002", pat_name_f: "James", pat_name_l: "Rivera", from_dos: "2026-07-02",
      total_charge: "200.00", total_paid: "110.00",
      adjustment: [
        { group: "PR", code: "2", amount: "40.00" },
        { group: "CO", code: "97", amount: "50.00" },
      ],
    },
  ],
}

console.log("parseERADetail — ERA header + claims + adjustments")
const d = parseERADetail(eradata, "884412")
eq("era_id", d.era_id, "884412")
eq("check_number", d.check_number, "EFT-7781234")
eq("payment_date", d.payment_date, "2026-07-10")
eq("payer_id", d.payer_id, "60054")
eq("payer_name", d.payer_name, "Aetna")
eq("total_payment", d.total_payment, 230)
eq("claim_count", d.claim_count, 2)
eq("raw_835 captured", d.raw_835, "ISA*00*...~")
eq("c0 claim_id", d.claims[0].claim_id, "CLM-1001")
eq("c0 patient", `${d.claims[0].patient_first} ${d.claims[0].patient_last}`, "Sarah Johnson")
eq("c0 service_date", d.claims[0].service_date, "2026-07-01")
eq("c0 billed", d.claims[0].billed_amount, 150)
eq("c0 paid", d.claims[0].paid_amount, 120)
eq("c0 adjustment_amount (PR10 + CO20)", d.claims[0].adjustment_amount, 30)
eq("c0 patient_responsibility (PR only)", d.claims[0].patient_responsibility, 10)
eq("c0 carc_codes (claim + charge level)", d.claims[0].carc_codes, ["1", "45"])
eq("c1 adjustment_amount (40 + 50)", d.claims[1].adjustment_amount, 90)
eq("c1 patient_responsibility (PR only)", d.claims[1].patient_responsibility, 40)
eq("c1 carc_codes", d.claims[1].carc_codes, ["2", "97"])

// ── Single claim returned as an OBJECT (not array) — Claim.MD collapses single items ──
console.log("\nparseERADetail — single claim as object (asArray coercion)")
const single = parseERADetail({
  eraid: "884499", payerid: "60054", payer_name: "Aetna", paid_amount: "80.00",
  claim: { claimid: "CLM-X", pat_name_f: "Amy", pat_name_l: "Lee", from_dos: "2026-07-03", total_charge: "80.00", total_paid: "80.00" },
}, "884499")
eq("coerced to 1 claim", single.claim_count, 1)
eq("single claim_id", single.claims[0].claim_id, "CLM-X")
eq("no adjustments -> 0", single.claims[0].adjustment_amount, 0)
eq("no carc -> []", single.claims[0].carc_codes, [])

// ── /eralist/ fixture ──
console.log("\nparseERAList — ERA directory")
const list = parseERAList({ era: [
  { eraid: "884412", check_number: "EFT-7781234", paid_date: "2026-07-10", payerid: "60054", payer_name: "Aetna", paid_amount: "230.00", claim_count: "2" },
  { eraid: "884413", check_number: "EFT-7781299", paid_date: "2026-07-11", payerid: "87726", payer_name: "UnitedHealthcare", paid_amount: "540.50", claim_count: "3" },
] })
eq("2 entries", list.length, 2)
eq("entry0 era_id", list[0].era_id, "884412")
eq("entry0 payment_date", list[0].payment_date, "2026-07-10")
eq("entry0 payer_name", list[0].payer_name, "Aetna")
eq("entry0 total_payment", list[0].total_payment, 230)
eq("entry0 claim_count", list[0].claim_count, 2)
eq("entry1 total_payment (540.50)", list[1].total_payment, 540.5)
eq("eralist single-object coercion", parseERAList({ era: { eraid: "1", payerid: "60054", payer_name: "Aetna", paid_amount: "5.00" } }).length, 1)

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
