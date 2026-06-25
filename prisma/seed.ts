import { config } from "dotenv"
config({ path: ".env.local", override: false })
config({ path: ".env", override: false })
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
    update: { name: "Riverside Medical Group" },
    create: {
      name: "Riverside Medical Group",
      npi: "9876543210",
      taxId: "12-3456789",
      taxonomy: "193400000X",
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
    update: { taxonomy: "207Q00000X" },
    create: { practiceId: practice.id, firstName: "Emily", lastName: "Chen", npi: "1234567890", taxonomy: "207Q00000X" },
  })
  const prov2 = await prisma.provider.upsert({
    where: { npi: "0987654321" },
    update: { taxonomy: "225100000X" },
    create: { practiceId: practice.id, firstName: "Marcus", lastName: "Rivera", npi: "0987654321", taxonomy: "225100000X" },
  })
  console.log("Providers:", prov1.firstName, prov1.lastName, "(Family Med) /", prov2.firstName, prov2.lastName, "(Physical Therapy)")

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
  const existingUser = await prisma.user.findUnique({ where: { email: "admin@riversidemedgroup.com" } })
  if (!existingUser) {
    // Also check for old email from previous seed
    const oldUser = await prisma.user.findUnique({ where: { email: "admin@clearviewmentalhealth.com" } })
    if (oldUser) {
      await prisma.user.update({ where: { email: "admin@clearviewmentalhealth.com" }, data: { email: "admin@riversidemedgroup.com", name: "Dr. Emily Chen" } })
      console.log("User updated: admin@riversidemedgroup.com")
    } else {
      await prisma.user.create({
        data: { email: "admin@riversidemedgroup.com", name: "Dr. Emily Chen", hashedPassword, practiceId: practice.id, role: "ADMIN" },
      })
      console.log("User created: admin@riversidemedgroup.com / claima2026")
    }
  }

  // ── Claims + Statements ──────────────────────────────────────────────────
  // Always reset claims so seed data stays consistent with the current spec
  const existingClaims = await prisma.claim.count({ where: { practiceId: practice.id } })
  if (existingClaims > 0) {
    console.log(`Resetting ${existingClaims} existing claims…`)
    await prisma.patientStatement.deleteMany({ where: { claim: { practiceId: practice.id } } })
    await prisma.denial.deleteMany({ where: { claim: { practiceId: practice.id } } })
    await prisma.claimLine.deleteMany({ where: { claim: { practiceId: practice.id } } })
    await prisma.claim.deleteMany({ where: { practiceId: practice.id } })
  }

  type ClaimSpec = {
    providerId: string; patientId: string; daysBack: number
    cpt: string; icd10: string[]; charge: number; description: string
    status: "PAID" | "SUBMITTED" | "DENIED" | "ACCEPTED" | "DRAFT"
    insPaid?: number; adj?: number; patPaid?: number
    denial?: { carcCode: string; denialReason: string; category: string; priority: string; action: string; appealable: boolean }
  }

  const SPECS: ClaimSpec[] = [
    // ── PAID — Family Medicine (E&M + preventive) ────────────────────────
    { providerId: prov1.id, patientId: pat1.id, daysBack: 175, cpt: "99214", icd10: ["I10", "E78.5"], charge: 175, description: "Office visit — hypertension & hyperlipidemia mgmt", status: "PAID", insPaid: 130, adj: 20, patPaid: 25 },
    { providerId: prov1.id, patientId: pat3.id, daysBack: 168, cpt: "99395", icd10: ["Z00.00"], charge: 220, description: "Annual wellness exam, established patient", status: "PAID", insPaid: 180, adj: 25, patPaid: 15 },
    { providerId: prov1.id, patientId: pat4.id, daysBack: 160, cpt: "99203", icd10: ["E11.9", "I10"], charge: 185, description: "New patient office visit — type 2 diabetes", status: "PAID", insPaid: 140, adj: 20, patPaid: 25 },
    { providerId: prov1.id, patientId: pat5.id, daysBack: 155, cpt: "99213", icd10: ["J06.9"], charge: 130, description: "Office visit — acute upper respiratory infection", status: "PAID", insPaid: 100, adj: 15, patPaid: 15 },
    { providerId: prov1.id, patientId: pat2.id, daysBack: 148, cpt: "99214", icd10: ["M54.50", "M51.16"], charge: 175, description: "Office visit — low back pain with radiculopathy", status: "PAID", insPaid: 130, adj: 20, patPaid: 25 },

    // ── PAID — Physical Therapy ───────────────────────────────────────────
    { providerId: prov2.id, patientId: pat2.id, daysBack: 140, cpt: "97110", icd10: ["M54.50"], charge: 90, description: "Therapeutic exercise, 15 min — lumbar stabilization", status: "PAID", insPaid: 68, adj: 12, patPaid: 10 },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 133, cpt: "97140", icd10: ["M25.511"], charge: 95, description: "Manual therapy — right shoulder", status: "PAID", insPaid: 72, adj: 13, patPaid: 10 },
    { providerId: prov2.id, patientId: pat2.id, daysBack: 126, cpt: "97530", icd10: ["M54.50"], charge: 85, description: "Therapeutic activities — functional mobility", status: "PAID", insPaid: 64, adj: 11, patPaid: 10 },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 119, cpt: "97110", icd10: ["M25.511"], charge: 90, description: "Therapeutic exercise, 15 min — rotator cuff", status: "PAID", insPaid: 68, adj: 12, patPaid: 10 },

    // ── PAID — Mixed follow-ups ───────────────────────────────────────────
    { providerId: prov1.id, patientId: pat1.id, daysBack: 112, cpt: "99213", icd10: ["I10"], charge: 130, description: "Office visit — blood pressure follow-up", status: "PAID", insPaid: 100, adj: 15, patPaid: 15 },
    { providerId: prov1.id, patientId: pat4.id, daysBack: 105, cpt: "99213", icd10: ["E11.9"], charge: 130, description: "Office visit — diabetes management", status: "PAID", insPaid: 100, adj: 15, patPaid: 15 },
    { providerId: prov2.id, patientId: pat2.id, daysBack: 98,  cpt: "97140", icd10: ["M54.50"], charge: 95, description: "Manual therapy — lumbar spine", status: "PAID", insPaid: 72, adj: 13, patPaid: 10 },
    { providerId: prov1.id, patientId: pat3.id, daysBack: 91,  cpt: "99214", icd10: ["E11.9", "E78.5"], charge: 175, description: "Office visit — diabetes & lipids quarterly review", status: "PAID", insPaid: 130, adj: 20, patPaid: 25 },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 84,  cpt: "97530", icd10: ["M25.511"], charge: 85, description: "Therapeutic activities — ADL training", status: "PAID", insPaid: 64, adj: 11, patPaid: 10 },

    // ── DENIED (recent, needs appeals) ───────────────────────────────────
    { providerId: prov1.id, patientId: pat3.id, daysBack: 77, cpt: "99215", icd10: ["E11.9", "I10", "E78.5"], charge: 230, description: "High complexity office visit — multiple chronic conditions", status: "DENIED",
      denial: { carcCode: "50", denialReason: "Medical necessity not established for high-complexity visit code", category: "Medical Necessity", priority: "High", action: "Submit clinical notes documenting time/complexity or downcode to 99214", appealable: true } },
    { providerId: prov2.id, patientId: pat4.id, daysBack: 63, cpt: "97110", icd10: ["M54.50"], charge: 90, description: "Therapeutic exercise — lumbar", status: "DENIED",
      denial: { carcCode: "197", denialReason: "Prior authorization required for physical therapy services", category: "Prior Auth", priority: "High", action: "Obtain retro authorization or submit appeal with plan of care", appealable: true } },
    { providerId: prov1.id, patientId: pat5.id, daysBack: 42, cpt: "99395", icd10: ["Z00.00"], charge: 220, description: "Annual wellness exam", status: "DENIED",
      denial: { carcCode: "4", denialReason: "Preventive service not covered under patient benefit plan", category: "Coverage", priority: "Medium", action: "Verify patient benefits and resubmit or bill patient directly", appealable: true } },

    // ── SUBMITTED / ACCEPTED (in-flight) ─────────────────────────────────
    { providerId: prov1.id, patientId: pat1.id, daysBack: 35, cpt: "99214", icd10: ["I10", "E78.5"], charge: 175, description: "Office visit — chronic disease management", status: "SUBMITTED" },
    { providerId: prov2.id, patientId: pat2.id, daysBack: 28, cpt: "97110", icd10: ["M54.50"], charge: 90, description: "Therapeutic exercise — core strengthening", status: "ACCEPTED" },
    { providerId: prov1.id, patientId: pat4.id, daysBack: 21, cpt: "99213", icd10: ["E11.9"], charge: 130, description: "Office visit — diabetes follow-up", status: "SUBMITTED" },
    { providerId: prov2.id, patientId: pat5.id, daysBack: 14, cpt: "97140", icd10: ["M25.511"], charge: 95, description: "Manual therapy — shoulder mobilization", status: "ACCEPTED" },

    // ── DRAFT ─────────────────────────────────────────────────────────────
    { providerId: prov1.id, patientId: pat3.id, daysBack: 3, cpt: "99214", icd10: ["E11.9", "I10"], charge: 175, description: "Office visit — quarterly chronic disease review", status: "DRAFT" },
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
  console.log("Login: admin@riversidemedgroup.com / claima2026")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
