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

/**
 * STAGED ROLLOUT.
 *
 * 500 pages of one template landing at once can read as scraped content to a search engine and
 * damage the whole domain, even when every page carries genuinely distinct data. These pages
 * also name individual physicians rather than institutions, so a smaller first release keeps the
 * blast radius small if someone objects.
 *
 * We publish the highest-value practices first, watch how they index, then raise this number.
 * The rest stay in the dataset and cost nothing until released. Both the route and the sitemap
 * read from here so they can never disagree: a sitemap listing pages that 404 is worse for the
 * domain than publishing nothing.
 */
export const PUBLISH_LIMIT = 100

export function publishedPractices(all: PracticeRecord[]): PracticeRecord[] {
  return [...all].sort((a, b) => b.totalAllowed - a.totalAllowed).slice(0, PUBLISH_LIMIT)
}
