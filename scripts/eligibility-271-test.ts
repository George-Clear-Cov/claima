/**
 * Eligibility 271 parser test — validates parseClearinghouseResponse against Claim.MD's REAL
 * /eligdata/ shape ({ elig: { benefit: [...] } } with EB06 period codes), captured live from the
 * test account. No network/PHI. The live run (scripts/claimmd-integration-test.ts) confirms it
 * against the actual response.
 *
 * Run:  ~/.bun/bin/bun scripts/eligibility-271-test.ts
 */
import { parseClearinghouseResponse } from "../src/lib/eligibility"

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${g}\n      want: ${w}`) }
}

// Real Claim.MD shape (subset): period 23 = Calendar-Year total, 24 = Year-to-Date met.
const activeResp = {
  elig: {
    plan_begin_date: "20260615-20260814",
    group_number: "GRP-4892",
    plan_number: "AETNA CHOICE PLUS",
    benefit: [
      { benefit_coverage_description: "Active Coverage", benefit_code: "30", insurance_plan: "AETNA CHOICE PLUS" },
      { benefit_coverage_description: "Deductible", benefit_period_code: "24", benefit_amount: "500" },
      { benefit_coverage_description: "Deductible", benefit_period_code: "23", benefit_amount: "3000" },
      { benefit_coverage_description: "Out of Pocket (Stop Loss)", benefit_period_code: "24", benefit_amount: "1200" },
      { benefit_coverage_description: "Out of Pocket (Stop Loss)", benefit_period_code: "23", benefit_amount: "9000" },
      { benefit_coverage_description: "Co-Payment", benefit_amount: "30" },
      { benefit_coverage_description: "Co-Insurance", benefit_percent: "0.2" },
    ],
  },
}

console.log("parseClearinghouseResponse — active coverage")
const r = parseClearinghouseResponse(activeResp)
eq("eligible", r.eligible, true)
eq("coverageActive", r.coverageActive, true)
eq("deductible (Calendar-Year total)", r.coverage?.deductible, 3000)
eq("deductibleMet (Year-to-Date)", r.coverage?.deductibleMet, 500)
eq("outOfPocketMax", r.coverage?.outOfPocketMax, 9000)
eq("outOfPocketMet", r.coverage?.outOfPocketMet, 1200)
eq("copay", r.coverage?.copay, 30)
eq("coinsurance (0.2 -> 20%)", r.coverage?.coinsurance, 20)
eq("planName", r.coverage?.planName, "AETNA CHOICE PLUS")
eq("groupNumber", r.coverage?.groupNumber, "GRP-4892")
eq("effectiveDate (from range start)", r.coverage?.effectiveDate, "2026-06-15")

console.log("\nparseClearinghouseResponse — inactive / no active coverage")
const inactive = parseClearinghouseResponse({ elig: { benefit: [{ benefit_coverage_description: "Inactive" }] } })
eq("not eligible", inactive.eligible, false)
eq("no coverage object", inactive.coverage, null)

console.log("\nparseClearinghouseResponse — single benefit as object (coercion)")
const single = parseClearinghouseResponse({ elig: { plan_begin_date: "20260101-20261231", benefit: { benefit_coverage_description: "Active Coverage", insurance_plan: "PPO" } } })
eq("eligible", single.eligible, true)
eq("effectiveDate", single.coverage?.effectiveDate, "2026-01-01")

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
