/**
 * X12 835 (Health Care Claim Payment/Advice) parser.
 * Spec: ASC X12 005010X221A1
 *
 * Zero dependencies and no Node APIs — this module is designed to run IN THE BROWSER
 * so a practice can analyze its own remittances without the file ever being uploaded.
 *
 * PHI BOUNDARY: parsing extracts everything, including patient identifiers, because the
 * result is rendered locally on the practice's own machine. Nothing here may be
 * transmitted. `toDeidentifiedFacts()` produces the ONLY payload allowed to leave the
 * browser — keep that function as the single auditable egress point.
 */

export interface Adjustment {
  /** CO = contractual, PR = patient responsibility, OA = other, PI = payer initiated, CR = correction */
  group: string
  /** CARC code */
  reason: string
  amount: number
  quantity?: number
}

/** Patient responsibility split out of the CAS "PR" group by CARC reason code. */
export interface PatientRespBreakdown {
  /** PR-1 */
  deductible: number
  /** PR-2 */
  coinsurance: number
  /** PR-3 */
  copay: number
  /** any other PR-group reason (non-covered PR-96, benefit-max PR-119, etc.) */
  other: number
  total: number
}

export interface ServiceLine {
  cpt: string
  modifiers: string[]
  charge: number
  paid: number
  /** AMT*B6 — what the payer says it allowed. The anchor for underpayment detection. */
  allowed?: number
  units: number
  serviceDate?: string
  adjustments: Adjustment[]
  /** CAS group CO total — the contractual plan write-off. */
  contractualAdjustment: number
  /** CAS group PR, split by reason so the patient sees deductible vs copay vs coinsurance. */
  patientResp: PatientRespBreakdown
}

export interface ClaimPayment {
  /** CLP01 — the practice's own claim/patient control number */
  claimId: string
  /** CLP02 — 1/2/3 = paid as primary/secondary/tertiary, 4 = DENIED, 22 = reversal */
  status: string
  totalCharge: number
  totalPaid: number
  patientResponsibility: number
  /** CLP07 — payer's internal claim number, needed to appeal */
  payerClaimControlNumber?: string
  serviceDateFrom?: string
  serviceDateTo?: string
  adjustments: Adjustment[]
  /** Claim-level patient-responsibility split, aggregated across all lines + claim-level CAS. */
  patientResp: PatientRespBreakdown
  lines: ServiceLine[]

  /** ── PHI. Local rendering only. Never transmit. ── */
  patientName?: string
  patientMemberId?: string
}

/** PLB — provider-level adjustment. Where payers quietly claw money back. */
export interface ProviderAdjustment {
  reason: string
  amount: number
  referenceId?: string
}

export interface Remittance835 {
  payerName?: string
  payerId?: string
  payeeName?: string
  payeeNpi?: string
  /** BPR02 — total of the check/EFT */
  paymentAmount: number
  /** BPR04 — ACH, CHK, NON (no payment / denial-only advice) */
  paymentMethod?: string
  /** BPR16 — effective date, YYYYMMDD */
  paymentDate?: string
  /** TRN02 — check or EFT trace number */
  checkNumber?: string
  claims: ClaimPayment[]
  providerAdjustments: ProviderAdjustment[]
}

// ── Tokenizing ────────────────────────────────────────────────────────────────

interface Delimiters {
  element: string
  segment: string
  component: string
}

/**
 * The spec fixes ISA at 106 characters, which would make the delimiters positional
 * (component at 104, terminator at 105). Real clearinghouse files drift off that width,
 * so instead we count: ISA always has exactly 16 elements, ISA16 is always the single
 * component separator, and the segment terminator is always the character right after it.
 * That holds regardless of how badly the sender padded the fixed-width fields.
 *
 * Falls back to the common defaults when there's no ISA envelope — some clearinghouses
 * hand out bare ST...SE fragments.
 */
function detectDelimiters(raw: string): Delimiters {
  const fallback: Delimiters = { element: "*", component: ":", segment: "~" }
  if (!raw.startsWith("ISA") || raw.length < 4) return fallback

  const element = raw[3]
  let separators = 0
  let i = 3
  while (i < raw.length && separators < 16) {
    if (raw[i] === element) separators++
    i++
  }
  // i now sits on ISA16 (the component separator); the terminator immediately follows.
  if (separators < 16 || i + 1 >= raw.length) return fallback

  return { element, component: raw[i], segment: raw[i + 1] }
}

type Segment = { id: string; el: string[] }

function tokenize(raw: string, d: Delimiters): Segment[] {
  return raw
    .split(d.segment)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(d.element)
      return { id: parts[0].toUpperCase(), el: parts }
    })
}

/** 1-indexed element access matching how the X12 spec names them (CLP03 → at(seg, 3)). */
function at(seg: Segment, i: number): string {
  return seg.el[i] ?? ""
}

function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyBreakdown(): PatientRespBreakdown {
  return { deductible: 0, coinsurance: 0, copay: 0, other: 0, total: 0 }
}

/**
 * Split CAS "PR" (patient responsibility) adjustments into deductible (PR-1),
 * coinsurance (PR-2), and copay (PR-3); everything else PR lands in `other`
 * (non-covered PR-96, benefit-max PR-119, etc.). This is the split the patient
 * sees on their cost-transparency statement — never flatten it back to one number.
 */
export function splitPatientResponsibility(adjustments: Adjustment[]): PatientRespBreakdown {
  const b = emptyBreakdown()
  for (const a of adjustments) {
    if (a.group !== "PR") continue
    if (a.reason === "1") b.deductible += a.amount
    else if (a.reason === "2") b.coinsurance += a.amount
    else if (a.reason === "3") b.copay += a.amount
    else b.other += a.amount
  }
  b.deductible = round2(b.deductible)
  b.coinsurance = round2(b.coinsurance)
  b.copay = round2(b.copay)
  b.other = round2(b.other)
  b.total = round2(b.deductible + b.coinsurance + b.copay + b.other)
  return b
}

/** Sum the amounts of a single CAS group (e.g. "CO" for contractual write-off). */
export function sumAdjustmentGroup(adjustments: Adjustment[], group: string): number {
  return round2(adjustments.filter((a) => a.group === group).reduce((s, a) => s + a.amount, 0))
}

// ── Segment handlers ──────────────────────────────────────────────────────────

/**
 * CAS carries up to six (reason, amount, quantity) triplets after the group code:
 * CAS01 = group, then CAS02-04, CAS05-07, CAS08-10, CAS11-13, CAS14-16, CAS17-19.
 */
function parseCAS(seg: Segment): Adjustment[] {
  const group = at(seg, 1)
  const out: Adjustment[] = []
  for (let i = 2; i + 1 < seg.el.length; i += 3) {
    const reason = at(seg, i)
    if (!reason) continue
    const amount = num(at(seg, i + 1))
    const quantity = num(at(seg, i + 2))
    out.push({ group, reason, amount, ...(quantity ? { quantity } : {}) })
  }
  return out
}

/** SVC01 is a composite: qualifier:code:mod1:mod2:mod3:mod4 — e.g. "HC:97110:GP" */
function parseSVC(seg: Segment, comp: string): ServiceLine {
  const composite = at(seg, 1).split(comp)
  return {
    cpt: composite[1] ?? "",
    modifiers: composite.slice(2).filter(Boolean),
    charge: num(at(seg, 2)),
    paid: num(at(seg, 3)),
    // SVC05 is units paid; it is frequently blank, in which case 1 is the safe read.
    units: num(at(seg, 5)) || 1,
    adjustments: [],
    contractualAdjustment: 0,
    patientResp: emptyBreakdown(),
  }
}

/**
 * PLB repeats (adjustment-identifier-composite, amount) pairs from element 3 onward.
 * PLB03 = composite of reason code + reference id, PLB04 = amount.
 */
function parsePLB(seg: Segment, comp: string): ProviderAdjustment[] {
  const out: ProviderAdjustment[] = []
  for (let i = 3; i + 1 < seg.el.length; i += 2) {
    const composite = at(seg, i).split(comp)
    const reason = composite[0]
    if (!reason) continue
    out.push({
      reason,
      amount: num(at(seg, i + 1)),
      ...(composite[1] ? { referenceId: composite[1] } : {}),
    })
  }
  return out
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parse835(raw: string): Remittance835 {
  const d = detectDelimiters(raw)
  const segments = tokenize(raw, d)

  const remit: Remittance835 = { paymentAmount: 0, claims: [], providerAdjustments: [] }

  let claim: ClaimPayment | null = null
  let line: ServiceLine | null = null

  const closeLine = () => {
    if (claim && line) {
      line.contractualAdjustment = sumAdjustmentGroup(line.adjustments, "CO")
      line.patientResp = splitPatientResponsibility(line.adjustments)
      claim.lines.push(line)
    }
    line = null
  }
  const closeClaim = () => {
    closeLine()
    if (claim) {
      // Aggregate PR across claim-level CAS + every line's CAS for the claim total.
      const allAdj = [...claim.adjustments, ...claim.lines.flatMap((l) => l.adjustments)]
      claim.patientResp = splitPatientResponsibility(allAdj)
      remit.claims.push(claim)
    }
    claim = null
  }

  for (const seg of segments) {
    switch (seg.id) {
      case "BPR":
        remit.paymentAmount = num(at(seg, 2))
        remit.paymentMethod = at(seg, 4)
        remit.paymentDate = at(seg, 16)
        break

      case "TRN":
        remit.checkNumber = at(seg, 2)
        break

      case "N1":
        // N1*PR = payer, N1*PE = payee (the practice)
        if (at(seg, 1) === "PR") {
          remit.payerName = at(seg, 2)
          remit.payerId = at(seg, 4)
        } else if (at(seg, 1) === "PE") {
          remit.payeeName = at(seg, 2)
          remit.payeeNpi = at(seg, 4)
        }
        break

      case "CLP":
        closeClaim()
        claim = {
          claimId: at(seg, 1),
          status: at(seg, 2),
          totalCharge: num(at(seg, 3)),
          totalPaid: num(at(seg, 4)),
          patientResponsibility: num(at(seg, 5)),
          payerClaimControlNumber: at(seg, 7) || undefined,
          adjustments: [],
          patientResp: emptyBreakdown(),
          lines: [],
        }
        break

      case "NM1":
        // QC = patient. PHI — retained for local display only.
        if (claim && at(seg, 1) === "QC") {
          claim.patientName = [at(seg, 4), at(seg, 3)].filter(Boolean).join(" ")
          if (at(seg, 9)) claim.patientMemberId = at(seg, 9)
        }
        break

      case "SVC":
        closeLine()
        if (claim) line = parseSVC(seg, d.component)
        break

      case "CAS": {
        const adj = parseCAS(seg)
        // A CAS after an SVC belongs to that line; before any SVC it is claim-level.
        if (line) line.adjustments.push(...adj)
        else if (claim) claim.adjustments.push(...adj)
        break
      }

      case "AMT":
        // B6 = allowed amount. The single most important number for underpayment detection.
        if (at(seg, 1) === "B6") {
          const allowed = num(at(seg, 2))
          if (line) line.allowed = allowed
        }
        break

      case "DTM": {
        const qualifier = at(seg, 1)
        const date = at(seg, 2)
        if (line && qualifier === "472") line.serviceDate = date
        else if (claim && qualifier === "232") claim.serviceDateFrom = date
        else if (claim && qualifier === "233") claim.serviceDateTo = date
        break
      }

      case "PLB":
        remit.providerAdjustments.push(...parsePLB(seg, d.component))
        break

      case "SE":
        closeClaim()
        break
    }
  }

  closeClaim()
  return remit
}

/** A file may contain several ST...SE transactions, and practices often hand us many files. */
export function parse835Files(contents: string[]): Remittance835[] {
  return contents.flatMap((c) => {
    try {
      return [parse835(c)]
    } catch {
      return []
    }
  })
}

// ── The PHI egress boundary ───────────────────────────────────────────────────

/**
 * Rate facts only — no patient name, no member ID, no claim identifiers, and the service
 * date coarsened to the month so a line can't be re-identified by date + CPT + provider.
 * This is the ONLY shape permitted to leave the browser.
 */
export interface RateFact {
  cpt: string
  modifiers: string[]
  payerName?: string
  payerId?: string
  charge: number
  allowed?: number
  paid: number
  units: number
  /** YYYY-MM */
  serviceMonth?: string
  /** CARC codes, group-prefixed — e.g. "CO-45" */
  adjustmentCodes: string[]
  denied: boolean
}

function toServiceMonth(yyyymmdd?: string): string | undefined {
  if (!yyyymmdd || yyyymmdd.length < 6) return undefined
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}`
}

export function toDeidentifiedFacts(remits: Remittance835[]): RateFact[] {
  const facts: RateFact[] = []

  for (const remit of remits) {
    for (const claim of remit.claims) {
      const denied = claim.status === "4"
      for (const line of claim.lines) {
        facts.push({
          cpt: line.cpt,
          modifiers: line.modifiers,
          payerName: remit.payerName,
          payerId: remit.payerId,
          charge: line.charge,
          allowed: line.allowed,
          paid: line.paid,
          units: line.units,
          serviceMonth: toServiceMonth(line.serviceDate ?? claim.serviceDateFrom),
          adjustmentCodes: line.adjustments.map((a) => `${a.group}-${a.reason}`),
          denied,
        })
      }
    }
  }

  return facts
}
