/**
 * Additive demo-data scale-up for the Riverside Medical Group demo practice.
 * Makes the app look like a real, busy practice for screenshots/demos:
 *   - adds more patients (varied payers)
 *   - adds ~55 DENIED claims (varied CARC/priority, IN_PROGRESS + AI-drafted appeal)
 *   - adds ~320 PAID claims so the denial RATE stays realistic (~14%, not 100%)
 *
 * Idempotent: everything it creates is tagged stediClaimId = "SCALE-...", and the
 * script deletes prior SCALE- data before re-adding. Your original seed data is untouched.
 *
 * Run (from a terminal with DB access):
 *   ~/.bun/bin/bun scripts/seed-demo-scale.ts
 */
import { config } from "dotenv"
config({ path: ".env.local", override: false })
config({ path: ".env", override: false })
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d }
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const N_DENIED = 65
const N_PAID = 380

const NEW_PATIENTS = [
  { firstName: "Robert", lastName: "Nguyen", dob: "1970-05-12", gender: "M", memberId: "AET-RN-4021", payerId: "AETNA", payerName: "Aetna" },
  { firstName: "Maria", lastName: "Gonzalez", dob: "1988-09-03", gender: "F", memberId: "BCBS-MG-7788", payerId: "BCBS", payerName: "BlueCross BlueShield" },
  { firstName: "James", lastName: "Whitfield", dob: "1962-01-27", gender: "M", memberId: "MCR-JW-1102", payerId: "MEDICARE", payerName: "Medicare" },
  { firstName: "Patricia", lastName: "Osei", dob: "1979-06-18", gender: "F", memberId: "UHC-PO-3345", payerId: "UHC", payerName: "United Healthcare" },
  { firstName: "Daniel", lastName: "Rossi", dob: "1994-12-09", gender: "M", memberId: "CIG-DR-6650", payerId: "CIGNA", payerName: "Cigna" },
  { firstName: "Emily", lastName: "Zhang", dob: "1990-03-22", gender: "F", memberId: "ANT-EZ-2210", payerId: "ANTHEM", payerName: "Anthem" },
  { firstName: "Michael", lastName: "Brennan", dob: "1957-08-14", gender: "M", memberId: "MCR-MB-9931", payerId: "MEDICARE", payerName: "Medicare" },
  { firstName: "Sofia", lastName: "Ramirez", dob: "1985-11-30", gender: "F", memberId: "HUM-SR-4407", payerId: "HUMANA", payerName: "Humana" },
  { firstName: "Christopher", lastName: "Lee", dob: "1972-04-05", gender: "M", memberId: "AET-CL-5583", payerId: "AETNA", payerName: "Aetna" },
  { firstName: "Angela", lastName: "Foster", dob: "1968-07-19", gender: "F", memberId: "BCBS-AF-1299", payerId: "BCBS", payerName: "BlueCross BlueShield" },
  { firstName: "Thomas", lastName: "Okafor", dob: "1983-02-11", gender: "M", memberId: "OSC-TO-7712", payerId: "OSCAR", payerName: "Oscar Health" },
  { firstName: "Rachel", lastName: "Cohen", dob: "1991-10-08", gender: "F", memberId: "UHC-RC-8830", payerId: "UHC", payerName: "United Healthcare" },
  { firstName: "Kevin", lastName: "Patel", dob: "1976-05-25", gender: "M", memberId: "CIG-KP-3391", payerId: "CIGNA", payerName: "Cigna" },
  { firstName: "Nicole", lastName: "Turner", dob: "1989-12-16", gender: "F", memberId: "ANT-NT-5540", payerId: "ANTHEM", payerName: "Anthem" },
  { firstName: "Brian", lastName: "Sullivan", dob: "1960-09-02", gender: "M", memberId: "MCR-BS-2214", payerId: "MEDICARE", payerName: "Medicare" },
  { firstName: "Grace", lastName: "Adeyemi", dob: "1993-06-28", gender: "F", memberId: "AET-GA-9987", payerId: "AETNA", payerName: "Aetna" },
  { firstName: "Steven", lastName: "Wright", dob: "1981-03-13", gender: "M", memberId: "HUM-SW-6604", payerId: "HUMANA", payerName: "Humana" },
  { firstName: "Laura", lastName: "Mitchell", dob: "1974-11-21", gender: "F", memberId: "BCBS-LM-3378", payerId: "BCBS", payerName: "BlueCross BlueShield" },
]

const SERVICES = [
  { cpt: "99213", charge: 130, icd: ["I10"], desc: "Office visit — hypertension follow-up", units: 1 },
  { cpt: "99214", charge: 175, icd: ["E11.9", "I10"], desc: "Office visit — chronic disease management", units: 1 },
  { cpt: "99215", charge: 230, icd: ["E11.9", "I10", "E78.5"], desc: "High-complexity office visit", units: 1 },
  { cpt: "99204", charge: 290, icd: ["M54.50"], desc: "New patient — moderate complexity", units: 1 },
  { cpt: "99205", charge: 350, icd: ["E11.9", "I10"], desc: "New patient — high complexity", units: 1 },
  { cpt: "99395", charge: 220, icd: ["Z00.00"], desc: "Annual wellness exam, established", units: 1 },
  { cpt: "99396", charge: 245, icd: ["Z00.00"], desc: "Annual wellness exam (40-64)", units: 1 },
  { cpt: "97110", charge: 135, icd: ["M54.50"], desc: "Therapeutic exercise (3 units)", units: 3 },
  { cpt: "97140", charge: 150, icd: ["M25.511"], desc: "Manual therapy (2 units)", units: 2 },
  { cpt: "97530", charge: 170, icd: ["M54.50"], desc: "Therapeutic activities (2 units)", units: 2 },
  { cpt: "20610", charge: 310, icd: ["M17.11"], desc: "Major joint injection — knee, w/ US guidance", units: 1 },
  { cpt: "20552", charge: 180, icd: ["M79.18"], desc: "Trigger point injection, 1-2 muscles", units: 1 },
  { cpt: "96372", charge: 420, icd: ["M06.9"], desc: "Injection administration + medication (J-code)", units: 1 },
  { cpt: "11042", charge: 310, icd: ["L97.909"], desc: "Debridement, subcutaneous tissue", units: 1 },
  { cpt: "11043", charge: 480, icd: ["L97.909"], desc: "Debridement, muscle/fascia", units: 1 },
  { cpt: "10060", charge: 230, icd: ["L02.91"], desc: "Incision & drainage of abscess", units: 1 },
  { cpt: "93000", charge: 150, icd: ["R00.2"], desc: "ECG with interpretation", units: 1 },
  { cpt: "94010", charge: 120, icd: ["J45.909"], desc: "Spirometry", units: 1 },
]

const CARCS = [
  { code: "50", reason: "Medical necessity not established for the service billed", category: "Medical Necessity", priority: "High", action: "Submit clinical notes supporting medical necessity or downcode" },
  { code: "197", reason: "Prior authorization required and not obtained", category: "Prior Auth", priority: "High", action: "Obtain retro authorization or appeal with plan of care" },
  { code: "4", reason: "Preventive service not covered under patient benefit plan", category: "Coverage", priority: "Medium", action: "Verify benefits and resubmit or bill patient" },
  { code: "16", reason: "Claim lacks information or has a submission error (N265)", category: "Missing Info", priority: "Medium", action: "Correct missing information and resubmit" },
  { code: "45", reason: "Charge exceeds fee schedule / maximum allowable amount", category: "Underpayment", priority: "Medium", action: "Verify contracted rate; appeal underpayment" },
  { code: "11", reason: "Diagnosis inconsistent with the procedure performed", category: "Coding", priority: "Medium", action: "Review coding; correct dx-procedure alignment" },
  { code: "27", reason: "Expenses incurred after coverage terminated", category: "Eligibility", priority: "High", action: "Verify eligibility for date of service; bill correct payer" },
  { code: "96", reason: "Non-covered charge under the patient's plan", category: "Coverage", priority: "Medium", action: "Verify coverage; appeal or bill patient" },
  { code: "18", reason: "Duplicate claim or service", category: "Duplicate", priority: "Low", action: "Confirm not a duplicate; resubmit with documentation" },
]

const draftLetter = (payer: string, cpt: string) =>
  `Appeal to ${payer} Appeals Department: We respectfully request reconsideration of the denial for CPT ${cpt}. ` +
  `The service was medically necessary and appropriately documented per the attached clinical notes. [AI-generated draft — pending review]`

const sid = () => `SCALE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function runBatched(n: number, fn: () => Promise<void>) {
  for (let i = 0; i < n; i += 20) {
    await Promise.all(Array.from({ length: Math.min(20, n - i) }, () => fn()))
  }
}

async function main() {
  const practice = await prisma.practice.findFirst({ where: { npi: "9876543210" } })
  if (!practice) throw new Error("Riverside practice (npi 9876543210) not found — run the base seed first")
  const providers = await prisma.provider.findMany({ where: { practiceId: practice.id } })
  if (!providers.length) throw new Error("No providers found for the practice")

  // Idempotency: remove any prior SCALE- data (leaves original seed untouched)
  const prior = await prisma.claim.findMany({ where: { practiceId: practice.id, stediClaimId: { startsWith: "SCALE-" } }, select: { id: true } })
  if (prior.length) {
    const ids = prior.map((c) => c.id)
    await prisma.denial.deleteMany({ where: { claimId: { in: ids } } })
    await prisma.patientStatement.deleteMany({ where: { claimId: { in: ids } } })
    await prisma.claimLine.deleteMany({ where: { claimId: { in: ids } } })
    await prisma.claim.deleteMany({ where: { id: { in: ids } } })
    console.log(`Removed ${ids.length} prior SCALE- claims (idempotent re-run)`)
  }

  // Patients: existing + new
  const patients = await prisma.patient.findMany({ where: { practiceId: practice.id } })
  for (const np of NEW_PATIENTS) {
    const found = await prisma.patient.findFirst({ where: { memberId: np.memberId } })
    if (found) { patients.push(found); continue }
    const created = await prisma.patient.create({
      data: {
        practiceId: practice.id, firstName: np.firstName, lastName: np.lastName, dob: new Date(np.dob),
        gender: np.gender, memberId: np.memberId, payerId: np.payerId, payerName: np.payerName,
        addressLine1: `${rnd(100, 999)} Broadway`, city: "New York", state: "NY", zip: `100${rnd(10, 99)}`,
      },
    })
    patients.push(created)
  }
  console.log(`Patients: ${patients.length} total`)

  let deniedTotal = 0

  await runBatched(N_DENIED, async () => {
    const svc = pick(SERVICES), carc = pick(CARCS), prov = pick(providers), pat = pick(patients)
    const serviceDate = daysAgo(rnd(4, 85))
    const claim = await prisma.claim.create({
      data: {
        practiceId: practice.id, providerId: prov.id, patientId: pat.id, serviceDate,
        totalCharge: svc.charge, claimStatus: "DENIED", stediClaimId: sid(),
        submittedAt: new Date(serviceDate.getTime() + 2 * 3600000),
        denialCode: carc.code, denialReason: carc.reason,
        lineItems: { create: [{ cptCode: svc.cpt, icd10Codes: svc.icd, units: svc.units, chargeAmount: svc.charge, description: svc.desc }] },
      },
    })
    // Realistic pipeline mix: ~40% new (PENDING), ~40% AI-drafted (IN_PROGRESS),
    // ~12% SUBMITTED, ~8% WON — so all four stat cards populate.
    const r = Math.random()
    const appealStatus = r < 0.4 ? "PENDING" : r < 0.8 ? "IN_PROGRESS" : r < 0.92 ? "SUBMITTED" : "WON"
    const worked = appealStatus !== "PENDING"
    await prisma.denial.create({
      data: {
        claimId: claim.id, carcCode: carc.code, denialReason: carc.reason, category: carc.category,
        priority: carc.priority, action: carc.action, appealable: carc.code !== "18",
        appealStatus,
        appealLetter: worked ? draftLetter(pat.payerName, svc.cpt) : null,
        appealedAt: worked ? new Date() : null,
        resolvedAt: appealStatus === "WON" ? new Date() : null,
        resolution: appealStatus === "WON" ? "Appeal approved — claim reprocessed and paid at contracted rate" : null,
      },
    })
    deniedTotal += svc.charge
  })

  await runBatched(N_PAID, async () => {
    const svc = pick(SERVICES), prov = pick(providers), pat = pick(patients)
    const serviceDate = daysAgo(rnd(10, 180))
    const insPaid = Math.round(svc.charge * 0.72)
    const adj = Math.round(svc.charge * 0.13)
    const paidAt = new Date(serviceDate.getTime() + 21 * 86400000)
    const claim = await prisma.claim.create({
      data: {
        practiceId: practice.id, providerId: prov.id, patientId: pat.id, serviceDate,
        totalCharge: svc.charge, claimStatus: "PAID", stediClaimId: sid(),
        submittedAt: new Date(serviceDate.getTime() + 2 * 3600000),
        paidAmount: insPaid, paidAt,
        lineItems: { create: [{ cptCode: svc.cpt, icd10Codes: svc.icd, units: svc.units, chargeAmount: svc.charge, description: svc.desc }] },
      },
    })
    // Statement so analytics/billing see collections (~80% of patients have paid in full)
    const patientOwes = Math.max(svc.charge - insPaid - adj, 0)
    const fullyPaid = Math.random() < 0.8
    const patientPaid = fullyPaid ? patientOwes : Math.random() < 0.5 ? Math.round(patientOwes / 2) : 0
    await prisma.patientStatement.create({
      data: {
        patientId: pat.id, claimId: claim.id, totalCharge: svc.charge,
        insurancePaid: insPaid, adjustments: adj, patientOwes, patientPaid,
        balanceDue: Math.max(patientOwes - patientPaid, 0),
        statementStatus: patientPaid >= patientOwes ? "PAID" : patientPaid > 0 ? "PARTIAL" : "PENDING",
        dueDate: new Date(serviceDate.getTime() + 30 * 86400000),
        paidAt: patientPaid >= patientOwes ? paidAt : null,
      },
    })
  })

  const totalDenials = await prisma.denial.count({ where: { claim: { practiceId: practice.id } } })
  const totalClaims = await prisma.claim.count({ where: { practiceId: practice.id } })
  console.log(`\n✅ Added ${N_DENIED} denials + ${N_PAID} paid claims`)
  console.log(`   Total denials: ${totalDenials} | Total claims: ${totalClaims} | denial rate ~${Math.round((totalDenials / totalClaims) * 100)}%`)
  console.log(`   Revenue at risk added: ~$${deniedTotal.toLocaleString()}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
