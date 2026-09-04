// Centralized specialty detection, service type mapping, and appeal context.
// Imported by: appeal-generator.ts, claim-scrub.ts, eligibility callers.

export type Specialty =
  | "behavioral_health"
  | "physical_therapy"
  | "occupational_therapy"
  | "speech_language"
  | "chiropractic"
  | "cardiology"
  | "neurology"
  | "dermatology"
  | "gastroenterology"
  | "orthopedics"
  | "obgyn"
  | "podiatry"
  | "optometry"
  | "allergy"
  | "endocrinology"
  | "rheumatology"
  | "urology"
  | "pediatrics"
  | "nephrology"
  | "pulmonology"
  | "general_medicine"

/**
 * Strip a practice-management suffix from a procedure code.
 *
 * Real PM exports append internal indicators to CPTs — "45380O", "43239O" — which break
 * exact-match lookups against code tables. Only a single trailing letter after exactly five
 * digits is removed, so HCPCS Level II codes (A4550, G0105) and modifiers are left alone.
 */
export function normalizeProcCode(code: string): string {
  const c = String(code ?? "").trim().toUpperCase()
  return /^\d{5}[A-Z]$/.test(c) ? c.slice(0, 5) : c
}

export function detectSpecialty(cptCodes: string[]): Specialty {
  for (const raw of cptCodes) {
    const code = normalizeProcCode(raw)

    // HCPCS Level II (letter-prefixed) never parse as ints — handle them before the numeric ranges.
    if (code === "G0105" || code === "G0121") return "gastroenterology" // screening colonoscopy
    if (code === "G0127") return "podiatry" // trimming of dystrophic nails

    const n = parseInt(code, 10)
    if (isNaN(n)) continue

    if (n >= 90785 && n <= 90899) return "behavioral_health"
    if (n >= 96130 && n <= 96139) return "behavioral_health" // psych testing
    if (n >= 90935 && n <= 90999) return "nephrology" // dialysis

    // Podiatry must precede dermatology, PT and orthopedics: its codes sit inside all three
    // ranges (nail/callus care within the 11xxx integumentary block, wound debridement within
    // the 97xxx block, toe strapping within the 29xxx block).
    if (
      (n >= 11055 && n <= 11057) || // paring of corns/calluses
      (n >= 11040 && n <= 11044) || // debridement (legacy)
      (n >= 11719 && n <= 11765) || // nail trimming, avulsion, excision
      (n >= 28000 && n <= 28899) || // foot and toe surgery
      (n >= 29540 && n <= 29550) || // foot/toe strapping
      (n >= 97597 && n <= 97598) || // wound debridement
      n === 64455 // plantar nerve injection
    ) {
      return "podiatry"
    }

    if (
      (n >= 10060 && n <= 10061) || // I&D abscess
      (n >= 11100 && n <= 11107) || // skin biopsy
      (n >= 11200 && n <= 11201) || // skin tag removal
      (n >= 11300 && n <= 11313) || // shave removal
      (n >= 11400 && n <= 11446) || // benign lesion excision
      (n >= 17000 && n <= 17999) || // destruction of lesions
      n === 96567 || // photodynamic therapy
      (n >= 96910 && n <= 96922) // phototherapy
    ) {
      return "dermatology"
    }

    // OT before PT — they share the 97xxx block and PT's range would otherwise swallow these.
    if (n >= 97129 && n <= 97130) return "occupational_therapy" // cognitive intervention
    if (n >= 97165 && n <= 97168) return "occupational_therapy" // OT evals
    if (n >= 97161 && n <= 97164) return "physical_therapy" // PT evals
    if (n >= 97010 && n <= 97799) return "physical_therapy" // modalities + shared PT/OT treatment

    if (n >= 98940 && n <= 98943) return "chiropractic"

    // Pediatric screening codes sit inside the audiology/speech block — check them first.
    if (n === 96110 || n === 96127 || n === 99173 || n === 92551 || n === 92552) return "pediatrics"
    if ((n >= 99381 && n <= 99384) || (n >= 99391 && n <= 99394) || n === 99460 || n === 99461 || n === 99463) {
      return "pediatrics"
    }

    if (n >= 92507 && n <= 92508) return "speech_language" // speech treatment
    if (n >= 92521 && n <= 92700) return "speech_language" // SLP evals and treatment
    if (n >= 92002 && n <= 92499) return "optometry"

    if (n >= 93000 && n <= 93998) return "cardiology" // includes vascular duplex studies 93880-93971
    if (n >= 94010 && n <= 94799) return "pulmonology" // PFTs, spirometry, oximetry
    if (n === 31622) return "pulmonology" // diagnostic bronchoscopy

    if (n >= 95004 && n <= 95199) return "allergy"
    if (n >= 95805 && n <= 95999) return "neurology" // includes sleep studies 95805-95811

    if (n >= 43200 && n <= 45999) return "gastroenterology"

    // OB/GYN spans several blocks: procedures, OB ultrasound, cytology and HPV testing.
    if (
      (n >= 56405 && n <= 59999) ||
      (n >= 76801 && n <= 76817) || // OB ultrasound
      (n >= 87624 && n <= 87625) || // HPV
      (n >= 88141 && n <= 88175) || // pap cytology
      (n >= 11981 && n <= 11983) // contraceptive implant
    ) {
      return "obgyn"
    }

    // Endocrine-specific imaging/monitoring, checked before the broad ortho range.
    if (n === 95250 || n === 95251 || n === 77080 || n === 77081 || n === 76536) return "endocrinology"

    if (
      (n >= 51700 && n <= 51703) ||
      (n >= 52000 && n <= 52356) ||
      (n >= 54000 && n <= 54999) ||
      (n >= 55700 && n <= 55706) ||
      (n >= 76870 && n <= 76873)
    ) {
      return "urology"
    }

    if (n >= 96365 && n <= 96417) return "rheumatology" // infusion therapy
    if (n >= 20550 && n <= 29999) return "orthopedics" // includes injections 20550-20561
  }

  if (cptCodes.some((c) => c.startsWith("H0") || c.startsWith("T10"))) return "behavioral_health"
  return "general_medicine"
}

// X12 270/271 service type code by specialty — used in checkEligibility() serviceType param
export function getServiceTypeForCPT(cptCodes: string[]): string {
  const map: Record<Specialty, string> = {
    behavioral_health:    "93",
    physical_therapy:     "97",
    occupational_therapy: "97",
    speech_language:      "95",
    chiropractic:         "33",
    podiatry:             "88",
    gastroenterology:     "50",
    orthopedics:          "2",
    obgyn:                "82",
    cardiology:           "1",
    neurology:            "1",
    dermatology:          "1",
    optometry:            "1",
    allergy:              "1",
    endocrinology:        "1",
    rheumatology:         "1",
    urology:              "1",
    pediatrics:           "98",
    nephrology:           "76",
    pulmonology:          "1",
    general_medicine:     "98",
  }
  return map[detectSpecialty(cptCodes)] ?? "1"
}

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  behavioral_health:    "Behavioral Health",
  physical_therapy:     "Physical Therapy",
  occupational_therapy: "Occupational Therapy",
  speech_language:      "Speech-Language Pathology",
  chiropractic:         "Chiropractic",
  cardiology:           "Cardiology",
  neurology:            "Neurology",
  dermatology:          "Dermatology",
  gastroenterology:     "Gastroenterology",
  orthopedics:          "Orthopedic Surgery",
  obgyn:                "OB/GYN",
  podiatry:             "Podiatry",
  optometry:            "Optometry",
  allergy:              "Allergy & Immunology",
  endocrinology:        "Endocrinology",
  rheumatology:         "Rheumatology",
  urology:              "Urology",
  pediatrics:           "Pediatrics",
  nephrology:           "Nephrology",
  pulmonology:          "Pulmonology",
  general_medicine:     "General Medicine",
}

// NPI taxonomy code → Specialty — used to inject practice specialty into AI prompts
export const TAXONOMY_TO_SPECIALTY: Record<string, Specialty> = {
  "193200000X": "general_medicine",   // Group Practice (placeholder)
  // Primary Care
  "207Q00000X": "general_medicine",   // Family Medicine
  "207R00000X": "general_medicine",   // Internal Medicine
  // Pediatrics
  "208000000X": "pediatrics",
  // OB/GYN
  "207V00000X": "obgyn",
  // Behavioral Health
  "2084P0800X": "behavioral_health",  // Psychiatrist
  "103T00000X": "behavioral_health",  // Psychologist (PhD)
  "103TC0700X": "behavioral_health",  // Clinical Psychologist
  "101YM0800X": "behavioral_health",  // Mental Health Counselor
  "104100000X": "behavioral_health",  // Social Worker
  "1041C0700X": "behavioral_health",  // Clinical Social Worker
  "106H00000X": "behavioral_health",  // Marriage & Family Therapist
  "101YA0400X": "behavioral_health",  // Addiction Counselor
  "363LP0808X": "behavioral_health",  // Psychiatric/Mental Health NP
  // Mid-level
  "363L00000X": "general_medicine",   // NP
  "363LF0000X": "general_medicine",   // Family NP
  "363A00000X": "general_medicine",   // PA
  // Medical Specialties
  "207RC0000X": "cardiology",
  "2084N0400X": "neurology",
  "207RG0100X": "gastroenterology",
  "207RE0101X": "endocrinology",
  "207RR0500X": "rheumatology",
  "207K00000X": "allergy",
  "213E00000X": "podiatry",
  "208800000X": "urology",
  "207N00000X": "dermatology",
  "207X00000X": "orthopedics",
  // Physical Medicine
  "225100000X": "physical_therapy",
  "225X00000X": "occupational_therapy",
  "235Z00000X": "speech_language",
  "111N00000X": "chiropractic",
  // Optometry
  "152W00000X": "optometry",
}

export function taxonomyToSpecialtyLabel(taxonomy: string): string {
  const specialty = TAXONOMY_TO_SPECIALTY[taxonomy]
  if (!specialty || specialty === "general_medicine") return ""
  return SPECIALTY_LABELS[specialty]
}

// Typical market charges (approx. Medicare allowable × 2.5–3×)
export const CPT_CHARGE_MASTER: Record<string, number> = {
  // E&M — New patient
  "99202": 145, "99203": 195, "99204": 280, "99205": 360,
  // E&M — Established patient
  "99211": 60, "99212": 100, "99213": 180, "99214": 250, "99215": 325,
  // Preventive — New
  "99385": 270, "99386": 315, "99387": 345,
  // Preventive — Established
  "99395": 270, "99396": 315, "99397": 345,
  // Medicare AWV
  "G0438": 285, "G0439": 225,
  // Pediatric preventive — New
  "99381": 185, "99382": 200, "99383": 215, "99384": 225,
  // Pediatric preventive — Established
  "99391": 185, "99392": 200, "99393": 215, "99394": 225,
  "99460": 245, "99461": 205, "99463": 265,
  // Behavioral Health
  "90791": 265, "90792": 295,
  "90832": 120, "90833": 90,  "90834": 170, "90836": 120,
  "90837": 245, "90838": 170, "90839": 335, "90840": 120,
  "90846": 135, "90847": 145, "90853": 85,
  // Psych testing
  "96130": 255, "96131": 85, "96132": 215, "96133": 85,
  "96136": 155, "96137": 75,
  // Physical Therapy
  "97161": 205, "97162": 225, "97163": 255, "97164": 155,
  "97110": 55, "97112": 55, "97116": 55, "97124": 50,
  "97140": 60, "97530": 60, "97535": 60, "97012": 45,
  "97014": 40, "97032": 45, "97035": 50,
  // Occupational Therapy
  "97165": 215, "97166": 235, "97167": 265, "97168": 165,
  "97129": 60, "97130": 60,
  // Speech-Language Pathology
  "92521": 185, "92522": 185, "92523": 215, "92524": 225, "92610": 205,
  "92507": 65, "92508": 55, "92526": 70,
  // Chiropractic
  "98940": 105, "98941": 135, "98942": 165, "98943": 125,
  // Cardiology
  "93000": 90, "93005": 65, "93010": 55,
  "93306": 625, "93308": 425, "93015": 455, "93017": 355,
  "93224": 315, "93227": 255,
  "93880": 385, "93970": 355,
  // Neurology
  "95816": 295, "95819": 325,
  "95860": 235, "95907": 185, "95908": 245, "95909": 285, "95910": 325,
  "95806": 415, "95810": 1950,
  // Gastroenterology
  "45378": 1175, "45380": 1425, "45385": 1525,
  "43239": 1325, "43251": 1425,
  "G0105": 750, "G0121": 750,
  // Dermatology
  "11102": 215, "11104": 295, "11106": 360,
  "17000": 205, "17003": 35, "17110": 350,
  "10060": 225, "10061": 360,
  // Orthopedics
  "20600": 185, "20605": 205, "20610": 235,
  "25600": 490, "25605": 630,
  "29125": 165, "29515": 185,
  // Podiatry
  "11720": 155, "11721": 175, "11730": 225,
  "11055": 125, "11056": 155,
  "64455": 205, "97597": 290, "28292": 2450,
  // OB/GYN
  "58300": 415, "58301": 315, "57454": 425, "57461": 790,
  "76805": 325, "88142": 95, "87624": 85,
  // Optometry
  "92004": 195, "92012": 125, "92014": 155, "92015": 65,
  "92082": 115, "92083": 155, "92134": 235, "92250": 125,
  // Allergy
  "95004": 145, "95115": 30, "95117": 48, "95165": 18,
  // Endocrinology
  "95250": 305, "95251": 145, "77080": 345, "76536": 225,
  // Rheumatology (infusion)
  "96365": 360, "96366": 95,
  // Urology
  "52000": 415, "55700": 1325, "51702": 185, "52204": 815,
}

export const SPECIALTY_APPEAL_CONTEXT: Record<Specialty, string> = {
  behavioral_health:    "- Where applicable, reference the Mental Health Parity and Addiction Equity Act (MHPAEA), which requires mental health and substance use disorder benefits to be provided at parity with medical/surgical benefits",
  physical_therapy:     "- Reference APTA medical necessity guidelines: functional deficits, measurable progress toward goals, and the skilled nature of the treatment provided",
  occupational_therapy: "- Reference AOTA medical necessity guidelines: functional deficits requiring skilled OT intervention and measurable progress toward independence in activities of daily living",
  speech_language:      "- Reference ASHA clinical guidelines supporting the necessity of speech-language pathology services, including standardized assessment findings and measurable functional goals",
  chiropractic:         "- Reference the documented subluxation, the active (not maintenance) nature of care, and measurable functional improvement demonstrating progress toward treatment goals",
  cardiology:           "- Reference the applicable ACC/AHA clinical guidelines and the documented clinical indications supporting the necessity of the cardiac services billed",
  neurology:            "- Reference AAN clinical guidelines and the documented neurological findings supporting the diagnostic or therapeutic services provided",
  dermatology:          "- Reference AAD clinical guidelines, documented clinical findings, and pathology reports where applicable supporting medical necessity",
  gastroenterology:     "- Reference USPSTF/ACG screening guidelines or documented clinical indications supporting the gastrointestinal procedure, including colonoscopy risk stratification",
  orthopedics:          "- Reference AAOS clinical guidelines, imaging results where available, and the treating provider's documented plan of care supporting medical necessity",
  obgyn:                "- Reference ACOG clinical guidelines and the patient's documented clinical presentation supporting the obstetric or gynecologic services",
  podiatry:             "- Reference the documented podiatric clinical findings and, where applicable, systemic comorbidities (e.g., diabetic foot care under Medicare LCD L33642)",
  optometry:            "- Reference the documented ophthalmologic clinical findings supporting medical necessity; distinguish medical eye care (covered) from routine vision correction (vision benefit, not medical benefit)",
  allergy:              "- Reference AAAAI/ACAAI clinical guidelines, documented allergen test results, and the evidence-based immunotherapy treatment protocol supporting ongoing coverage",
  endocrinology:        "- Reference ADA, ATA, or AACE clinical guidelines and the documented metabolic or hormonal findings supporting the services billed",
  rheumatology:         "- Reference ACR clinical guidelines, applicable disease activity scores (e.g., DAS28, CDAI), and the documented necessity of infusion or injection therapy",
  urology:              "- Reference AUA clinical guidelines and the documented urologic findings supporting the necessity of the diagnostic or therapeutic procedure",
  pediatrics:           "- Reference AAP Bright Futures guidelines and the documented developmental or clinical findings supporting the preventive or therapeutic services provided",
  nephrology:           "- Reference KDIGO/KDOQI clinical practice guidelines and documented renal function (eGFR, dialysis adequacy) supporting the medical necessity of the dialysis services provided",
  pulmonology:          "- Reference ATS/GOLD clinical guidelines and objective pulmonary function findings (spirometry, oximetry) documenting the severity supporting medical necessity",
  general_medicine:     "",
}
