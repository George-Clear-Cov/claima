import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { readFileSync } from "node:fs"

// TLS is verified by DEFAULT (rejectUnauthorized: true) — the pool verifies the DB server cert
// against Node's built-in root store. Azure Postgres Flexible Server presents a publicly-trusted
// cert (DigiCert Global Root G2, SAN *.postgres.database.azure.com) that chains to those roots, so
// no CA file needs bundling. The ONLY carve-out is Supabase, whose self-signed CA can't verify —
// that exception is scoped to the Supabase host alone (and Supabase is being retired). Set
// PGSSLROOTCERT to pin an explicit CA bundle if ever required. We must NEVER set
// NODE_TLS_REJECT_UNAUTHORIZED globally — that disables verification for ALL outbound HTTPS in the
// process (PHI to the AI provider, Claim.MD, Stripe), a MITM exposure.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  if (!connectionString) {
    return new PrismaClient()
  }
  const caPath = process.env.PGSSLROOTCERT
  const isSupabase = /\.supabase\.co(?::|\/|$)/i.test(connectionString)
  const ssl = caPath
    ? { ca: readFileSync(caPath).toString(), rejectUnauthorized: true } // explicit CA pin
    : isSupabase
      ? { rejectUnauthorized: false } // Supabase self-signed CA — scoped carve-out (retiring)
      : { rejectUnauthorized: true } // Azure & all others — verify against system roots
  const pool = new Pool({ connectionString, ssl })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
