/**
 * NPI validation.
 *
 * An NPI is not merely ten digits: the tenth digit is a Luhn check digit computed
 * over the constant issuer prefix "80840" concatenated with the first nine digits
 * (CMS NPI Final Rule, 45 CFR §162.406; ISO/IEC 7812-1 Luhn). Clearinghouses reject
 * check-digit failures outright — Claim.MD returns "Rendering NPI Fails LUHN check."
 * Catching it before submission is free and deterministic; catching it after costs a
 * rejection cycle and, for a real practice, days of A/R.
 *
 * Import creates a synthetic placeholder provider whose npi is `IMPORT-<practiceId>`
 * (see lib/import/commit.ts). That sentinel is intentionally not an NPI — it must never
 * reach an 837P, so isSyntheticNpi() lets callers reject it with a distinct message
 * rather than a confusing "check digit" error.
 */

const NPI_PREFIX = "80840"

/** Luhn check digit for a 9-digit NPI base, per the CMS "80840" prefix rule. */
export function npiCheckDigit(base9: string): number {
  let total = 0
  let double = true // the rightmost character of the prefixed string is doubled
  const prefixed = NPI_PREFIX + base9
  for (let i = prefixed.length - 1; i >= 0; i--) {
    let d = prefixed.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    total += d
    double = !double
  }
  return (10 - (total % 10)) % 10
}

/** True when `value` is 10 digits AND its check digit is correct. */
export function isValidNpi(value: string | null | undefined): boolean {
  if (!value || !/^\d{10}$/.test(value)) return false
  return npiCheckDigit(value.slice(0, 9)) === value.charCodeAt(9) - 48
}

/** True for the `IMPORT-<practiceId>` placeholder created by backlog import. */
export function isSyntheticNpi(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("IMPORT-")
}

export const NPI_INVALID_MESSAGE =
  "NPI check digit is invalid — verify the number in the NPPES registry (npiregistry.cms.hhs.gov)"

/**
 * Pre-submission NPI gate. Returns a human-readable reason per bad NPI, or [] when clean.
 * Labels are caller-supplied so the message names the field the user has to fix.
 */
export function checkNpis(entries: { label: string; npi: string | null | undefined }[]): string[] {
  const problems: string[] = []
  for (const { label, npi } of entries) {
    if (npi == null || npi === "") continue // absent is a separate concern; only judge what's present
    if (isSyntheticNpi(npi)) {
      problems.push(
        `${label} is the placeholder created by backlog import, not a real NPI — assign the actual rendering provider before submitting`
      )
    } else if (!isValidNpi(npi)) {
      problems.push(`${label} "${npi}" fails the NPI check digit — the clearinghouse will reject this claim`)
    }
  }
  return problems
}
