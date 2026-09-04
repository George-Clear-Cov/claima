/**
 * Backlog import — 837P adapter test. Parses a realistic inbound X12 837P (one professional claim:
 * subscriber Sarah Johnson, payer Aetna, rendering provider Emily Chen, one SV1 line 99213) into a
 * normalized ImportedRecord and asserts the mapping. The fixture mirrors the segment layout that
 * ../src/lib/837p.ts emits (spec 005010X222A2). No network, no DB, no PHI beyond the synthetic fixture.
 *
 * Run:  ~/.bun/bin/bun scripts/import-837-test.ts
 */
import { parse837Backlog } from "../src/lib/import/from837"

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${g}\n      want: ${w}`) }
}

const fixture837 = [
  "ISA*00*          *00*          *ZZ*RIVERSIDE       *ZZ*60054          *260715*1200*^*00501*000000001*0*P*:~",
  "GS*HC*RIVERSIDE*60054*20260715*1200*1*X*005010X222A2~",
  "ST*837*0001*005010X222A2~",
  "BHT*0019*00*ABC123DEF*20260715*1200*CH~",
  // Submitter (NM1*41) and receiver (NM1*40) — envelope-level, must be ignored by the parser.
  "NM1*41*2*RIVERSIDE MEDICAL GROUP*****46*9999999999~",
  "PER*IC*BILLING*TE*5555551234~",
  "NM1*40*2*AETNA*****46*60054~",
  // Billing provider hierarchical level (NM1*85 — fallback provider).
  "HL*1**20*1~",
  "NM1*85*2*RIVERSIDE MEDICAL GROUP*****XX*9999999999~",
  "N3*100 MAIN ST~",
  "N4*NEWARK*NJ*07102~",
  "REF*EI*123456789~",
  // Subscriber hierarchical level.
  "HL*2*1*22*0~",
  "SBR*P*18**AETNA*****CI~",
  "NM1*IL*1*JOHNSON*SARAH****MI*W123456789~",
  "N3*200 ELM ST~",
  "N4*NEWARK*NJ*07102~",
  "DMG*D8*19850315*F~",
  "NM1*PR*2*AETNA*****PI*60054~",
  // Claim.
  "CLM*CLM-2001*150.00***11:B:1*Y*A*Y*I~",
  "HI*ABK:I10~",
  "DTP*472*D8*20260715~",
  // Rendering provider (NM1*82) — preferred over billing.
  "NM1*82*1*CHEN*EMILY****XX*1234567890~",
  "PRV*PE*PXC*207Q00000X~",
  // Service line.
  "LX*1~",
  "SV1*HC:99213*150.00*UN*1***A~",
  "DTP*472*D8*20260715~",
  "SE*27*0001~",
  "GE*1*1~",
  "IEA*1*000000001~",
].join("\n")

const result = parse837Backlog([fixture837])

console.log("parse837Backlog — envelope + records")
eq("format", result.format, "837")
eq("1 record", result.records.length, 1)

console.log("\nrecord 0 — the submitted claim")
const r0 = result.records[0]
eq("status open", r0.status, "open")
eq("external claim id (CLM01)", r0.externalClaimId, "CLM-2001")
eq("patient first", r0.patientFirstName, "SARAH")
eq("patient last", r0.patientLastName, "JOHNSON")
eq("member id (NM1*IL / NM109)", r0.patientMemberId, "W123456789")
eq("patient dob (DMG*D8)", r0.patientDob, "1985-03-15")
eq("payer name (NM1*PR)", r0.payerName, "AETNA")
eq("payer id", r0.payerId, "60054")
eq("provider npi (NM1*82)", r0.providerNpi, "1234567890")
eq("provider name", r0.providerName, "EMILY CHEN")
eq("service date (DTP*472)", r0.serviceDate, "2026-07-15")
eq("total charge (CLM02)", r0.totalCharge, 150)

console.log("\nrecord 0 — service line")
eq("1 line", r0.lines.length, 1)
eq("line 0 cpt", r0.lines[0].cptCode, "99213")
eq("line 0 charge", r0.lines[0].charge, 150)
eq("line 0 units", r0.lines[0].units, 1)
eq("line 0 icd10 (from HI)", r0.lines[0].icd10Codes, ["I10"])

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
