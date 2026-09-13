/**
 * Shapes for the per-practice pages at /p/<slug>.
 *
 * Kept separate from scripts/fetch-practice-data.ts so the Next build never pulls a build
 * script (and its node:fs imports) into the app graph.
 */

export interface PracticeCode {
  code: string
  /** CMS's own plain-language description from the PUF, not the AMA long descriptor. */
  desc: string
  /** "O" office / "F" facility. */
  pos: string
  services: number
  beneficiaries: number
  /** The practice's own average submitted charge. */
  charge: number
  /** Average Medicare allowed, already locality-adjusted by CMS for this provider. */
  allowed: number
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
  /** Share of allowed dollars in the top five codes. */
  concentration: number
}
