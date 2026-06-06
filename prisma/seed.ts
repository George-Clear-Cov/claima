import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Upsert practice
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
  console.log("Practice:", practice.id, practice.name)

  // Upsert provider
  const provider = await prisma.provider.upsert({
    where: { npi: "1234567890" },
    update: {},
    create: {
      practiceId: practice.id,
      firstName: "Emily",
      lastName: "Chen",
      npi: "1234567890",
      taxonomy: "193200000X",
    },
  })
  console.log("Provider:", provider.id, provider.firstName, provider.lastName)

  // Upsert patients
  const patients = [
    { firstName: "Sarah", lastName: "Johnson", dob: new Date("1985-03-15"), gender: "F", memberId: "AET123456789", payerId: "AETNA", payerName: "Aetna", addressLine1: "456 Oak Ave", city: "New York", state: "NY", zip: "10002" },
    { firstName: "Marcus", lastName: "Rivera", dob: new Date("1991-07-22"), gender: "M", memberId: "BCBS987654", payerId: "BCBS", payerName: "BlueCross BlueShield", addressLine1: "789 Pine St", city: "New York", state: "NY", zip: "10003" },
    { firstName: "Amanda", lastName: "Torres", dob: new Date("1978-11-04"), gender: "F", memberId: "UHC456789", payerId: "UHC", payerName: "United Healthcare", addressLine1: "321 Elm St", city: "New York", state: "NY", zip: "10004" },
    { firstName: "David", lastName: "Kim", dob: new Date("1995-02-14"), gender: "M", memberId: "CIG111222", payerId: "CIGNA", payerName: "Cigna", addressLine1: "654 Maple Dr", city: "New York", state: "NY", zip: "10005" },
  ]

  for (const p of patients) {
    const patient = await prisma.patient.upsert({
      where: { id: (await prisma.patient.findFirst({ where: { memberId: p.memberId } }))?.id ?? "00000000-0000-0000-0000-000000000000" },
      update: {},
      create: { practiceId: practice.id, ...p },
    })
    console.log("Patient:", patient.id, patient.firstName, patient.lastName)
  }

  // Upsert demo admin user
  const hashedPassword = await bcrypt.hash("medibill2026", 12)
  const existingUser = await prisma.user.findUnique({ where: { email: "admin@clearviewmentalhealth.com" } })
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: "admin@clearviewmentalhealth.com",
        name: "Dr. Emily Chen",
        hashedPassword,
        practiceId: practice.id,
        role: "ADMIN",
      },
    })
    console.log("User: admin@clearviewmentalhealth.com (password: medibill2026)")
  } else {
    console.log("User already exists:", existingUser.email)
  }

  console.log("\n✅ Seed complete. Use these IDs in your API calls.")
  console.log("PRACTICE_ID=" + practice.id)
  console.log("PROVIDER_ID=" + provider.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
