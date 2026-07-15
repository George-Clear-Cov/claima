/**
 * Backlog import — 835 adapter test. Parses a realistic X12 835 (one DENIED claim w/ CARC 197,
 * one PAID claim w/ contractual CARC 45) into normalized ImportedRecords and asserts the mapping.
 * No network, no DB, no PHI beyond the synthetic fixture.
 *
 * Run:  ~/.bun/bin/bun scripts/import-835-test.ts
 */
import { parse835Backlog } from "../src/lib/import/from835"

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${g}\n      want: ${w}`) }
}

const fixture835 = [
  "ISA*00*          *00*          *ZZ*AETNA          *ZZ*CLAIMA         *260701*1200*^*00501*000000001*0*P*:~",
  "GS*HP*AETNA*CLAIMA*20260701*1200*1*X*005010X221A1~",
  "ST*835*0001~",
  "BPR*I*160.00*C*ACH*CCP*01*021000021*DA*111*1512345678**01*021000021*DA*222*20260701~",
  "TRN*1*EFT123456*1512345678~",
  "N1*PR*AETNA~",
  "N1*PE*RIVERSIDE MEDICAL GROUP*XX*9876543210~",
  // DENIED claim (CLP02=4), CARC 197 at the service line
  "CLP*CLM-1001*4*150.00*0.00*0*12*AETNACLM998877~",
  "NM1*QC*1*JOHNSON*SARAH****MI*W123456789~",
  "SVC*HC:99213*150.00*0.00**1~",
  "CAS*CO*197*150.00~",
  "DTM*472*20260615~",
  // PAID claim (CLP02=1), contractual CARC 45
  "CLP*CLM-1002*1*200.00*160.00*40*12*AETNACLM998878~",
  "NM1*QC*1*RIVERA*JAMES****MI*U987654321~",
  "SVC*HC:99214*200.00*160.00**1~",
  "CAS*CO*45*40.00~",
  "DTM*472*20260616~",
  "SE*16*0001~",
  "GE*1*1~",
  "IEA*1*000000001~",
].join("\n")

const result = parse835Backlog([fixture835])

console.log("parse835Backlog — envelope + records")
eq("format", result.format, "835")
eq("2 records", result.records.length, 2)

console.log("\nrecord 0 — the DENIED claim")
const r0 = result.records[0]
eq("status denied", r0.status, "denied")
eq("patient first", r0.patientFirstName, "SARAH")
eq("patient last", r0.patientLastName, "JOHNSON")
eq("member id", r0.patientMemberId, "W123456789")
eq("payer name", r0.payerName, "AETNA")
eq("provider (billing) npi", r0.providerNpi, "9876543210")
eq("external claim id (CLP01)", r0.externalClaimId, "CLM-1001")
eq("payer control # (CLP07)", r0.payerClaimControlNumber, "AETNACLM998877")
eq("carc codes", r0.carcCodes, ["197"])
eq("service date", r0.serviceDate, "2026-06-15")
eq("total charge", r0.totalCharge, 150)
eq("total paid", r0.totalPaid, 0)
eq("line 0 cpt", r0.lines[0].cptCode, "99213")
eq("line 0 charge", r0.lines[0].charge, 150)

console.log("\nrecord 1 — the PAID claim")
const r1 = result.records[1]
eq("status paid", r1.status, "paid")
eq("carc codes (contractual 45)", r1.carcCodes, ["45"])
eq("total paid", r1.totalPaid, 160)
eq("patient responsibility", r1.patientResponsibility, 40)
eq("line 0 cpt", r1.lines[0].cptCode, "99214")

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
export {}
