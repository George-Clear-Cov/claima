#!/usr/bin/env bun
/**
 * claima code audit — enforces the non-negotiable rules in CLAUDE.md.
 *
 * Run:  bun scripts/audit.ts
 * Exits non-zero if any CRITICAL or HIGH findings exist (fails CI / blocks commit).
 * MEDIUM / LOW are reported as warnings only.
 *
 * This is the fast, deterministic gate. The deeper LLM audit (background agent /
 * scheduled job) catches subtler issues this regex pass can't see.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
interface Finding { severity: Severity; file: string; line: number; check: string; message: string; fix: string }

const ROOT = process.cwd()
const SRC = join(ROOT, "src")
const findings: Finding[] = []

// Routes that are legitimately public (no session required).
const PUBLIC_ROUTE_SUBSTR = [
  "/api/auth/login", "/api/auth/register", "/api/auth/forgot-password",
  "/api/auth/reset-password", "/api/auth/azure", "/api/auth/logout", "/api/auth-check",
  "/api/webhooks/", "/api/pay/", "/api/store/", "/api/checkout",
  "/api/products", "/api/marketplace/",
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

function rel(file: string) { return relative(ROOT, file).replace(/\\/g, "/") }
function add(f: Finding) { findings.push(f) }

const files = walk(SRC)

for (const file of files) {
  const path = rel(file)
  const src = readFileSync(file, "utf8")
  const lines = src.split("\n")
  const isRoute = /src\/app\/api\/.*route\.(ts|tsx)$/.test(path)
  const isPrismaLib = path === "src/lib/prisma.ts"

  lines.forEach((text, i) => {
    const ln = i + 1

    // 1 · Prisma must be dynamically imported (CRITICAL)
    if (/^\s*import\s[^\n]*["']@\/lib\/prisma["']/.test(text)) {
      add({ severity: "CRITICAL", file: path, line: ln, check: "prisma-dynamic-import",
        message: "Static import of @/lib/prisma — breaks in serverless.",
        fix: 'Use:  const { prisma } = await import("@/lib/prisma")' })
    }
    if (!isPrismaLib && /new\s+PrismaClient\s*\(/.test(text)) {
      add({ severity: "CRITICAL", file: path, line: ln, check: "prisma-dynamic-import",
        message: "Direct `new PrismaClient()` — missing adapter / connection pooling.",
        fix: "Import the shared client from @/lib/prisma instead." })
    }

    // 2 · practiceId must never come from request input (CRITICAL)
    if (/searchParams\.get\(\s*["']practiceId["']\s*\)/.test(text) ||
        /\b(body|reqBody|requestBody|req\.body|request\.body)\.practiceId\b/.test(text) ||
        /practiceId\s*:\s*z\./.test(text)) {
      add({ severity: "CRITICAL", file: path, line: ln, check: "practiceId-from-session",
        message: "practiceId appears to be read from request input — privilege-escalation risk.",
        fix: "Derive practiceId from the session: session.practiceId" })
    }

    // 5 · PHI in logs (MEDIUM)
    if (/console\.(log|error|warn|info|debug)\(/.test(text) &&
        /\b(memberId|ssn|dob|dateOfBirth|firstName|lastName)\b/.test(text)) {
      add({ severity: "MEDIUM", file: path, line: ln, check: "phi-in-logs",
        message: "Possible PHI written to logs.",
        fix: "Remove PHI from log output or log an opaque id only." })
    }
  })

  // 4 · TLS setting must be present in prisma.ts (CRITICAL)
  if (isPrismaLib && !/NODE_TLS_REJECT_UNAUTHORIZED/.test(src)) {
    add({ severity: "CRITICAL", file: path, line: 1, check: "tls-setting",
      message: 'src/lib/prisma.ts is missing NODE_TLS_REJECT_UNAUTHORIZED = "0".',
      fix: "Supabase's CA chain requires this — do not remove it." })
  }

  if (isRoute) {
    const isPublic = PUBLIC_ROUTE_SUBSTR.some((p) => path.includes(p))
    const isCron = path.includes("/api/cron/")

    // 3 · Auth check on every protected route (HIGH)
    if (!isPublic && !isCron && !/getSession/.test(src)) {
      add({ severity: "HIGH", file: path, line: 1, check: "auth-required",
        message: "Protected API route has no getSession/getSessionFromRequest check.",
        fix: "Add the session check and return 401 when missing." })
    }
    if (isCron && !/CRON_SECRET/.test(src)) {
      add({ severity: "HIGH", file: path, line: 1, check: "auth-required",
        message: "Cron route does not verify CRON_SECRET.",
        fix: "Gate the route on the CRON_SECRET header." })
    }

    // 6 · Mutations should validate input (MEDIUM)
    const mutates = /export\s+async\s+function\s+(POST|PUT|PATCH)\b/.test(src)
    const readsBody = /\.json\(\)/.test(src)
    const validates = /from\s+["']zod["']/.test(src) || /\.(safeParse|parse)\(/.test(src)
    if (mutates && readsBody && !validates) {
      add({ severity: "MEDIUM", file: path, line: 1, check: "input-validation",
        message: "Mutating route (POST/PUT/PATCH) with no visible zod validation.",
        fix: "Validate the request body with a zod schema before use." })
    }
  }
}

// ── Report ──
const ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const counts = Object.fromEntries(ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length])) as Record<Severity, number>
const COLOR: Record<Severity, string> = { CRITICAL: "\x1b[41m", HIGH: "\x1b[31m", MEDIUM: "\x1b[33m", LOW: "\x1b[90m" }
const RESET = "\x1b[0m"

console.log("\nclaima code audit — CLAUDE.md non-negotiables\n" + "─".repeat(52))
if (findings.length === 0) {
  console.log("✓ No violations found across " + files.length + " files.\n")
  process.exit(0)
}
for (const sev of ORDER) {
  const group = findings.filter((f) => f.severity === sev)
  if (!group.length) continue
  console.log(`\n${COLOR[sev]} ${sev} ${RESET}  (${group.length})`)
  for (const f of group) {
    console.log(`  ${f.file}:${f.line}  [${f.check}]`)
    console.log(`    ${f.message}`)
    console.log(`    → ${f.fix}`)
  }
}
console.log("\n" + "─".repeat(52))
console.log(`CRITICAL ${counts.CRITICAL}  ·  HIGH ${counts.HIGH}  ·  MEDIUM ${counts.MEDIUM}  ·  LOW ${counts.LOW}   (${files.length} files scanned)\n`)

const blocking = counts.CRITICAL + counts.HIGH
if (blocking > 0) {
  console.log(`✗ ${blocking} blocking issue(s). Fix them, or bypass with: git commit --no-verify\n`)
  process.exit(1)
}
console.log("✓ No blocking issues (CRITICAL/HIGH). Warnings above are non-blocking.\n")
process.exit(0)
