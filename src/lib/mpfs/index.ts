/**
 * Medicare Physician Fee Schedule benchmarking — "you were paid less than the public floor."
 *
 * WHY THIS IS THE WEDGE
 * Every funded competitor that detects underpayment (Adonis is the only one in the category
 * that ships it) benchmarks against the practice's own loaded payer contracts. That means the
 * prospect has to hand over contracts before anyone can produce a number, which is a
 * procurement event. MPFS is public, free, and needs nothing but the practice's own remit —
 * so we can produce a real dollar figure before any relationship exists.
 *
 * PURITY
 * No fetch, no DB, no node builtins. This module is imported by the /leak-report client
 * component and the page promises the visitor that dropping a file produces zero network
 * requests. The fee schedule ships in the bundle (see rvu-data.ts) for exactly that reason.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM
 * A variance against MPFS is not proof of a contract breach. For commercial payers there is no
 * legal floor at all; commercial rates simply tend to sit above Medicare, so a commercial line
 * paying *below* it is an anomaly worth a human look, not a violation. The confidence tiers
 * below exist so the report never overstates what the arithmetic supports.
 */
import { MPFS_LOCALITIES, MPFS_RELEASE, rvuTable, type MpfsLocality } from "./rvu-data"

export { MPFS_LOCALITIES, MPFS_RELEASE }
export type { MpfsLocality }

/** Where the service was rendered. Independent practices bill non-facility. */
export type PlaceOfService = "office" | "facility"

/**
 * Modifiers that change the allowed amount by rules this module does not model (bilateral
 * surgery pricing, multiple-procedure reduction, reduced/discontinued services, co-surgeon
 * and assistant-at-surgery percentages).
 *
 * Lines carrying one of these are reported as NOT BENCHMARKED rather than as underpaid.
 * Treating them as underpaid is the obvious way to generate a large, confident, wrong number:
 * a modifier-51 second procedure is *supposed* to pay 50%, and flagging it would put a false
 * finding in front of a practice on the first screen they ever see from us.
 */
export const UNMODELED_MODIFIERS = new Set([
  "50", // bilateral
  "51", // multiple procedure
  "52", // reduced services
  "53", // discontinued
  "54", // surgical care only
  "55", // postoperative management only
  "56", // preoperative management only
  "62", // two surgeons
  "66", // surgical team
  "80", // assistant surgeon
  "81", // minimum assistant surgeon
  "82", // assistant when no qualified resident available
  "AS", // PA/NP/CNS assistant at surgery
])

/** Component modifiers that select a different priced row rather than adjusting one. */
const COMPONENT_MODIFIERS = ["26", "TC"]

export type PayerClass = "medicare" | "medicare_advantage" | "medicaid" | "commercial" | "unknown"

/**
 * How much weight a variance carries, which depends entirely on who paid.
 *  - `high`   Traditional Medicare. The MPFS amount IS the allowed amount, so a shortfall is
 *             a real discrepancy and not a matter of interpretation.
 *  - `medium` Medicare Advantage. Non-contracted providers are generally paid the original
 *             Medicare amount, but contracted MA rates are negotiated and can differ.
 *             ⚠️ The non-contracted rule (42 CFR 422.214) has NOT been verified against the
 *             regulation text in this codebase — do not cite the CFR in customer-facing copy
 *             until someone reads it.
 *  - `signal` Commercial and Medicaid. No Medicare floor applies. Commercial contracts
 *             normally sit above Medicare, so falling below it is an anomaly worth review.
 */
export type VarianceConfidence = "high" | "medium" | "signal"

export function classifyPayer(name: string | null | undefined): PayerClass {
  const k = (name ?? "").trim().toLowerCase()
  if (!k) return "unknown"
  // Order matters: "medicare advantage" and the big MA brands must be caught before the bare
  // "medicare" test, or every MA plan is misfiled as traditional Medicare and over-claimed.
  if (
    /medicare\s*(advantage|part\s*c)/.test(k) ||
    /\b(ma\s*plan|maplan)\b/.test(k) ||
    /(advantage|dual\s*complete|medicare\s*complete|freedom|hmo\s*snp|d-?snp)/.test(k)
  ) {
    return "medicare_advantage"
  }
  if (/\bmedicare\b|\bngs\b|national government services|\bpalmetto\b|\bnovitas\b|\bwps\b/.test(k)) {
    return "medicare"
  }
  if (/medicaid|healthfirst|fidelis|amerigroup|molina|\bhusky\b|\bmedi-?cal\b/.test(k)) {
    return "medicaid"
  }
  return "commercial"
}

const CONFIDENCE: Record<PayerClass, VarianceConfidence> = {
  medicare: "high",
  medicare_advantage: "medium",
  medicaid: "signal",
  commercial: "signal",
  unknown: "signal",
}

export function localityKey(l: Pick<MpfsLocality, "state" | "code">): string {
  return `${l.state}-${l.code}`
}

export function findLocality(key: string | null | undefined): MpfsLocality | null {
  if (!key) return null
  return MPFS_LOCALITIES.find((l) => localityKey(l) === key) ?? null
}

/**
 * The national Medicare allowed amount for one unit, before geographic adjustment.
 * Returns null when the code carries no national price (carrier-priced, bundled, not covered).
 */
export function nationalAllowed(
  code: string,
  modifiers: string[] = [],
  pos: PlaceOfService = "office",
): number | null {
  const rvu = lookupRvu(code, modifiers)
  if (!rvu) return null
  const [work, peNonFac, peFac, mp] = rvu
  const pe = pos === "facility" ? peFac : peNonFac
  return (work + pe + mp) * MPFS_RELEASE.conversionFactor
}

/**
 * The locality-adjusted Medicare allowed amount for `units` of a service.
 * This is the number a payer's own allowed amount gets compared against.
 */
export function medicareAllowed(
  code: string,
  modifiers: string[],
  locality: MpfsLocality,
  pos: PlaceOfService = "office",
  units = 1,
): number | null {
  const rvu = lookupRvu(code, modifiers)
  if (!rvu) return null
  const [work, peNonFac, peFac, mp] = rvu
  const pe = pos === "facility" ? peFac : peNonFac
  const adjusted =
    work * locality.pw + pe * locality.pe + mp * locality.mp
  const amount = adjusted * MPFS_RELEASE.conversionFactor * Math.max(units, 1)
  return Math.round(amount * 100) / 100
}

function lookupRvu(code: string, modifiers: string[]): number[] | null {
  const table = rvuTable()
  const c = code.trim().toUpperCase()
  if (!c) return null

  // A professional- or technical-component modifier selects its own priced row.
  for (const m of modifiers) {
    const mod = m.trim().toUpperCase()
    if (COMPONENT_MODIFIERS.includes(mod)) {
      const hit = table[`${c}:${mod}`]
      if (hit) return hit
    }
  }
  return table[c] ?? null
}

/** One remittance line, in the shape the 835 parser already produces. */
export interface BenchmarkInput {
  cpt: string
  modifiers?: string[]
  payerName?: string
  /** AMT*B6. When absent we fall back to paid + patient responsibility. */
  allowed?: number
  paid: number
  patientResponsibility?: number
  units?: number
  denied?: boolean
}

export type LineVerdict =
  | "underpaid"
  | "at_or_above"
  /** Carries a modifier whose pricing rules this module does not model. */
  | "not_benchmarked_modifier"
  /** No national Medicare price exists for this code. */
  | "no_benchmark"
  /** Denied, reversed, or zero-allowed. A denial, not an underpayment. */
  | "not_applicable"

export interface BenchmarkedLine {
  cpt: string
  modifiers: string[]
  payerName?: string
  payerClass: PayerClass
  confidence: VarianceConfidence
  units: number
  /** What the payer said it allowed (or paid + patient responsibility). */
  actualAllowed: number
  /** Locality-adjusted Medicare allowed for the same units. */
  medicareAllowed: number | null
  /** Positive = paid below the Medicare floor. */
  variance: number
  variancePct: number
  verdict: LineVerdict
}

export interface UnderpaymentByPayer {
  payerName: string
  payerClass: PayerClass
  confidence: VarianceConfidence
  lines: number
  actualAllowed: number
  medicareAllowed: number
  shortfall: number
  /** Shortfall as a share of what Medicare would have allowed. */
  shortfallPct: number
}

export interface UnderpaymentByCode {
  cpt: string
  lines: number
  units: number
  shortfall: number
  /** Average shortfall per unit — the number that makes a single code worth chasing. */
  shortfallPerUnit: number
}

export interface UnderpaymentReport {
  locality: MpfsLocality
  placeOfService: PlaceOfService
  release: typeof MPFS_RELEASE
  totals: {
    linesRead: number
    linesBenchmarked: number
    /** Lines skipped because the code has no national price. */
    linesNoBenchmark: number
    /** Lines skipped because a modifier changes pricing in ways we do not model. */
    linesModifierSkipped: number
    linesDenied: number
    actualAllowed: number
    medicareAllowed: number
  }
  /** Total paid below the Medicare floor, across benchmarked lines only. */
  shortfall: number
  /** Shortfall split by how much weight the finding carries. */
  shortfallByConfidence: Record<VarianceConfidence, number>
  byPayer: UnderpaymentByPayer[]
  byCode: UnderpaymentByCode[]
  /** Honest statements about what this number does and does not mean. */
  caveats: string[]
}

/**
 * Variance smaller than this is treated as noise. Locality assignment is per-practice rather
 * than per-claim, CMS rounds RVUs to two decimals, and sequestration shaves payment (not the
 * allowed amount) by 2%. Flagging a $0.40 gap as a finding would destroy the report's
 * credibility faster than missing one.
 */
const TOLERANCE_PCT = 0.02
const TOLERANCE_ABS = 1

export function benchmarkLine(
  line: BenchmarkInput,
  locality: MpfsLocality,
  pos: PlaceOfService = "office",
): BenchmarkedLine {
  const modifiers = (line.modifiers ?? []).map((m) => m.trim().toUpperCase()).filter(Boolean)
  const units = Math.max(line.units ?? 1, 1)
  const payerClass = classifyPayer(line.payerName)
  const confidence = CONFIDENCE[payerClass]

  // allowed = paid + patient responsibility. AMT*B6 carries it explicitly but is often absent,
  // in which case the identity above reconstructs it from segments that are always present.
  const actualAllowed =
    line.allowed ?? Math.max(line.paid + (line.patientResponsibility ?? 0), 0)

  const base: Omit<BenchmarkedLine, "verdict" | "medicareAllowed" | "variance" | "variancePct"> = {
    cpt: line.cpt,
    modifiers,
    payerName: line.payerName,
    payerClass,
    confidence,
    units,
    actualAllowed,
  }

  if (line.denied || actualAllowed <= 0) {
    return { ...base, medicareAllowed: null, variance: 0, variancePct: 0, verdict: "not_applicable" }
  }

  if (modifiers.some((m) => UNMODELED_MODIFIERS.has(m))) {
    return {
      ...base,
      medicareAllowed: null,
      variance: 0,
      variancePct: 0,
      verdict: "not_benchmarked_modifier",
    }
  }

  const benchmark = medicareAllowed(line.cpt, modifiers, locality, pos, units)
  if (benchmark === null || benchmark <= 0) {
    return { ...base, medicareAllowed: null, variance: 0, variancePct: 0, verdict: "no_benchmark" }
  }

  const variance = Math.round((benchmark - actualAllowed) * 100) / 100
  const variancePct = variance / benchmark
  const material = variance > TOLERANCE_ABS && variancePct > TOLERANCE_PCT

  return {
    ...base,
    medicareAllowed: benchmark,
    variance: material ? variance : 0,
    variancePct: material ? variancePct : 0,
    verdict: material ? "underpaid" : "at_or_above",
  }
}

export function analyzeUnderpayment(
  lines: BenchmarkInput[],
  locality: MpfsLocality,
  pos: PlaceOfService = "office",
): UnderpaymentReport {
  const benchmarked = lines.map((l) => benchmarkLine(l, locality, pos))

  const totals = {
    linesRead: lines.length,
    linesBenchmarked: 0,
    linesNoBenchmark: 0,
    linesModifierSkipped: 0,
    linesDenied: 0,
    actualAllowed: 0,
    medicareAllowed: 0,
  }

  const payers = new Map<string, UnderpaymentByPayer>()
  const codes = new Map<string, UnderpaymentByCode>()
  const shortfallByConfidence: Record<VarianceConfidence, number> = {
    high: 0,
    medium: 0,
    signal: 0,
  }
  let shortfall = 0

  for (const b of benchmarked) {
    if (b.verdict === "not_applicable") {
      totals.linesDenied++
      continue
    }
    if (b.verdict === "not_benchmarked_modifier") {
      totals.linesModifierSkipped++
      continue
    }
    if (b.verdict === "no_benchmark") {
      totals.linesNoBenchmark++
      continue
    }

    totals.linesBenchmarked++
    totals.actualAllowed += b.actualAllowed
    totals.medicareAllowed += b.medicareAllowed ?? 0

    const payerName = b.payerName?.trim() || "Unknown payer"
    const p = payers.get(payerName) ?? {
      payerName,
      payerClass: b.payerClass,
      confidence: b.confidence,
      lines: 0,
      actualAllowed: 0,
      medicareAllowed: 0,
      shortfall: 0,
      shortfallPct: 0,
    }
    p.lines++
    p.actualAllowed += b.actualAllowed
    p.medicareAllowed += b.medicareAllowed ?? 0
    p.shortfall += b.variance
    payers.set(payerName, p)

    if (b.variance > 0) {
      shortfall += b.variance
      shortfallByConfidence[b.confidence] += b.variance

      const c = codes.get(b.cpt) ?? { cpt: b.cpt, lines: 0, units: 0, shortfall: 0, shortfallPerUnit: 0 }
      c.lines++
      c.units += b.units
      c.shortfall += b.variance
      codes.set(b.cpt, c)
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100
  totals.actualAllowed = round(totals.actualAllowed)
  totals.medicareAllowed = round(totals.medicareAllowed)

  const byPayer = [...payers.values()]
    .map((p) => ({
      ...p,
      actualAllowed: round(p.actualAllowed),
      medicareAllowed: round(p.medicareAllowed),
      shortfall: round(p.shortfall),
      shortfallPct: p.medicareAllowed > 0 ? p.shortfall / p.medicareAllowed : 0,
    }))
    .sort((a, b) => b.shortfall - a.shortfall)

  const byCode = [...codes.values()]
    .map((c) => ({
      ...c,
      shortfall: round(c.shortfall),
      shortfallPerUnit: round(c.shortfall / Math.max(c.units, 1)),
    }))
    .sort((a, b) => b.shortfall - a.shortfall)

  return {
    locality,
    placeOfService: pos,
    release: MPFS_RELEASE,
    totals,
    shortfall: round(shortfall),
    shortfallByConfidence: {
      high: round(shortfallByConfidence.high),
      medium: round(shortfallByConfidence.medium),
      signal: round(shortfallByConfidence.signal),
    },
    byPayer,
    byCode,
    caveats: buildCaveats(totals, shortfallByConfidence, locality, pos),
  }
}

function buildCaveats(
  totals: UnderpaymentReport["totals"],
  byConfidence: Record<VarianceConfidence, number>,
  locality: MpfsLocality,
  pos: PlaceOfService,
): string[] {
  const notes: string[] = [
    `Benchmarked against the ${MPFS_RELEASE.release} ${MPFS_RELEASE.year} Medicare Physician Fee ` +
      `Schedule, conversion factor ${MPFS_RELEASE.conversionFactor}, ` +
      `locality ${locality.name} (${locality.state}-${locality.code}), ` +
      `${pos === "office" ? "non-facility" : "facility"} rates.`,
  ]

  if (byConfidence.signal > 0) {
    notes.push(
      "Commercial and Medicaid payers have no Medicare floor. Amounts shown for them are an " +
        "anomaly signal, not a contract violation: commercial rates normally sit above Medicare, " +
        "so falling below it is worth a look rather than proof of anything.",
    )
  }
  if (byConfidence.medium > 0) {
    notes.push(
      "Medicare Advantage plans negotiate their own rates when a provider is contracted, so a " +
        "variance there may be the contract working as written.",
    )
  }
  if (totals.linesModifierSkipped > 0) {
    notes.push(
      `${totals.linesModifierSkipped} line(s) were excluded because they carry a modifier ` +
        "(bilateral, multiple-procedure, reduced services, assistant surgeon) whose pricing rules " +
        "are not modelled here. Those lines may be underpaid too; they are not counted.",
    )
  }
  if (totals.linesNoBenchmark > 0) {
    notes.push(
      `${totals.linesNoBenchmark} line(s) have no national Medicare price (carrier-priced, ` +
        "bundled, or not covered) and were excluded.",
    )
  }
  notes.push(
    "Locality is applied per file, not per claim. If services were rendered in more than one " +
      "Medicare locality the benchmark will be slightly off for the others.",
  )
  return notes
}
