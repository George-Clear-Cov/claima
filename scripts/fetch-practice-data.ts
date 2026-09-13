/**
 * Pulls per-NPI Medicare service detail from the CMS public API and writes the dataset that
 * backs the per-practice pages at /p/<slug>.
 *
 * WHY THESE PAGES EXIST
 * Nobody in this category publishes per-account content. A sitemap sweep of Candid, Adonis,
 * Athelas and Commure found zero per-prospect pages across 999 URLs; the closest is 21 Adonis
 * microsites targeted by region and specialty, never by name. SmarterDx publishes ~178 pages,
 * one per named hospital, each computing that hospital's figure from free public CMS data with
 * the arithmetic shown. This is that play, aimed at NPIs instead of hospitals.
 *
 * WHAT GOES ON A PAGE, AND WHAT MUST NOT
 * Only facts CMS already publishes about that provider, plus arithmetic the reader can redo.
 * The tri-state CSV carries modelled `est_aged_ar_*` columns; those are the figures that
 * understated by 5.6x and were pulled from outreach in September. They are deliberately NOT
 * read by this script and must never reach a public page.
 *
 * Source: Medicare Physician & Other Practitioners, by Provider and Service (CY2023 release).
 * https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners
 *
 * USAGE
 *   bun run scripts/fetch-practice-data.ts [--limit N]
 * Results are cached per NPI so a re-run is cheap and a failed run resumes.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const DATASET = "92396110-2aed-4d63-a6a2-5d6207d46a29"
const API = `https://data.cms.gov/data-api/v1/dataset/${DATASET}/data`
const CACHE = ".cache/cms-provider-service"
const TARGETS = "docs/strategy/tri-state-sized-targets.csv"
const OUT = "src/data/practices.json"

const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

interface ApiRow {
  Rndrng_NPI: string
  Rndrng_Prvdr_Last_Org_Name: string
  Rndrng_Prvdr_First_Name: string
  Rndrng_Prvdr_Crdntls: string
  Rndrng_Prvdr_City: string
  Rndrng_Prvdr_State_Abrvtn: string
  Rndrng_Prvdr_Zip5: string
  Rndrng_Prvdr_Type: string
  HCPCS_Cd: string
  HCPCS_Desc: string
  HCPCS_Drug_Ind: string
  Place_Of_Srvc: string
  Tot_Benes: string
  Tot_Srvcs: string
  Avg_Sbmtd_Chrg: string
  Avg_Mdcr_Alowd_Amt: string
  Avg_Mdcr_Pymt_Amt: string
}

/** One code line, already reduced to what a page renders. */
export interface PracticeCode {
  code: string
  /** CMS's own plain-language description from the PUF, not the AMA long descriptor. */
  desc: string
  /** "O" office / "F" facility. Non-facility pays materially more for the same work. */
  pos: string
  services: number
  beneficiaries: number
  /** Average submitted charge — the practice's own charge master. */
  charge: number
  /** Average Medicare allowed. Already locality-adjusted by CMS for this provider. */
  allowed: number
  /** allowed x services. What Medicare actually allowed on this code for the year. */
  allowedTotal: number
  isDrug: boolean
}

export interface PracticeRecord {
  slug: string
  npi: string
  name: string
  credentials: string
  city: string
  state: string
  zip: string
  specialty: string
  totalAllowed: number
  totalServices: number
  totalBeneficiaries: number
  codes: PracticeCode[]
  /** Share of allowed dollars sitting in the top five codes. */
  concentration: number
}

function num(v: string | undefined): number {
  const n = Number.parseFloat(v ?? "")
  return Number.isFinite(n) ? n : 0
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For)\b/g, (m) => m.toLowerCase())
}

export function slugify(name: string, city: string, state: string, npi: string): string {
  const base = `${name} ${city} ${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  // NPI suffix guarantees uniqueness: two providers genuinely share a name and city.
  return `${base}-${npi.slice(-4)}`
}

async function fetchNpi(npi: string): Promise<ApiRow[]> {
  const cacheFile = join(CACHE, `${npi}.json`)
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8")) as ApiRow[]

  const rows: ApiRow[] = []
  const pageSize = 500
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const url = `${API}?filter[Rndrng_NPI]=${npi}&size=${pageSize}&offset=${offset}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${npi}: HTTP ${res.status}`)
    const page = (await res.json()) as ApiRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(rows))
  return rows
}

function toRecord(rows: ApiRow[]): PracticeRecord | null {
  if (rows.length === 0) return null
  const first = rows[0]!

  const codes: PracticeCode[] = rows
    .map((r) => {
      const services = num(r.Tot_Srvcs)
      const allowed = num(r.Avg_Mdcr_Alowd_Amt)
      return {
        code: r.HCPCS_Cd,
        desc: r.HCPCS_Desc,
        pos: r.Place_Of_Srvc,
        services,
        beneficiaries: num(r.Tot_Benes),
        charge: Math.round(num(r.Avg_Sbmtd_Chrg) * 100) / 100,
        allowed: Math.round(allowed * 100) / 100,
        allowedTotal: Math.round(allowed * services),
        isDrug: r.HCPCS_Drug_Ind === "Y",
      }
    })
    .sort((a, b) => b.allowedTotal - a.allowedTotal)

  const totalAllowed = codes.reduce((s, c) => s + c.allowedTotal, 0)
  const top5 = codes.slice(0, 5).reduce((s, c) => s + c.allowedTotal, 0)

  const name = titleCase(
    `${first.Rndrng_Prvdr_First_Name} ${first.Rndrng_Prvdr_Last_Org_Name}`.trim(),
  )
  const city = titleCase(first.Rndrng_Prvdr_City)

  return {
    slug: slugify(name, city, first.Rndrng_Prvdr_State_Abrvtn, first.Rndrng_NPI),
    npi: first.Rndrng_NPI,
    name,
    credentials: first.Rndrng_Prvdr_Crdntls || "",
    city,
    state: first.Rndrng_Prvdr_State_Abrvtn,
    zip: first.Rndrng_Prvdr_Zip5,
    specialty: first.Rndrng_Prvdr_Type,
    totalAllowed: Math.round(totalAllowed),
    totalServices: codes.reduce((s, c) => s + c.services, 0),
    // Beneficiary counts are per code and overlap heavily, so the max is the honest floor
    // for "patients seen". Summing them would triple-count and inflate the page.
    totalBeneficiaries: Math.max(...codes.map((c) => c.beneficiaries)),
    codes: codes.slice(0, 25),
    concentration: totalAllowed > 0 ? top5 / totalAllowed : 0,
  }
}

async function main() {
  const csv = readFileSync(TARGETS, "utf8").trim().split("\n")
  const header = csv[0]!.split(",")
  const npiIdx = header.indexOf("npi")
  if (npiIdx < 0) throw new Error("no npi column in the target list")

  const npis = csv
    .slice(1)
    .map((line) => line.split(",")[npiIdx]?.trim())
    .filter((n): n is string => !!n && /^\d{10}$/.test(n))
    .slice(0, LIMIT)

  console.log(`fetching ${npis.length} NPIs (cache: ${CACHE})`)

  const records: PracticeRecord[] = []
  let failed = 0
  for (const [i, npi] of npis.entries()) {
    try {
      const rec = toRecord(await fetchNpi(npi))
      if (rec && rec.totalAllowed > 0) records.push(rec)
    } catch (err) {
      failed++
      console.warn(`  ${npi}: ${(err as Error).message}`)
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${npis.length}`)
  }

  // Two providers can slug identically only if they share name, city and the last four NPI
  // digits. Assert rather than silently overwrite a page.
  const slugs = new Set(records.map((r) => r.slug))
  if (slugs.size !== records.length) throw new Error("duplicate slug detected")

  records.sort((a, b) => b.totalAllowed - a.totalAllowed)
  mkdirSync("src/data", { recursive: true })
  writeFileSync(OUT, JSON.stringify(records))

  const bytes = readFileSync(OUT).length
  console.log(`\nwrote ${OUT}`)
  console.log(`  practices  ${records.length} (${failed} failed)`)
  console.log(`  size       ${Math.round(bytes / 1024)} KB`)
  console.log(`  states     ${[...new Set(records.map((r) => r.state))].sort().join(", ")}`)
  console.log(`  median top-5 concentration ${Math.round(
    [...records].sort((a, b) => a.concentration - b.concentration)[Math.floor(records.length / 2)]!
      .concentration * 100,
  )}%`)
}

void main()
