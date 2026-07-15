/**
 * Backlog import — CSV adapter test. Parses a realistic practice AR/denial CSV (one DENIED row w/
 * CARC, one PAID row, one row with a quoted field containing a comma) into normalized
 * ImportedRecords and asserts the mapping. Also tests the explicit `mapping` override path with
 * nonstandard headers. No network, no DB, no PHI beyond the synthetic fixture.
 *
 * Run:  ~/.bun/bin/bun scripts/import-csv-test.ts
 */
import { parseCsvBacklog } from "../src/lib/import/fromCsv"

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${g}\n      want: ${w}`) }
}

// Header uses common-but-varied aliases. Row 3's Provider Name is quoted and contains a comma.
// Note the CRLF line endings + a trailing blank line, which the parser must tolerate.
const fixtureCsv = [
  "Claim #,First Name,Last Name,Member ID,Payer,Date of Service,CPT,Modifier,Diagnosis,Charge,Paid,Denial Code,Status,Provider Name",
  "CLM-1001,Sarah,Johnson,W123456789,Aetna,06/15/2026,99213,25,I10,150.00,0.00,197,Denied,Dr. Chen",
  "CLM-1002,James,Rivera,U987654321,Aetna,06/16/2026,99214,,E11.9,\"1,200.00\",960.00,,Paid,Dr. Chen",
  "CLM-1003,Amanda,Torres,X555000111,United,06/17/2026,97110,GP,M54.50,90.00,0.00,,,\"Rivera, Marcus PT, DPT\"",
].join("\r\n") + "\r\n\r\n"

const result = parseCsvBacklog(fixtureCsv)

console.log("parseCsvBacklog — envelope + records")
eq("format", result.format, "csv")
eq("3 records (trailing blank line dropped)", result.records.length, 3)

console.log("\nrecord 0 — the DENIED row")
const r0 = result.records[0]
eq("external claim id", r0.externalClaimId, "CLM-1001")
eq("patient first", r0.patientFirstName, "Sarah")
eq("patient last", r0.patientLastName, "Johnson")
eq("member id", r0.patientMemberId, "W123456789")
eq("payer name", r0.payerName, "Aetna")
eq("service date normalized MM/DD/YYYY -> ISO", r0.serviceDate, "2026-06-15")
eq("line 0 cpt", r0.lines[0].cptCode, "99213")
eq("line 0 modifiers", r0.lines[0].modifiers, ["25"])
eq("line 0 icd10", r0.lines[0].icd10Codes, ["I10"])
eq("charge is a number", r0.lines[0].charge, 150)
eq("total charge", r0.totalCharge, 150)
eq("carc codes split", r0.carcCodes, ["197"])
eq("status inferred denied", r0.status, "denied")

console.log("\nrecord 1 — the PAID row (quoted charge with a comma -> 1200)")
const r1 = result.records[1]
eq("charge with embedded comma stripped", r1.lines[0].charge, 1200)
eq("total charge 1200", r1.totalCharge, 1200)
eq("total paid 960", r1.totalPaid, 960)
eq("no carc codes", r1.carcCodes, undefined)
eq("status inferred paid", r1.status, "paid")

console.log("\nrecord 2 — quoted field containing a comma (Provider Name)")
const r2 = result.records[2]
eq("provider name w/ embedded comma", r2.providerName, "Rivera, Marcus PT, DPT")
eq("payer", r2.payerName, "United")
eq("no status, no carc -> open", r2.status, "open")

console.log("\nexplicit mapping override — nonstandard headers")
const weirdCsv = [
  "Acct,Beneficiary,Surname,PolicyNo,PlanName,SvcDt,ProcCode,BilledAmt,ReasonCd",
  "A-77,Lisa,Park,ZZ42,Cigna,20260701,99395,225.00,CO16",
].join("\n")
const mapped = parseCsvBacklog(weirdCsv, {
  externalClaimId: "Acct",
  patientFirstName: "Beneficiary",
  patientLastName: "Surname",
  patientMemberId: "PolicyNo",
  payerName: "PlanName",
  serviceDate: "SvcDt",
  cptCode: "ProcCode",
  charge: "BilledAmt",
  carcCodes: "ReasonCd",
})
const m0 = mapped.records[0]
eq("override: 1 record", mapped.records.length, 1)
eq("override: external claim id", m0.externalClaimId, "A-77")
eq("override: first name", m0.patientFirstName, "Lisa")
eq("override: last name", m0.patientLastName, "Park")
eq("override: member id", m0.patientMemberId, "ZZ42")
eq("override: payer name", m0.payerName, "Cigna")
eq("override: YYYYMMDD -> ISO", m0.serviceDate, "2026-07-01")
eq("override: cpt", m0.lines[0].cptCode, "99395")
eq("override: charge number", m0.lines[0].charge, 225)
eq("override: carc split", m0.carcCodes, ["CO16"])
eq("override: status denied (carc present)", m0.status, "denied")

console.log("\nwarnings — unmapped column + orphan row")
const orphanCsv = [
  "CPT,Charge,SomeWeirdColumn",
  "99213,100.00,foo",
].join("\n")
const orphan = parseCsvBacklog(orphanCsv)
eq("unmapped column warned", orphan.warnings.some((w) => w.includes("SomeWeirdColumn")), true)
eq("orphan row warned (no id/name)", orphan.warnings.some((w) => w.includes("neither a member ID")), true)

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
