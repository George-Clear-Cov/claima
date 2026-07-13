import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { readFileSync } from "node:fs"

// Supabase uses a self-signed CA in its certificate chain. We scope that TLS exception to
// THIS database connection only, via the pg Pool's `ssl` option below. We must NOT set
// NODE_TLS_REJECT_UNAUTHORIZED globally — that disables certificate verification for ALL
// outbound HTTPS in the process (PHI to the AI provider, Claim.MD, Stripe), a MITM exposure.
// Azure-migration hook: set PGSSLROOTCERT to a CA-bundle path and the pool verifies the DB cert
// (rejectUnauthorized: true); unset (current/Supabase) keeps the encrypted-but-unverified carve-out.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  if (!connectionString) {
    return new PrismaClient()
  }
  // Azure Postgres (post-migration): set PGSSLROOTCERT to the CA path -> verified TLS.
  // Supabase (current): self-signed CA -> encrypted but unverified (temporary carve-out).
  const caPath = process.env.PGSSLROOTCERT
  const ssl = caPath
    ? { ca: readFileSync(caPath).toString(), rejectUnauthorized: true }
    : { rejectUnauthorized: false }
  const pool = new Pool({ connectionString, ssl })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
