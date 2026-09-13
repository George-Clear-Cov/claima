/**
 * Backlog import — the ONE normalized shape every format adapter (835 / 837 / CSV / text)
 * produces. The commit engine (commit.ts) only ever sees ImportedRecord[], so adding a new
 * source format is just writing a new adapter; nothing downstream changes.
 */

export type ImportFormat = "835" | "837" | "csv" | "text"

export interface ImportedLine {
  cptCode: string
  modifiers?: string[]
  icd10Codes?: string[]
  units?: number
  charge?: number
  paid?: number
  /**
   * AMT*B6 — what the payer says it allowed for this line. Only remittance (835) sources
   * carry it; an aging CSV has balances, not adjudication. This is the anchor for
   * Medicare-fee-schedule underpayment detection, so dropping it in normalization is what
   * previously made that analysis impossible from the leak report.
   */
  allowed?: number
  /** Line-level PR-group total (deductible + coinsurance + copay). */
  patientResponsibility?: number
}

export interface ImportedRecord {
  /** The practice's own claim/patient control number — used for dedup + matching. */
  externalClaimId?: string
  /** Payer's internal claim number (CLP07 / needed to appeal). */
  payerClaimControlNumber?: string

  patientFirstName?: string
  patientLastName?: string
  patientMemberId?: string
  patientDob?: string // YYYY-MM-DD if the source provides it (835 does not)

  payerId?: string
  payerName?: string
  providerNpi?: string
  providerName?: string

  serviceDate?: string // YYYY-MM-DD
  lines: ImportedLine[]
  totalCharge?: number
  totalPaid?: number

  /** Outcome for the denial-recovery workflow. */
  status: "denied" | "paid" | "open"
  carcCodes?: string[]
  /**
   * LQ*HE remark codes from the 835. The CARC says a claim failed; the RARC says exactly
   * what is wrong — which document is missing, which identifier is invalid. Appeals written
   * without it tend to be denied a second time for the same reason.
   */
  rarcCodes?: string[]
  denialReason?: string
  patientResponsibility?: number

  /** Per-record parse notes surfaced in the preview (e.g. "demographics missing"). */
  warnings?: string[]
}

export interface ImportParseResult {
  format: ImportFormat
  records: ImportedRecord[]
  /** File-level parse warnings (not tied to a single record). */
  warnings: string[]
}

export interface ImportCommitSummary {
  dryRun: boolean
  patientsCreated: number
  providersCreated: number
  claimsCreated: number
  denialsCreated: number
  /** Records skipped as duplicates of already-imported/existing claims. */
  skipped: number
  warnings: string[]
}
