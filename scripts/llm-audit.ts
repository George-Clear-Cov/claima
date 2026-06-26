#!/usr/bin/env bun
/**
 * claima LLM audit — the deeper, judgment-based pass that the regex gate
 * (scripts/audit.ts) can't do. Reviews CHANGED files against CLAUDE.md +
 * HIPAA concerns using Claude, and reports findings.
 *
 * Local:  bun scripts/llm-audit.ts [<base-ref>]
 * CI:     runs on pull_request; reads ANTHROPIC_API_KEY + GITHUB_BASE_REF.
 *
 * Non-blocking by default. Set AUDIT_FAIL_ON=critical (or high) to fail CI.
 */
import Anthropic from "@anthropic-ai/sdk"
import { execSync } from "node:child_process"
import { readFileSync, existsSync, appendFileSync } from "node:fs"

const MODEL = "claude-sonnet-4-6"
const MAX_FILES = 40
const MAX_CHARS_PER_FILE = 12_000
const MAX_TOTAL_CHARS = 150_000

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim()
}

// ── skip gracefully if no key (so the workflow is safe before the secret is set)
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("llm-audit: ANTHROPIC_API_KEY not set — skipping (add it as a repo secret to enable).")
  process.exit(0)
}

// ── determine the diff range
function baseRef(): string {
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`
  if (process.argv[2]) return process.argv[2]
  try { if (sh("git rev-parse --abbrev-ref HEAD") !== "main") return "main" } catch {}
  return "HEAD~1"
}

function changedFiles(): string[] {
  const base = baseRef()
  let out = ""
  try { out = sh(`git diff --name-only ${base}...HEAD`) }
  catch { try { out = sh("git diff --name-only HEAD~1...HEAD") } catch { out = "" } }
  return out.split("\n").map((s) => s.trim()).filter(Boolean).filter((f) =>
    /\.(ts|tsx)$/.test(f) &&
    (f.startsWith("src/") || f.startsWith("prisma/")) &&
    !f.startsWith("scripts/") &&
    !/\.(test|spec)\.(ts|tsx)$/.test(f)
  )
}

const files = changedFiles()
if (files.length === 0) {
  console.log("llm-audit: no relevant changed files — nothing to review.")
  process.exit(0)
}

// ── assemble the review payload
const rules = existsSync("CLAUDE.md") ? readFileSync("CLAUDE.md", "utf8").slice(0, 8_000) : ""
let corpus = ""
let used = 0
const included: string[] = []
for (const f of files.slice(0, MAX_FILES)) {
  if (!existsSync(f)) continue // deleted
  let content = readFileSync(f, "utf8")
  if (content.length > MAX_CHARS_PER_FILE) content = content.slice(0, MAX_CHARS_PER_FILE) + "\n…(truncated)"
  if (used + content.length > MAX_TOTAL_CHARS) break
  corpus += `\n===== FILE: ${f} =====\n${content}\n`
  used += content.length
  included.push(f)
}

const system = `You are a senior security & HIPAA-compliance reviewer for claima, a Next.js + Prisma medical-billing app. Review ONLY the provided changed files. Be precise and conservative — report only issues you can justify from the code shown, cite real line numbers, and do not invent.

Enforce these non-negotiables (from CLAUDE.md):
- Prisma must be imported dynamically: const { prisma } = await import("@/lib/prisma"). No static import / new PrismaClient().
- practiceId must come from the session, never from request body/query/params.
- Every Prisma query on practice-owned data must be scoped by practiceId.
- Every protected API route must check the session and return 401 (public: login, register, logout, forgot/reset-password, azure SSO, stripe/marketplace webhooks, pay/[token], store, checkout, cron[CRON_SECRET]).
- src/lib/prisma.ts must keep NODE_TLS_REJECT_UNAUTHORIZED = "0".

Also flag (judgment): PHI (names, DOB, member ID, SSN, notes) in logs/errors; missing input validation on bodies; unverified/forgeable webhooks (signature/JWT not validated); missing rate limiting on public auth/email routes; HIPAA/BAA gaps; auth-logic mistakes.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"findings":[{"severity":"CRITICAL|HIGH|MEDIUM|LOW","file":"<path>","line":<number or null>,"issue":"<concise>","fix":"<concise>"}],"summary":"<one sentence>"}
If nothing is wrong, return {"findings":[],"summary":"No issues found in the changed files."}`

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Finding { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; file: string; line: number | null; issue: string; fix: string }
let parsed: { findings: Finding[]; summary: string }

try {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4_000,
    system,
    messages: [{ role: "user", content: `Review these ${included.length} changed file(s):\n${corpus}` }],
  })
  const text = resp.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim()
  const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  parsed = JSON.parse(json)
} catch (e) {
  console.log("llm-audit: review could not be completed (API/parse error) — not blocking CI.\n", String(e))
  process.exit(0)
}

// ── report
const ORDER: Finding["severity"][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const f = parsed.findings ?? []
const counts = Object.fromEntries(ORDER.map((s) => [s, f.filter((x) => x.severity === s).length])) as Record<string, number>

let md = `## 🧠 LLM Audit — ${included.length} changed file(s)\n\n_${parsed.summary ?? ""}_\n\n`
md += `**CRITICAL ${counts.CRITICAL} · HIGH ${counts.HIGH} · MEDIUM ${counts.MEDIUM} · LOW ${counts.LOW}**\n`
console.log(`\nLLM audit — ${included.length} file(s) reviewed`)
console.log("─".repeat(52))
if (f.length === 0) console.log("✓ " + (parsed.summary ?? "No issues found."))
for (const sev of ORDER) {
  const group = f.filter((x) => x.severity === sev)
  if (!group.length) continue
  md += `\n### ${sev} (${group.length})\n`
  console.log(`\n${sev} (${group.length})`)
  for (const x of group) {
    md += `- **${x.file}${x.line ? ":" + x.line : ""}** — ${x.issue}\n  - → ${x.fix}\n`
    console.log(`  ${x.file}${x.line ? ":" + x.line : ""}\n    ${x.issue}\n    → ${x.fix}`)
  }
}
console.log("\n" + "─".repeat(52))
console.log(`CRITICAL ${counts.CRITICAL} · HIGH ${counts.HIGH} · MEDIUM ${counts.MEDIUM} · LOW ${counts.LOW}\n`)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)

// ── exit policy (non-blocking by default)
const failOn = (process.env.AUDIT_FAIL_ON ?? "").toLowerCase()
const blocking = (failOn === "critical" ? counts.CRITICAL : failOn === "high" ? counts.CRITICAL + counts.HIGH : 0)
if (blocking > 0) { console.log(`✗ ${blocking} blocking finding(s) (AUDIT_FAIL_ON=${failOn}).`); process.exit(1) }
process.exit(0)
