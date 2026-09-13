/**
 * Regenerates src/lib/mpfs/rvu-data.ts from the CMS Physician Fee Schedule Relative Value files.
 *
 * WHY THIS EXISTS
 * The leak report benchmarks what a payer actually allowed against what Medicare says the
 * service is worth. That benchmark has to be real CMS data, refreshed quarterly, and it has to
 * ship inside the page bundle rather than being fetched — /leak-report promises the visitor
 * that dropping a file produces zero network requests, and a lazy-loaded table would break that
 * promise the moment they open the network tab to check.
 *
 * WHAT IT DELIBERATELY DOES NOT EMIT
 * CPT long descriptors. The CMS file header states: "CPT codes and descriptions only are
 * copyright 2026 American Medical Association." The RVU/GPCI values themselves are US
 * government work and are not copyrightable, so we ship numbers keyed by code and never a
 * description. Do not add descriptions to the generated file without an AMA licence.
 *
 * USAGE
 *   1. Download the current quarter from
 *      https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files
 *      (pick the latest rvu<YY><A-D>, e.g. rvu26d) and unzip it.
 *   2. bun run scripts/build-mpfs.ts <path-to-unzipped-dir>
 *   3. Commit the regenerated src/lib/mpfs/rvu-data.ts and bump nothing else — the release
 *      metadata inside it is what the UI cites.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = process.argv[2]
if (!dir) {
  console.error("usage: bun run scripts/build-mpfs.ts <unzipped-cms-rvu-dir>")
  process.exit(1)
}

/** Minimal CSV row splitter. The CMS files quote any field containing a comma. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c !== "\r") field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function num(v: string | undefined): number {
  const n = Number.parseFloat((v ?? "").trim())
  return Number.isFinite(n) ? n : 0
}

function pick(names: string[], want: RegExp): string {
  const hit = names.find((f) => want.test(f))
  if (!hit) throw new Error(`no file in ${dir} matching ${want}`)
  return join(dir, hit)
}

const files = readdirSync(dir)
const rvuPath = pick(files, /^PPRRVU\d{4}.*nonQPP\.csv$/i)
const gpciPath = pick(files, /^GPCI\d{4}\.csv$/i)

// ── RVUs ──────────────────────────────────────────────────────────────────────
// Column layout is positional, not by header name: the CMS header spans three stacked rows
// ("NON-FAC" / "PE RVU" / "INDICATOR" etc.), so no single row carries usable names. The last
// header row starts with the literal "HCPCS", and data begins after it.
const C = {
  hcpcs: 0,
  mod: 1,
  status: 3,
  work: 5,
  peNonFac: 6,
  peFac: 8,
  mp: 10,
  convFactor: 25,
} as const

const rvuRows = parseCsv(readFileSync(rvuPath, "utf8"))
const headerIdx = rvuRows.findIndex((r) => r[0]?.trim() === "HCPCS")
if (headerIdx < 0) throw new Error(`could not find the HCPCS header row in ${rvuPath}`)

/**
 * Status codes that produce a Medicare-priced allowed amount. Everything else (I invalid,
 * X statutory exclusion, N non-covered, B bundled, P bundled/excluded, C carrier-priced,
 * E excluded, M measurement, J anesthesia-injection) has no national benchmark, so we emit
 * nothing rather than a zero that would read as "underpaid by 100%".
 */
const PAYABLE_STATUS = new Set(["A", "R", "T"])

const rvu: Record<string, number[]> = {}
let conversionFactor = 0
let skippedUnpriced = 0

for (const r of rvuRows.slice(headerIdx + 1)) {
  const code = (r[C.hcpcs] ?? "").trim()
  if (!code || r.length < 26) continue

  const cf = num(r[C.convFactor])
  if (cf > 0) conversionFactor = cf

  if (!PAYABLE_STATUS.has((r[C.status] ?? "").trim())) continue

  const work = num(r[C.work])
  const peNonFac = num(r[C.peNonFac])
  const peFac = num(r[C.peFac])
  const mp = num(r[C.mp])
  if (work + peNonFac + peFac + mp <= 0) {
    skippedUnpriced++
    continue
  }

  // 26 (professional component) and TC (technical component) are separate priced rows for the
  // same HCPCS and carry genuinely different RVUs. Everything else shares the base row.
  const mod = (r[C.mod] ?? "").trim()
  const key = mod ? `${code}:${mod}` : code
  rvu[key] = [
    Math.round(work * 100) / 100,
    Math.round(peNonFac * 100) / 100,
    Math.round(peFac * 100) / 100,
    Math.round(mp * 100) / 100,
  ]
}

if (!conversionFactor) throw new Error("no conversion factor found in the RVU file")

// ── GPCIs ─────────────────────────────────────────────────────────────────────
// Header: MAC, State, Locality Number, Locality Name, PW GPCI, PE GPCI, MP GPCI
const gpciRows = parseCsv(readFileSync(gpciPath, "utf8"))
const gpciHeader = gpciRows.findIndex((r) => /locality number/i.test(r[2] ?? ""))
if (gpciHeader < 0) throw new Error(`could not find the GPCI header row in ${gpciPath}`)

interface Locality {
  state: string
  code: string
  name: string
  pw: number
  pe: number
  mp: number
}

const localities: Locality[] = []
for (const r of gpciRows.slice(gpciHeader + 1)) {
  const state = (r[1] ?? "").trim()
  const code = (r[2] ?? "").trim()
  const name = (r[3] ?? "").trim()
  if (!state || !code || !name) continue
  const pw = num(r[4])
  const pe = num(r[5])
  const mp = num(r[6])
  if (pw <= 0 || pe <= 0) continue
  // A trailing * or *** on the locality name is a CMS footnote marker, not part of the name.
  localities.push({ state, code, name: name.replace(/\*+$/, "").trim(), pw, pe, mp })
}

localities.sort((a, b) => a.state.localeCompare(b.state) || a.code.localeCompare(b.code))

// ── Emit ──────────────────────────────────────────────────────────────────────
const releaseMatch = /PPRRVU(\d{4})_([A-Za-z]+)_/.exec(rvuPath)
const year = releaseMatch?.[1] ?? String(new Date().getFullYear())
const release = releaseMatch?.[2] ?? "unknown"

const out = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * Regenerate with: bun run scripts/build-mpfs.ts <unzipped-cms-rvu-dir>
 *
 * Source: CMS Physician Fee Schedule Relative Value File, ${release} ${year} release.
 * https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files
 *
 * Contains RVU and GPCI values only. CPT long descriptors are AMA-copyrighted and are
 * deliberately excluded — see the note at the top of scripts/build-mpfs.ts.
 *
 * Packed as a JSON string rather than an object literal: it parses faster in the browser and
 * compiles faster than a ${Object.keys(rvu).length}-key object literal would.
 */

export const MPFS_RELEASE = {
  year: ${year},
  release: ${JSON.stringify(release)},
  conversionFactor: ${conversionFactor},
  codes: ${Object.keys(rvu).length},
  source: "CMS Physician Fee Schedule Relative Value File",
} as const

export interface MpfsLocality {
  state: string
  /** CMS locality number, e.g. "01". Unique only within a state. */
  code: string
  name: string
  /** Work GPCI (includes the 1.0 statutory floor). */
  pw: number
  /** Practice expense GPCI. */
  pe: number
  /** Malpractice GPCI. */
  mp: number
}

export const MPFS_LOCALITIES: MpfsLocality[] = ${JSON.stringify(localities)}

/** key -> [workRVU, peNonFacilityRVU, peFacilityRVU, mpRVU]. Key is "CODE" or "CODE:MOD". */
const PACKED_RVU = ${JSON.stringify(JSON.stringify(rvu))}

let cache: Record<string, number[]> | null = null

/** Parsed on first use so importing this module costs nothing until a file is dropped. */
export function rvuTable(): Record<string, number[]> {
  if (!cache) cache = JSON.parse(PACKED_RVU) as Record<string, number[]>
  return cache
}
`

const outDir = resolve("src/lib/mpfs")
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "rvu-data.ts"), out)

console.log(`RVU source     ${rvuPath}`)
console.log(`GPCI source    ${gpciPath}`)
console.log(`release        ${release} ${year}`)
console.log(`conv factor    ${conversionFactor}`)
console.log(`priced codes   ${Object.keys(rvu).length} (skipped ${skippedUnpriced} priced-status codes with all-zero RVUs)`)
console.log(`localities     ${localities.length}`)
console.log(`wrote          src/lib/mpfs/rvu-data.ts (${Math.round(out.length / 1024)} KB)`)
