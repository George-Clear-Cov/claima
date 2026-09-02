/**
 * CPT/HCPCS modifier reference — product knowledge for the AI layer.
 *
 * Modifier errors are the quiet driver of CO-4 ("procedure inconsistent with modifier") and
 * CO-11 ("diagnosis inconsistent with procedure") denials. Most are fixed with a corrected
 * claim rather than an appeal, which is faster and pays at a higher rate.
 */

export interface ModifierRule {
  modifier: string
  meaning: string
  whenToUse: string
  /** Payers or programs with a specific requirement around this modifier. */
  payerNote?: string
}

export const TELEHEALTH_MODIFIERS: ModifierRule[] = [
  { modifier: "95", meaning: "Synchronous telehealth via real-time audio/video", whenToUse: "Post-PHE standard for live video visits" },
  { modifier: "GT", meaning: "Via interactive audio/video", whenToUse: "Legacy — still accepted by many payers", payerNote: "Prefer 95 unless the payer specifically requires GT" },
]

export const TELEHEALTH_POS = [
  { pos: "02", meaning: "Telehealth provided other than in the patient's home" },
  { pos: "10", meaning: "Telehealth provided in the patient's home", payerNote: "Standard post-PHE" },
  { pos: "11", meaning: "Office", payerNote: "Use when the patient travels to the office" },
]

export const COMMON_MODIFIERS: ModifierRule[] = [
  { modifier: "25", meaning: "Significant, separately identifiable E&M on the same day as a procedure", whenToUse: "E&M plus a minor procedure same day" },
  { modifier: "57", meaning: "Decision for surgery", whenToUse: "E&M on the same day as a major surgery" },
  { modifier: "59", meaning: "Distinct procedural service", whenToUse: "Two services same day at different sites/sessions", payerNote: "Medicare prefers the X{EPSU} subset — use XS/XU where they fit" },
  { modifier: "XS", meaning: "Separate structure", whenToUse: "Separate organ/structure — preferred over 59 for Medicare" },
  { modifier: "XU", meaning: "Unusual non-overlapping service", whenToUse: "Service does not overlap the main procedure's usual components" },
  { modifier: "51", meaning: "Multiple procedures", whenToUse: "Second and subsequent procedures in the same session" },
  { modifier: "52", meaning: "Reduced services", whenToUse: "Procedure partially reduced or not completed at the provider's discretion" },
  { modifier: "76", meaning: "Repeat procedure by the same physician", whenToUse: "Same service repeated same day, same provider" },
  { modifier: "77", meaning: "Repeat procedure by a different physician", whenToUse: "Same service repeated same day, different provider" },
  { modifier: "AT", meaning: "Active treatment (chiropractic)", whenToUse: "Chiropractic manipulative treatment", payerNote: "REQUIRED for Medicare CMT coverage — omission is an automatic denial" },
  { modifier: "AH", meaning: "Clinical psychologist", whenToUse: "PhD/PsyD rendering provider", payerNote: "Medicaid" },
  { modifier: "HO", meaning: "Master's degree level", whenToUse: "LCSW/LPC/LMHC rendering provider", payerNote: "Medicaid" },
  { modifier: "HN", meaning: "Bachelor's degree level", whenToUse: "Bachelor's-level rendering provider", payerNote: "Some Medicaid programs" },
]

/**
 * Preventive-services modifiers. These control *patient cost-sharing*, not payment amount,
 * and omitting them bills the patient for a service that should be at zero cost — which is
 * how a clean clinical encounter turns into a patient complaint and an A/R write-off.
 */
export const PREVENTIVE_MODIFIERS: ModifierRule[] = [
  {
    modifier: "PT",
    meaning: "Colorectal cancer screening converted to a diagnostic/therapeutic procedure",
    whenToUse: "Screening colonoscopy where a polyp is found and removed",
    payerNote: "Medicare — waives the deductible. Without it the patient is billed cost-sharing they do not owe.",
  },
  {
    modifier: "33",
    meaning: "Preventive service",
    whenToUse: "Commercial equivalent of PT — screening that becomes diagnostic",
    payerNote: "Commercial — preserves ACA §2713 zero cost-sharing.",
  },
]

const ALL = [...TELEHEALTH_MODIFIERS, ...COMMON_MODIFIERS, ...PREVENTIVE_MODIFIERS]

export function lookupModifier(mod: string): ModifierRule | null {
  const m = String(mod ?? "").trim().toUpperCase()
  return ALL.find((r) => r.modifier.toUpperCase() === m) ?? null
}

/** GI screening codes whose therapeutic conversion requires PT/33. */
const SCREENING_CONVERSION_CPT = new Set(["45378", "45380", "45381", "45384", "45385", "G0105", "G0121"])

/**
 * Detect the screening-converted-to-diagnostic case: a therapeutic GI code billed with a
 * screening indication but no preventive modifier. This is a corrected claim, not an appeal.
 */
export function needsPreventiveModifier(cptCodes: string[], icd10Codes: string[], modifiers: string[] = []): boolean {
  const hasScreeningDx = icd10Codes.some((d) => d.toUpperCase().startsWith("Z12"))
  const hasTherapeutic = cptCodes.some((c) => SCREENING_CONVERSION_CPT.has(c.toUpperCase()))
  const hasPreventive = modifiers.some((m) => ["PT", "33"].includes(m.toUpperCase()))
  return hasScreeningDx && hasTherapeutic && !hasPreventive
}

/** Compact modifier guidance for prompt injection. */
export function modifierGuidanceForPrompt(cptCodes: string[], icd10Codes: string[]): string {
  const out: string[] = []
  if (needsPreventiveModifier(cptCodes, icd10Codes)) {
    out.push(
      "LIKELY ROOT CAUSE: screening procedure converted to therapeutic without a preventive " +
        "modifier. Medicare requires PT; commercial requires 33. This is a CORRECTED CLAIM, " +
        "not an appeal — the service retains screening status for patient cost-sharing.",
    )
  }
  return out.join("\n")
}
