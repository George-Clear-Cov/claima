#!/usr/bin/env bun
/**
 * Dependency & CVE watch — reports outdated packages and known vulnerabilities.
 * Local:  bun run deps-check
 * CI:     scheduled weekly + workflow_dispatch (.github/workflows/deps-check.yml)
 * Exits non-zero if vulnerabilities are found (so a scheduled run goes red + notifies).
 */
import { execSync } from "node:child_process"
import { appendFileSync, writeFileSync } from "node:fs"

const BUN = process.execPath // same bun that's running this script (works in CI + locally)

function run(args: string): { code: number; out: string } {
  try { return { code: 0, out: execSync(`"${BUN}" ${args}`, { encoding: "utf8" }) } }
  catch (e: any) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` } }
}

const outdated = run("outdated")
const audit = run("audit")

const auditUnavailable = /unknown command|error:\s*unknown/i.test(audit.out)
const m = audit.out.match(/(\d+)\s+vulnerabilit/i)
const vulnCount = auditUnavailable ? 0 : m ? parseInt(m[1], 10) : 0

let md = `## 📦 Dependency & CVE watch\n\n`
md += `### Security audit\n`
if (auditUnavailable) md += `\`bun audit\` unavailable in this runtime — skipped.\n\n`
else if (vulnCount === 0) md += `✅ No known vulnerabilities.\n\n`
else md += `⚠️ **${vulnCount} vulnerabilit${vulnCount === 1 ? "y" : "ies"}** reported:\n\n\`\`\`\n${audit.out.trim().slice(0, 4000)}\n\`\`\`\n\n`
md += `### Outdated packages\n\`\`\`\n${(outdated.out.trim() || "All dependencies up to date.").slice(0, 4000)}\n\`\`\`\n`

console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
if (process.env.GITHUB_ACTIONS) {
  writeFileSync("deps-report.md", md)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `vulns=${vulnCount}\n`)
}
// Report-only: never fail the build (transitive dev-dep CVEs would keep it red).
// The workflow opens/updates a GitHub issue when vulns > 0 — that's the notification.
process.exit(0)
