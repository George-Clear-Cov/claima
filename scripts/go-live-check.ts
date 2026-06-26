#!/usr/bin/env bun
/**
 * Go-live readiness scan — "distance to first paying client."
 * Local:  bun run go-live   (reads .env.local → real status)
 * CI:     scheduled weekly + workflow_dispatch (checklist reminder; CI can't see prod env)
 * Never fails the build — informational.
 */
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from "node:fs"
import { join } from "node:path"

type Status = "PASS" | "FAIL" | "WARN" | "INFO"
const icon = (s: Status) => (s === "PASS" ? "✅" : s === "FAIL" ? "❌" : s === "WARN" ? "⚠️" : "ℹ️")
const rows: { status: Status; item: string; detail: string }[] = []
const inCI = !!process.env.GITHUB_ACTIONS

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.(ts|tsx)$/.test(e)) out.push(f)
  }
  return out
}
const srcFiles = existsSync("src") ? walk("src") : []

// ── required env for go-live
const REQUIRED: { name: string; why: string }[] = [
  { name: "DATABASE_URL", why: "Postgres connection" },
  { name: "CLAIMMD_ACCOUNT_KEY", why: "live claim submission + eligibility (else MOCK)" },
  { name: "CLAIMMD_API_KEY", why: "live claim submission + eligibility (else MOCK)" },
  { name: "STRIPE_SECRET_KEY", why: "payments — must be sk_live for real charges" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", why: "client-side payments" },
  { name: "STRIPE_WEBHOOK_SECRET", why: "Stripe webhook verification" },
  { name: "RESEND_API_KEY", why: "patient statement + outreach emails" },
  { name: "ANTHROPIC_API_KEY", why: "AI features (scrub, appeals, briefing)" },
  { name: "CRON_SECRET", why: "secures the daily agent cron" },
]
for (const r of REQUIRED) {
  const v = process.env[r.name]
  if (v && v.trim()) {
    if (r.name === "STRIPE_SECRET_KEY")
      rows.push({ status: v.startsWith("sk_live") ? "PASS" : "WARN", item: r.name, detail: v.startsWith("sk_live") ? "live key set" : "TEST key (sk_test) — no real charges" })
    else rows.push({ status: "PASS", item: r.name, detail: "set" })
  } else {
    rows.push({ status: inCI ? "INFO" : "FAIL", item: r.name, detail: inCI ? `verify in Vercel — ${r.why}` : `NOT SET — ${r.why}` })
  }
}

// ── mock-mode integrations
const claimmd = srcFiles.find((f) => f.endsWith("lib/claimmd.ts"))
if (claimmd && /mock/i.test(readFileSync(claimmd, "utf8")))
  rows.push({ status: "WARN", item: "Clearinghouse (Claim.MD)", detail: "has mock fallback — runs in MOCK until CLAIMMD keys are set" })

// ── tests
const hasTests = srcFiles.some((f) => /\.(test|spec)\.(ts|tsx)$/.test(f)) || /"test"\s*:/.test(readFileSync("package.json", "utf8"))
rows.push({ status: hasTests ? "PASS" : "WARN", item: "Automated tests", detail: hasTests ? "present" : "none found — risky for billing/payment logic" })

// ── TODO/FIXME
let todos = 0
for (const f of srcFiles) todos += (readFileSync(f, "utf8").match(/TODO|FIXME/g) || []).length
rows.push({ status: "INFO", item: "TODO / FIXME markers", detail: `${todos} in src/` })

// ── migrations
const migDir = "prisma/migrations"
const migs = existsSync(migDir) ? readdirSync(migDir).filter((d) => statSync(join(migDir, d)).isDirectory()).length : 0
rows.push({ status: migs > 0 ? "INFO" : "WARN", item: "Prisma migrations", detail: `${migs} migration folder(s)` })

// ── report
const fails = rows.filter((r) => r.status === "FAIL").length
const warns = rows.filter((r) => r.status === "WARN").length
let md = `## 🚦 Go-live readiness\n\n`
md += `**Blockers: ${fails} · Warnings: ${warns}**  \n`
md += inCI
  ? `_Running in CI — env values aren't visible here; check Vercel for production truth._\n\n`
  : `_Env status reflects your local environment (.env.local)._\n\n`
md += `| | Item | Detail |\n|---|---|---|\n`
for (const r of rows) md += `| ${icon(r.status)} | ${r.item} | ${r.detail} |\n`

console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
process.exit(0)
