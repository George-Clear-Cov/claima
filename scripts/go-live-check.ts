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
// `alt` = an accepted alternative name (prisma.ts prefers POSTGRES_PRISMA_URL, falls back
// to DATABASE_URL — requiring only one of them fails a correctly-configured Azure deploy).
type Req = { name: string; why: string; alt?: string }
const REQUIRED: Req[] = [
  { name: "POSTGRES_PRISMA_URL", why: "Postgres connection", alt: "DATABASE_URL" },
  { name: "CLAIMMD_ACCOUNT_KEY", why: "live claim submission + eligibility (else MOCK)" },
  { name: "STRIPE_SECRET_KEY", why: "payments — must be sk_live for real charges" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", why: "client-side payments" },
  { name: "STRIPE_WEBHOOK_SECRET", why: "Stripe webhook verification" },
  { name: "ACS_CONNECTION_STRING", why: "patient statement + outreach emails (Azure Communication Services)" },
  { name: "CRON_SECRET", why: "secures the daily agent cron" },
]
for (const r of REQUIRED) {
  const v = process.env[r.name] || (r.alt ? process.env[r.alt] : undefined)
  const label = r.alt ? `${r.name} (or ${r.alt})` : r.name
  if (v && v.trim()) {
    if (r.name === "STRIPE_SECRET_KEY")
      rows.push({ status: v.startsWith("sk_live") ? "PASS" : "WARN", item: r.name, detail: v.startsWith("sk_live") ? "live key set" : "TEST key (sk_test) — no real charges" })
    else rows.push({ status: "PASS", item: label, detail: "set" })
  } else {
    rows.push({ status: inCI ? "INFO" : "FAIL", item: label, detail: inCI ? `verify in the deploy env — ${r.why}` : `NOT SET — ${r.why}` })
  }
}

// ── AI provider must be one Claima holds a BAA with.
// Direct Anthropic has no BAA (lib/ai.ts is fail-closed against it), so requiring
// ANTHROPIC_API_KEY for go-live would point at the one path PHI must not take.
{
  const provider = (process.env.AI_PROVIDER || "").trim().toLowerCase()
  const split = (process.env.AI_PROVIDER_SPLIT || "").trim()
  const hasBedrock = Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_API_KEY || (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY))
  const hasAzureAI = Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY)
  if (!provider && !split) {
    rows.push({ status: "FAIL", item: "AI_PROVIDER", detail: "NOT SET — set bedrock or azure; both are BAA-covered" })
  } else if (provider === "anthropic") {
    rows.push({ status: "FAIL", item: "AI_PROVIDER", detail: "anthropic (direct) has NO BAA — PHI is blocked. Use bedrock or azure." })
  } else if (provider === "bedrock" && !hasBedrock) {
    rows.push({ status: "FAIL", item: "AI_PROVIDER=bedrock", detail: "no AWS credentials set — AI features will fail" })
  } else if (provider === "azure" && !hasAzureAI) {
    rows.push({ status: "FAIL", item: "AI_PROVIDER=azure", detail: "AZURE_OPENAI_ENDPOINT/KEY not set — AI features will fail" })
  } else {
    rows.push({ status: "PASS", item: "AI_PROVIDER", detail: `${provider || `split: ${split}`} — BAA-covered` })
  }
}

// ── Claim.MD: the base URL is identical for test and production accounts, so the
// AccountKey is the ONLY thing distinguishing them and nothing else would catch a
// test key in production. Declare which account the key belongs to.
{
  const KNOWN_TEST_ACCOUNTS = ["31641"]
  const acct = (process.env.CLAIMMD_ACCOUNT_ID || "").trim()
  if (!acct) {
    rows.push({ status: "WARN", item: "CLAIMMD_ACCOUNT_ID", detail: "not declared — cannot verify CLAIMMD_ACCOUNT_KEY is the production account's key" })
  } else if (KNOWN_TEST_ACCOUNTS.includes(acct)) {
    rows.push({ status: "FAIL", item: "CLAIMMD_ACCOUNT_ID", detail: `${acct} is a TEST account — claims would not reach payers` })
  } else {
    rows.push({ status: "PASS", item: "CLAIMMD_ACCOUNT_ID", detail: `${acct} (production)` })
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
