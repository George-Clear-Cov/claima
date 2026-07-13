import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Supabase uses a self-signed CA in its certificate chain. We scope that TLS exception to
// THIS database connection only, via the pg Pool's `ssl` option below. We must NOT set
// NODE_TLS_REJECT_UNAUTHORIZED globally — that disables certificate verification for ALL
// outbound HTTPS in the process (PHI to the AI provider, Claim.MD, Stripe), a MITM exposure.
// TODO(azure-migration): switch the pool to `ssl: { ca: <azure-ca>, rejectUnauthorized: true }`
// to verify the DB cert too, removing this exception entirely.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  if (!connectionString) {
    return new PrismaClient()
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
