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
