/**
 * One-off SQL migration runner.
 * Executes a .sql file against the database using the same pg + relaxed-TLS
 * connection the app uses (Supabase presents a self-signed CA chain).
 *
 * Usage: ~/.bun/bin/bun scripts/run-migration.ts prisma/migration_marketplace_subscription.sql
 */
import { readFileSync } from "fs"
import { Pool } from "pg"

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("usage: bun scripts/run-migration.ts <path-to.sql>")
    process.exit(1)
  }
  const conn = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  if (!conn) {
    console.error("✗ No POSTGRES_PRISMA_URL / DATABASE_URL in env")
    process.exit(1)
  }

  const sql = readFileSync(file, "utf8")
  const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  try {
    console.log(`→ applying ${file}`)
    await pool.query(sql)
    console.log("✓ migration applied")
  } catch (err) {
    console.error("✗ migration failed:", err instanceof Error ? err.message : err)
    await pool.end()
    process.exit(2)
  }
  await pool.end()
}

main()

export {}
