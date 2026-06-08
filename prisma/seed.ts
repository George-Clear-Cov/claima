import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10, 0, 0, 0)
  return d
}

async function main() {
  // ── Practice ─────────────────────────────────────────────────────────────
  const practice = await prisma.practice.upsert({
    where: { npi: "9876543210" },
    update: {},
    create: {
      name: "Clearview Mental Health",
      npi: "9876543210",
      taxId: "12-3456789",
      taxonomy: "193200000X",
      addressLine1: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      phone: "2125551234",
    },
  })
  console.log("Practice:", practice.name)

  // ── Providers ────────────────────────────────────────────────────────────
  const prov1 = await prisma.provider.upsert({
    where: { npi: "1234567890" },
    update: {},
    create: { practiceId: practice.id, firstName: "Emily", lastName: "Chen", npi: "1234567890", taxonomy: "103T00000X" },
  })
  const prov2 = await prisma.provider.upsert({
    where: { npi: "0987654321" },
    update: {},
    create: { practiceId: practice.id, firstName: "Marcus", lastName: "Rivera", npi: "0987654321", taxonomy: "101YM0800X" },
  })
  console.log("Providers:", prov1.firstName, prov1.lastName, "/", prov2.firstName, prov2.lastName)

  // ── Patients ─────────────────────────────────────────────────────────────
  type PatientInput = { firstName: string; lastName: string; dob: Date; gender: string; memberId: string; payerId: string; payerName: string; addressLine1: string; city: string; state: string; zip: string }
  async function upsertPatient(memberId: string, data: PatientInput) {
    const existing = await prisma.patient.findFirst({ where: { memberId } })
    if (existing) return existing
    return prisma.patient.create({ data: { practiceId: practice.id, ...data } })
  }

  const [pat1, pat2, pat3, pat4, pat5] = await Promise.all([
    upsertPatient("AET123456789", { firstName: "Sarah", lastName: "Johnson", dob: new Date("1985-03-15"), gender: "F", memberId: "AET123456789", payerId: "AETNA", payerName: "Aetna", addressLine1: "456 Oak Ave", city: "New York", state: "NY", zip: "10002" }),
    upsertPatient("BCBS987654", { firstName: "James", lastName: "Rivera", dob: new Date("1991-07-22"), gender: "M", memberId: "BCBS987654", payerId: "BCBS", payerName: "BlueCross BlueShield", addressLine1: "789 Pine St", city: "New York", state: "NY", zip: "10003" }),
    upsertPatient("UHC456789", { firstName: "Amanda", lastName: "Torres", dob: new Date("1978-11-04"), gender: "F", memberId: "UHC456789", payerId: "UHC", payerName: "United Healthcare", addressLine1: "321 Elm St", city: "New York", state: "NY", zip: "10004" }),
    upsertPatient("CIG111222", { firstName: "David", lastName: "Kim", dob: new Date("1995-02-14"), gender: "M", memberId: "CIG111222", payerId: "CIGNA", payerName: "Cigna", addressLine1: "654 Maple Dr", city: "New York", state: "NY", zip: "10005" }),
    upsertPatient("HUM778899", { firstName: "Lisa", lastName: "Park", dob: new Date("1982-09-30"), gender: "F", memberId: "HUM778899", payerId: "HUMANA", payerName: "Humana", addressLine1: "987 Cedar Ln", city: "New York", state: "NY", zip: "10006" }),
  ])
  console.log("Patients: 5 upserted")

  // ── User ─────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("claima2026", 12)
  const existingUser = await prisma.user.findUnique({ where: { email: "admin@clearviewmentalhealth.com" } })
  if (!existingUser) {
    await prisma.user.create({
      data: { email: "admin@clearviewmentalhealth.com", name: "Dr. Emily Chen", hashedPassword, practiceId: practice.id, role: "ADMIN" },
    })
    console.log("User created: admin@clearviewmentalhealth.com / claima2026")
  }

  // ── Claims + Statements ──────────────────────────────────────────────────
  // Skip if substantial history already exists
  const existingClaims = await prisma.claim.count({ where: { practiceId: practice.id } })
  if (existingClaims >= 10) {
    console.log(`Skipping claim seed — ${existingClaims} claims already exist`)
    console.log("\n✅ Seed complete.")
    return
  }

  type ClaimSpec = {
    providerId: string; patientId: string; daysBack: number
    cpt: string; icd10: string[]; charge: number; description: string
    status: "PAID" | "SUBMITTED" | "DENIED" | "ACCEPTED" | "DRAFT"
    insPaid?: number; adj?: number; patPaid?: number
    denial?: { carcCode: string; denialReason: string; category: string; priority: string; action: string; appealable: boolean }
  }

  const SPECS: ClaimSpec[] = [
    // ── PAID (6+ months, complete billing history) ────────────────────────
    { providerId: prov1.id, patientId: pat1.id, daysBack: 175, cpt: "90837", icd10: ["F32.1", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 140, adj: 20, patPaid: 40 },
    { providerId: prov1.id, patientId: pat2.id, daysBack: 168, cpt: "90834", icd10: ["F33.0"], charge: 160, description: "45 min psychotherapy", status: "PAID", insPaid: 120, adj: 15, patPaid: 25 },
    { providerId: prov2.id, patientId: pat3.id, daysBack: 160, cpt: "90837", icd10: ["F40.10", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 150, adj: 25, patPaid: 25 },
    { providerId: prov2.id, patientId: pat4.id, daysBack: 155, cpt: "90791", icd10: ["F32.9"], charge: 300, description: "Psychiatric diagnostic eval", status: "PAID", insPaid: 240, adj: 30, patPaid: 30 },
    { providerId: prov1.id, patientId: pat5.id, daysBack: 148, cpt: "90837", icd10: ["F43.10"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 155, adj: 20, patPaid: 25 },

    { providerId: prov1.id, patientId: pat1.id, daysBack: 140, cpt: "90837", icd10: ["F32.1", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 140, adj: 20, patPaid: 40 },
    { providerId: prov2.id, patientId: pat2.id, daysBack: 133, cpt: "90834", icd10: ["F33.0"], charge: 160, description: "45 min psychotherapy", status: "PAID", insPaid: 120, adj: 15, patPaid: 25 },
    { providerId: prov1.id, patientId: pat3.id, daysBack: 126, cpt: "90837", icd10: ["F40.10"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 150, adj: 25, patPaid: 25 },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 119, cpt: "90837", icd10: ["F43.10", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 155, adj: 20, patPaid: 25 },
    { providerId: prov1.id, patientId: pat4.id, daysBack: 112, cpt: "90847", icd10: ["Z63.0", "F32.9"], charge: 240, description: "Family psychotherapy w/ patient", status: "PAID", insPaid: 185, adj: 25, patPaid: 30 },

    { providerId: prov1.id, patientId: pat1.id, daysBack: 105, cpt: "90837", icd10: ["F32.1", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 140, adj: 20, patPaid: 40 },
    { providerId: prov2.id, patientId: pat3.id, daysBack: 98,  cpt: "90837", icd10: ["F40.10"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 150, adj: 25, patPaid: 25 },
    { providerId: prov1.id, patientId: pat2.id, daysBack: 91,  cpt: "90834", icd10: ["F33.0"], charge: 160, description: "45 min psychotherapy", status: "PAID", insPaid: 120, adj: 15, patPaid: 25 },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 84,  cpt: "90837", icd10: ["F43.10"], charge: 200, description: "60 min psychotherapy", status: "PAID", insPaid: 155, adj: 20, patPaid: 25 },

    // ── DENIED (recent, needs appeals) ───────────────────────────────────
    { providerId: prov1.id, patientId: pat2.id, daysBack: 77, cpt: "90837", icd10: ["F33.0", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "DENIED",
      denial: { carcCode: "197", denialReason: "Prior authorization required for ongoing psychotherapy", category: "Prior Auth", priority: "High", action: "Obtain retro auth or appeal with clinical notes", appealable: true } },
    { providerId: prov2.id, patientId: pat4.id, daysBack: 63, cpt: "90791", icd10: ["F32.9"], charge: 300, description: "Psychiatric diagnostic eval", status: "DENIED",
      denial: { carcCode: "4", denialReason: "Service not covered under patient's benefit plan", category: "Coverage", priority: "Medium", action: "Verify benefits and submit corrected claim", appealable: true } },
    { providerId: prov1.id, patientId: pat5.id, daysBack: 42, cpt: "90837", icd10: ["F43.10"], charge: 200, description: "60 min psychotherapy", status: "DENIED",
      denial: { carcCode: "16", denialReason: "Claim lacks information required for adjudication — missing NPI", category: "Administrative", priority: "Low", action: "Resubmit with complete rendering provider NPI", appealable: false } },

    // ── SUBMITTED / ACCEPTED (in-flight) ─────────────────────────────────
    { providerId: prov1.id, patientId: pat1.id, daysBack: 35, cpt: "90837", icd10: ["F32.1", "F41.1"], charge: 200, description: "60 min psychotherapy", status: "SUBMITTED" },
    { providerId: prov2.id, patientId: pat3.id, daysBack: 28, cpt: "90834", icd10: ["F40.10"], charge: 160, description: "45 min psychotherapy", status: "ACCEPTED" },
    { providerId: prov1.id, patientId: pat2.id, daysBack: 21, cpt: "90837", icd10: ["F33.0"], charge: 200, description: "60 min psychotherapy", status: "SUBMITTED" },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 14, cpt: "90847", icd10: ["Z63.0", "F43.10"], charge: 240, description: "Family psychotherapy w/ patient", status: "ACCEPTED" },

    // ── DRAFT ─────────────────────────────────────────────────────────────
    { providerId: prov1.id, patientId: pat4.id, daysBack: 3, cpt: "90837", icd10: ["F32.9"], charge: 200, description: "60 min psychotherapy", status: "DRAFT" },
  ]

  for (const spec of SPECS) {
    const serviceDate = daysAgo(spec.daysBack)
    const submittedAt = spec.status !== "DRAFT" ? new Date(serviceDate.getTime() + 2 * 3600000) : null
    const paidAt = spec.status === "PAID" ? new Date(serviceDate.getTime() + 21 * 86400000) : null

    const claim = await prisma.claim.create({
      data: {
        practiceId: practice.id,
        providerId: spec.providerId,
        patientId: spec.patientId,
        serviceDate,
        totalCharge: spec.charge,
        claimStatus: spec.status,
        stediClaimId: spec.status !== "DRAFT" ? `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null,
        submittedAt,
        paidAmount: spec.status === "PAID" ? (spec.insPaid ?? 0) : null,
        paidAt,
        lineItems: {
          create: [{
            cptCode: spec.cpt,
            icd10Codes: spec.icd10,
            units: 1,
            chargeAmount: spec.charge,
            description: spec.description,
          }],
        },
      },
    })

    // Statement for PAID claims
    if (spec.status === "PAID" && spec.insPaid !== undefined) {
      const patientOwes = Math.max(spec.charge - spec.insPaid - (spec.adj ?? 0), 0)
      const patientPaid = spec.patPaid ?? 0
      await prisma.patientStatement.create({
        data: {
          patientId: spec.patientId,
          claimId: claim.id,
          totalCharge: spec.charge,
          insurancePaid: spec.insPaid,
          adjustments: spec.adj ?? 0,
          patientOwes,
          patientPaid,
          balanceDue: Math.max(patientOwes - patientPaid, 0),
          statementStatus: patientPaid >= patientOwes ? "PAID" : patientPaid > 0 ? "PARTIAL" : "PENDING",
          dueDate: new Date(serviceDate.getTime() + 30 * 86400000),
          paidAt: patientPaid >= patientOwes ? paidAt : null,
        },
      })
    }

    // Denial for DENIED claims
    if (spec.status === "DENIED" && spec.denial) {
      await prisma.denial.create({
        data: {
          claimId: claim.id,
          ...spec.denial,
          appealStatus: "PENDING",
        },
      })
    }
  }

  console.log(`Created ${SPECS.length} claims with statements and denials`)
  console.log("\n✅ Seed complete.")
  console.log("Login: admin@clearviewmentalhealth.com / claima2026")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
