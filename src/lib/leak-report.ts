/**
 * Leak Report — the free, no-signup diagnostic that turns a practice's own A/R export into
 * a dollar figure they have never seen.
 *
 * This module is deliberately PURE: no fetch, no DB, no node builtins, no AI. That is a
 * compliance requirement, not a style preference. The public /leak-report page imports it
 * into a client component so the uploaded file is parsed entirely in the visitor's browser
 * and never crosses the network. Anything added here that touches IO breaks that guarantee
 * and puts the page back in PHI scope.
 *
 * The findings are the ones that actually landed in the first live engagement:
 *   1. Unworked A/R — most aged A/R was never touched, which is not a denial problem.
 *   2. Payer fragmentation — one payer under five spellings hid the #2 payer entirely.
 *   3. Tiered recovery — status-unknown claims need a 276/277, not an appeal.
 *   4. Closing windows — what stops being recoverable in the next 60 days.
 */
import type { ImportedRecord } from "./import/types"
import {
  canonicalPayerName,
  resolvePayer,
  triageAccount,
  type RecoveryTier,
  type TriageResult,
} from "./recovery-playbook"

/** One uploaded file. Multiple sources = portfolio mode (the PE/MSO framing). */
export interface LeakSource {
  /** Practice, location, or file name this data came from. */
  name: string
  records: ImportedRecord[]
}

export interface RecoveryRate {
  low: number
  high: number
}

/**
 * Recovery rates by tier, as a fraction of the balance in that tier.
 *
 * ⚠️ PROVENANCE — these are modeled from ONE live A/R engagement (78 accounts, $96,951.95,
 * gastroenterology, NY, service dates Jan–May 2026), not from an industry benchmark and not
 * from a corpus we do not yet have. Every consumer of this module must surface that. When
 * the first-party corpus is large enough to support real rates, replace these and update
 * `RECOVERY_RATE_BASIS` — do not quietly widen the ranges to look more authoritative.
 */
export const RECOVERY_RATES: Record<string, RecoveryRate> = {
  // Unworked and still inside the appeal window — the highest-yield bucket there is,
  // because nothing has gone wrong yet except that nobody looked.
  "STATUS_UNKNOWN:in": { low: 0.4, high: 0.65 },
  // Unworked and past the window — recovery now depends on good-cause and payer discretion.
  "STATUS_UNKNOWN:past": { low: 0.15, high: 0.3 },
  // Medicare reopening under 42 CFR 405.980: past redetermination, inside the 1-year window.
  "MEDICARE_REOPENING:in": { low: 0.35, high: 0.6 },
  "MEDICARE_REOPENING:past": { low: 0.35, high: 0.6 },
  // Payer never adjudicated. Highest yield of all — this is money the payer never denied.
  "NEVER_ADJUDICATED:in": { low: 0.54, high: 0.79 },
  "NEVER_ADJUDICATED:past": { low: 0.54, high: 0.79 },
  // Worked, denied, still appealable.
  "APPEAL_IN_WINDOW:in": { low: 0.25, high: 0.45 },
  "APPEAL_IN_WINDOW:past": { low: 0.25, high: 0.45 },
  "APPEAL_PAST_WINDOW:in": { low: 0.15, high: 0.3 },
  "APPEAL_PAST_WINDOW:past": { low: 0.15, high: 0.3 },
  // A coding fix, not an appeal — resubmission yields far better than argument.
  "CORRECTED_CLAIM:in": { low: 0.6, high: 0.84 },
  "CORRECTED_CLAIM:past": { low: 0.6, high: 0.84 },
  // Not payer A/R at all; it is collectible from the patient once it is billed to them.
  "PATIENT_RESPONSIBILITY:in": { low: 0.34, high: 0.45 },
  "PATIENT_RESPONSIBILITY:past": { low: 0.34, high: 0.45 },
}

export const RECOVERY_RATE_BASIS =
  "Modeled from one live A/R engagement (78 accounts, $96,952, gastroenterology, NY). " +
  "An estimate of what is typically recoverable in each category, not a guarantee and not " +
  "an industry benchmark."

const TIER_LABELS: Record<RecoveryTier, string> = {
  STATUS_UNKNOWN: "Never worked — status unknown",
  MEDICARE_REOPENING: "Medicare reopening available",
  NEVER_ADJUDICATED: "Payer never adjudicated",
  APPEAL_IN_WINDOW: "Appealable now",
  APPEAL_PAST_WINDOW: "Past the appeal window",
  CORRECTED_CLAIM: "Corrected claim, not an appeal",
  PATIENT_RESPONSIBILITY: "Belongs on a patient statement",
}

/** One account (not one service line) — the unit a biller actually works. */
export interface LeakAccount {
  key: string
  source: string
  payerRaw: string
  payerCanonical: string
  balance: number
  serviceDate?: string
  /** Days since date of service. 0 when the export carried no date (see dateKnown). */
  arDays: number
  dateKnown: boolean
  hasWorklog: boolean
  lines: number
  triage: TriageResult
  recovery: RecoveryRate
  /** Days until timely filing closes. Negative = already closed. null = unknown. */
  daysToTimelyFiling: number | null
}

export interface TierBucket {
  tier: RecoveryTier
  label: string
  accounts: number
  balance: number
  recoveryLow: number
  recoveryHigh: number
  priority: "HIGH" | "MEDIUM" | "LOW"
  action: string
}

export interface PayerRollup {
  canonical: string
  /** Every distinct spelling of this payer found in the export. */
  variants: string[]
  accounts: number
  balance: number
  /** Rank by balance if you never consolidated the spellings (1 = largest). */
  rankAsWritten: number
  /** Rank by balance once consolidated. */
  rankConsolidated: number
}

export interface SourceRollup {
  name: string
  accounts: number
  balance: number
  unworkedBalance: number
  unworkedPctBalance: number
  recoveryLow: number
  recoveryHigh: number
}

export interface LeakReport {
  totals: {
    sources: number
    accounts: number
    serviceLines: number
    payersAsWritten: number
    payersConsolidated: number
    balance: number
  }
  /** The headline finding: A/R nobody has touched. */
  unworked: {
    accounts: number
    balance: number
    pctAccounts: number
    pctBalance: number
  }
  /** Payer-name fragmentation, and which payer it was hiding. */
  fragmentation: {
    merged: PayerRollup[]
    /** Payers whose true rank is higher than any single spelling suggested. */
    hidden: PayerRollup[]
  }
  payers: PayerRollup[]
  tiers: TierBucket[]
  /** Balance that stops being recoverable soon. */
  deadlines: {
    within30: { accounts: number; balance: number }
    within60: { accounts: number; balance: number }
    alreadyClosed: { accounts: number; balance: number }
  }
  recovery: {
    low: number
    high: number
    lowPct: number
    highPct: number
    /** What Claima earns at the 30% contingency rate. */
    feeLow: number
    feeHigh: number
  }
  /** Per-file rollup. Length > 1 is portfolio mode. */
  sources: SourceRollup[]
  /** Honest notes about what the export did not contain. */
  dataQuality: string[]
}

/** Contingency rate applied to recovered dollars. See the pricing model. */
export const CONTINGENCY_RATE = 0.3

const DAY_MS = 86_400_000

function daysBetween(from: string, to: Date): number | null {
  const t = Date.parse(from + "T00:00:00Z")
  if (Number.isNaN(t)) return null
  return Math.floor((to.getTime() - t) / DAY_MS)
}

/**
 * Collapse service lines into accounts. An aging report lists one row per line, so counting
 * rows overstates the work by roughly 10-15% and understates the average balance. Group on
 * the practice's own account number when present; otherwise fall back to patient + payer.
 */
function toAccounts(sources: LeakSource[], asOf: Date): LeakAccount[] {
  // Two passes on purpose. Triage depends on facts that are spread across an account's rows
  // (a worklog note may sit on the second line, the oldest service date may sit on the
  // third), so every row has to be gathered before any account is triaged. Triaging on
  // first sight and patching the aggregate afterwards silently desynchronizes the tier from
  // the fields it was derived from.
  interface Draft {
    source: string
    payerRaw: string
    balance: number
    lines: number
    notes: string[]
    carcCode: string | null
    /** Oldest service date on the account — the one the filing deadline runs from. */
    serviceDate?: string
  }

  const drafts = new Map<string, Draft>()

  for (const source of sources) {
    for (const rec of source.records) {
      const identity =
        rec.externalClaimId ??
        [rec.patientLastName, rec.patientFirstName, rec.patientMemberId, rec.payerName]
          .filter(Boolean)
          .join("|")
      const key = `${source.name}::${identity || Math.random().toString(36)}`

      const balance = rec.totalCharge ?? rec.lines.reduce((s, l) => s + (l.charge ?? 0), 0)
      const draft = drafts.get(key)

      if (draft) {
        draft.balance += balance
        draft.lines += rec.lines.length || 1
        if (rec.denialReason) draft.notes.push(rec.denialReason)
        if (rec.carcCodes?.[0] && !draft.carcCode) draft.carcCode = rec.carcCodes[0]
        if (rec.serviceDate && (!draft.serviceDate || rec.serviceDate < draft.serviceDate)) {
          draft.serviceDate = rec.serviceDate
        }
        continue
      }

      drafts.set(key, {
        source: source.name,
        payerRaw: rec.payerName ?? "Unknown",
        balance,
        lines: rec.lines.length || 1,
        notes: rec.denialReason ? [rec.denialReason] : [],
        carcCode: rec.carcCodes?.[0] ?? null,
        serviceDate: rec.serviceDate,
      })
    }
  }

  return [...drafts.entries()].map(([key, d]) => {
    const arDaysRaw = d.serviceDate ? daysBetween(d.serviceDate, asOf) : null
    const dateKnown = arDaysRaw != null
    const arDays = arDaysRaw ?? 0
    const rule = resolvePayer(d.payerRaw)
    const hasWorklog = d.notes.length > 0

    const triage = triageAccount({
      payer: d.payerRaw,
      arDays,
      hasWorklog,
      carcCode: d.carcCode,
      notes: d.notes,
    })

    const rateKey = `${triage.tier}:${triage.pastAppealWindow ? "past" : "in"}`

    return {
      key,
      source: d.source,
      payerRaw: d.payerRaw,
      payerCanonical: canonicalPayerName(d.payerRaw),
      balance: d.balance,
      serviceDate: d.serviceDate,
      arDays,
      dateKnown,
      hasWorklog,
      lines: d.lines,
      triage,
      recovery: RECOVERY_RATES[rateKey] ?? { low: 0.2, high: 0.4 },
      daysToTimelyFiling: dateKnown && rule ? rule.timelyFilingDays - arDays : null,
    }
  })
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export interface LeakReportOptions {
  /** Injected for deterministic tests; defaults to now. */
  asOf?: Date
}

export function analyzeLeakReport(
  sources: LeakSource[],
  opts: LeakReportOptions = {},
): LeakReport {
  const asOf = opts.asOf ?? new Date()
  const accounts = toAccounts(sources, asOf)
  const balance = sum(accounts.map((a) => a.balance))

  // --- Unworked A/R -------------------------------------------------------
  const unworkedAccts = accounts.filter((a) => !a.hasWorklog)
  const unworkedBalance = sum(unworkedAccts.map((a) => a.balance))

  // --- Payer consolidation ------------------------------------------------
  const rawTotals = new Map<string, number>()
  for (const a of accounts) rawTotals.set(a.payerRaw, (rawTotals.get(a.payerRaw) ?? 0) + a.balance)
  const rawRanked = [...rawTotals.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name)

  const canonMap = new Map<string, { variants: Set<string>; accounts: number; balance: number }>()
  for (const a of accounts) {
    const entry = canonMap.get(a.payerCanonical) ?? { variants: new Set<string>(), accounts: 0, balance: 0 }
    entry.variants.add(a.payerRaw)
    entry.accounts += 1
    entry.balance += a.balance
    canonMap.set(a.payerCanonical, entry)
  }
  const canonRanked = [...canonMap.entries()].sort((x, y) => y[1].balance - x[1].balance)

  const payers: PayerRollup[] = canonRanked.map(([canonical, e], i) => {
    const variants = [...e.variants].sort()
    // Best (numerically lowest) rank any single spelling of this payer achieved on its own.
    const rankAsWritten = Math.min(...variants.map((v) => rawRanked.indexOf(v) + 1))
    return {
      canonical,
      variants,
      accounts: e.accounts,
      balance: round(e.balance),
      rankAsWritten,
      rankConsolidated: i + 1,
    }
  })

  const merged = payers.filter((p) => p.variants.length > 1)
  const hidden = merged.filter((p) => p.rankConsolidated < p.rankAsWritten)

  // --- Recovery tiers -----------------------------------------------------
  const tierMap = new Map<RecoveryTier, LeakAccount[]>()
  for (const a of accounts) {
    const list = tierMap.get(a.triage.tier) ?? []
    list.push(a)
    tierMap.set(a.triage.tier, list)
  }

  const tiers: TierBucket[] = [...tierMap.entries()]
    .map(([tier, list]) => {
      const bal = sum(list.map((a) => a.balance))
      const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      const priority = list
        .map((a) => a.triage.priority)
        .sort((x, y) => priorityRank[x] - priorityRank[y])[0]

      // The action shown for a tier has to describe the tier, not whichever account landed
      // first. Two accounts can share a tier by different routes (a prior-auth denial and an
      // ordinary aged appeal both end up past the window), and showing the first one's
      // instruction tells the reader to do something wrong with most of the balance. Pick
      // the action carrying the most dollars.
      const byAction = new Map<string, number>()
      for (const a of list) {
        byAction.set(a.triage.action, (byAction.get(a.triage.action) ?? 0) + a.balance)
      }
      const action = [...byAction.entries()].sort((x, y) => y[1] - x[1])[0][0]
      return {
        tier,
        label: TIER_LABELS[tier],
        accounts: list.length,
        balance: round(bal),
        recoveryLow: round(sum(list.map((a) => a.balance * a.recovery.low))),
        recoveryHigh: round(sum(list.map((a) => a.balance * a.recovery.high))),
        priority,
        action,
      }
    })
    .sort((x, y) => y.recoveryHigh - x.recoveryHigh)

  // --- Closing windows ----------------------------------------------------
  const withDeadline = accounts.filter((a) => a.daysToTimelyFiling != null)
  const bucket = (pred: (d: number) => boolean) => {
    const list = withDeadline.filter((a) => pred(a.daysToTimelyFiling as number))
    return { accounts: list.length, balance: round(sum(list.map((a) => a.balance))) }
  }

  const recoveryLow = sum(accounts.map((a) => a.balance * a.recovery.low))
  const recoveryHigh = sum(accounts.map((a) => a.balance * a.recovery.high))

  // --- Per-source rollup (portfolio mode) ---------------------------------
  const sourceRollups: SourceRollup[] = sources.map((s) => {
    const list = accounts.filter((a) => a.source === s.name)
    const bal = sum(list.map((a) => a.balance))
    const unworked = sum(list.filter((a) => !a.hasWorklog).map((a) => a.balance))
    return {
      name: s.name,
      accounts: list.length,
      balance: round(bal),
      unworkedBalance: round(unworked),
      unworkedPctBalance: bal > 0 ? round((unworked / bal) * 100) : 0,
      recoveryLow: round(sum(list.map((a) => a.balance * a.recovery.low))),
      recoveryHigh: round(sum(list.map((a) => a.balance * a.recovery.high))),
    }
  })

  // --- Honest gaps --------------------------------------------------------
  const dataQuality: string[] = []
  const noDate = accounts.filter((a) => !a.dateKnown).length
  if (noDate) {
    dataQuality.push(
      `${noDate} account(s) had no service date. Filing windows could not be computed for them, ` +
        `and they are modeled at the in-window rate — which may be optimistic.`,
    )
  }
  const noPayerRule = accounts.filter((a) => !resolvePayer(a.payerRaw)).length
  if (noPayerRule) {
    dataQuality.push(
      `${noPayerRule} account(s) are with a payer we hold no filing-deadline rule for. ` +
        `They are counted in the balance but excluded from the deadline analysis.`,
    )
  }
  const noCarc = accounts.filter((a) => a.hasWorklog && a.triage.tier.startsWith("APPEAL")).length
  if (noCarc) {
    dataQuality.push(
      `This is an aging report, so it carries no CARC/RARC denial codes. ${noCarc} appealable ` +
        `account(s) need their EOB pulled before an appeal can be written — appealing without ` +
        `the actual denial reason is guesswork.`,
    )
  }

  return {
    totals: {
      sources: sources.length,
      accounts: accounts.length,
      serviceLines: sum(accounts.map((a) => a.lines)),
      payersAsWritten: rawTotals.size,
      payersConsolidated: canonMap.size,
      balance: round(balance),
    },
    unworked: {
      accounts: unworkedAccts.length,
      balance: round(unworkedBalance),
      pctAccounts: accounts.length ? round((unworkedAccts.length / accounts.length) * 100) : 0,
      pctBalance: balance ? round((unworkedBalance / balance) * 100) : 0,
    },
    fragmentation: { merged, hidden },
    payers,
    tiers,
    deadlines: {
      within30: bucket((d) => d > 0 && d <= 30),
      within60: bucket((d) => d > 0 && d <= 60),
      alreadyClosed: bucket((d) => d <= 0),
    },
    recovery: {
      low: round(recoveryLow),
      high: round(recoveryHigh),
      lowPct: balance ? round((recoveryLow / balance) * 100) : 0,
      highPct: balance ? round((recoveryHigh / balance) * 100) : 0,
      feeLow: round(recoveryLow * CONTINGENCY_RATE),
      feeHigh: round(recoveryHigh * CONTINGENCY_RATE),
    },
    sources: sourceRollups,
    dataQuality,
  }
}
