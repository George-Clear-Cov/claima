import { aiComplete, isAIConfigured } from "@/lib/ai"

export interface ScrubIssue {
  severity: "error" | "warning" | "info"
  message: string
  fix: string
}

export interface ScrubResult {
  score: number
  verdict: "clean" | "caution" | "warning"
  issues: ScrubIssue[]
  summary: string
}

export interface ScrubInput {
  cptCode: string
  icd10Codes: string[]
  modifier?: string
  payerName?: string
  charge?: number
  serviceDate?: string
  specialty?: string
}

export interface ClaimLineInput {
  cptCode: string
  modifier?: string
  charge?: number
}

export interface MultiLineScrubInput {
  lineItems: ClaimLineInput[]
  icd10Codes: string[]
  payerName?: string
  serviceDate?: string
}

export async function scrubClaim(input: ScrubInput): Promise<ScrubResult> {
  const { cptCode, icd10Codes, modifier, payerName, charge, serviceDate, specialty } = input

  if (!isAIConfigured()) {
    return basicScrub({ cptCode, icd10Codes, modifier, charge: charge ?? 0 })
  }

  const prompt = `You are a medical billing expert with deep knowledge of outpatient claim submission across all specialties (837P). Review this claim for denial risk before it is submitted.

CPT Code: ${cptCode}
ICD-10 Diagnosis Codes: ${icd10Codes.join(", ")}
Modifier: ${modifier || "none"}
Specialty: ${specialty ?? "not specified"}
Payer: ${payerName ?? "unknown"}
Charge Amount: ${charge != null ? `$${charge}` : "not provided"}
Service Date: ${serviceDate ?? "not provided"}

Analyze for:
1. CPT/ICD-10 medical necessity alignment — do the diagnoses support the procedure for this specialty?
2. Common denial triggers for this CPT (prior auth requirements, bundling issues, frequency limitations, CARC codes 4, 16, 50, 96, 97, 197)
3. Modifier presence and correctness (telehealth GT/95, bilateral 50, assistant surgeon 80, place of service)
4. Charge amount reasonableness for this CPT and specialty
5. Any payer-specific gotchas for ${payerName ?? "this payer"} with this CPT code

Respond ONLY with valid JSON:
{
  "score": <integer 0-100, where 100 = zero risk>,
  "verdict": <"clean" | "caution" | "warning">,
  "issues": [
    {
      "severity": <"error" | "warning" | "info">,
      "message": "<concise description of the issue>",
      "fix": "<specific actionable step the biller should take>"
    }
  ],
  "summary": "<one sentence for the biller>"
}

verdict: clean if score>=85, caution if 60-84, warning if <60. Return an empty array if no issues.`

  try {
    const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")
    return JSON.parse(match[0]) as ScrubResult
  } catch {
    return basicScrub({ cptCode, icd10Codes, modifier, charge: charge ?? 0 })
  }
}

export function basicScrub({ cptCode, icd10Codes, modifier, charge }: {
  cptCode: string
  icd10Codes: string[]
  modifier?: string
  charge: number
}): ScrubResult {
  const issues: ScrubIssue[] = []
  const cptNum = parseInt(cptCode, 10)
  const isValidCptFormat = /^\d{5}$/.test(cptCode) || /^[A-Z]\d{4}$/.test(cptCode)

  if (!isValidCptFormat) {
    issues.push({ severity: "error", message: `CPT code "${cptCode}" is not a valid format`, fix: "Must be 5 numeric digits (e.g. 99213) or HCPCS Level II format (e.g. G0439)" })
  }

  // DX/CPT specialty alignment
  issues.push(...checkDxCptAlignment([cptCode], icd10Codes))

  if (!icd10Codes.length) {
    issues.push({ severity: "error", message: "No ICD-10 diagnosis codes", fix: "Add at least one diagnosis code — claim will be auto-rejected without one" })
  }

  const invalidDx = icd10Codes.filter(c => !/^[A-Z]\d/.test(c.toUpperCase()))
  if (invalidDx.length > 0) {
    issues.push({ severity: "error", message: `Invalid ICD-10 format: ${invalidDx.join(", ")}`, fix: "ICD-10 codes must start with a letter followed by digits (e.g. J06.9, M54.50)" })
  }

  if (charge === 0) {
    issues.push({ severity: "error", message: "Charge amount is $0", fix: "Set the charge amount — claims with $0 charge are rejected by all payers" })
  }

  // Telehealth modifier checks
  if (modifier === "GT" || modifier === "95") {
    issues.push({ severity: "info", message: "Telehealth modifier present — confirm payer covers telehealth for this CPT", fix: "Verify payer telehealth policy and use POS 10 (patient home) or POS 02 on the CMS-1500" })
  }

  // Chiropractic: AT modifier required for Medicare active treatment
  if (!isNaN(cptNum) && cptNum >= 98940 && cptNum <= 98943) {
    if (!modifier || modifier.toUpperCase() !== "AT") {
      issues.push({ severity: "warning", message: "Chiropractic CMT code without AT modifier", fix: "Add modifier AT (Active Treatment) — Medicare requires it for chiropractic manipulation coverage; without it, the claim will be denied" })
    }
  }

  // 90792 requires MD/NP prescribing authority
  if (cptCode === "90792") {
    issues.push({ severity: "info", message: "CPT 90792 (psychiatric eval with medical services) requires prescribing authority", fix: "Confirm rendering provider is an MD, DO, NP, or PA — LCSWs, LPCs, and psychologists cannot bill 90792; use 90791 instead" })
  }

  // Prior auth high-risk codes
  const priorAuthRiskCpts: Record<string, string> = {
    "90839": "Crisis psychotherapy — some payers require authorization for crisis codes",
    "96365": "IV infusion (biologics) — almost always requires prior authorization; submit PA before infusion",
    "96366": "IV infusion add-on — verify PA covers all infusion hours",
    "45378": "Diagnostic colonoscopy — verify PA not required; use G0105/G0121 for Medicare screening",
    "45380": "Colonoscopy with biopsy — many commercial payers require PA",
    "45385": "Colonoscopy with polypectomy — prior auth frequently required by commercial payers",
    "93306": "Transthoracic echocardiogram — prior auth required by many commercial plans",
    "95810": "Polysomnography — sleep studies commonly require prior authorization",
    "95807": "Polysomnography — sleep studies commonly require prior authorization",
    "55700": "Prostate biopsy — verify PA status with payer before procedure",
  }
  if (priorAuthRiskCpts[cptCode]) {
    issues.push({ severity: "warning", message: `Prior auth risk: ${priorAuthRiskCpts[cptCode]}`, fix: "Confirm authorization status before submitting — denial on PA grounds requires full appeal process" })
  }

  // Therapy units reminder (15-min timed codes)
  const timedTherapyCpts = new Set(["97110", "97112", "97116", "97124", "97140", "97530", "97032", "97035", "97129", "97130"])
  if (timedTherapyCpts.has(cptCode) && charge > 0 && charge < 20) {
    issues.push({ severity: "warning", message: "Therapy charge appears low — these codes bill in 15-minute units", fix: "Verify units are correct: 1 unit = 15 min. Most practices bill 2–4 units per code per session" })
  }

  // Screening colonoscopy: use G-codes for Medicare, not 45378
  if (cptCode === "45378") {
    issues.push({ severity: "info", message: "For Medicare screening colonoscopy, use G0105 (high risk) or G0121 (average risk) instead of 45378", fix: "G-codes have $0 patient cost-sharing for Medicare screening; 45378 triggers cost-sharing as diagnostic" })
  }

  // Charge reasonableness floor by CPT range
  const chargeFloors: Array<{ min: number; max: number; floor: number; label: string }> = [
    { min: 99202, max: 99215, floor: 50,  label: "E&M office visit" },
    { min: 90832, max: 90839, floor: 60,  label: "psychotherapy" },
    { min: 97110, max: 97530, floor: 15,  label: "therapy procedure (per unit)" },
    { min: 98940, max: 98943, floor: 25,  label: "chiropractic manipulation" },
    { min: 93000, max: 93018, floor: 40,  label: "cardiac diagnostic" },
    { min: 93306, max: 93351, floor: 150, label: "echocardiogram" },
    { min: 11102, max: 11107, floor: 80,  label: "skin biopsy" },
    { min: 45378, max: 45392, floor: 200, label: "colonoscopy" },
    { min: 20600, max: 20611, floor: 60,  label: "joint injection" },
  ]
  if (!isNaN(cptNum) && charge > 0) {
    const match = chargeFloors.find(r => cptNum >= r.min && cptNum <= r.max)
    if (match && charge < match.floor) {
      issues.push({ severity: "info", message: `Charge of $${charge} may be below typical range for ${match.label}`, fix: `Verify this is the intended charge — typical floor for this service type is ~$${match.floor}` })
    }
  }

  const score = Math.max(0,
    100
    - issues.filter(i => i.severity === "error").length * 30
    - issues.filter(i => i.severity === "warning").length * 12
    - issues.filter(i => i.severity === "info").length * 3
  )

  return {
    score,
    verdict: score >= 85 ? "clean" : score >= 60 ? "caution" : "warning",
    issues,
    summary: issues.length === 0
      ? "No issues detected — claim looks ready to submit."
      : `${issues.length} item${issues.length > 1 ? "s" : ""} flagged — review before submitting.`,
  }
}

// ─── NCCI Bundling Check ──────────────────────────────────────────────────────

interface NcciPair {
  col1: string
  col2: string         // bundled INTO col1 when both present
  mod59Allowed: boolean
  message: string
  fix: string
}

const NCCI_PAIRS: NcciPair[] = [
  // PT codes — frequently bundled by payers
  { col1: "97140", col2: "97530", mod59Allowed: true,  message: "Manual therapy (97140) and therapeutic activities (97530) billed same day", fix: "Add modifier 59 to 97530 if performed on a distinct body region; document separately in the treatment note" },
  { col1: "97110", col2: "97530", mod59Allowed: true,  message: "Therapeutic exercise (97110) and therapeutic activities (97530) billed same day", fix: "These overlap in many payer edits — add modifier 59 and document distinct goals and body regions for each" },
  { col1: "97140", col2: "97110", mod59Allowed: true,  message: "Manual therapy (97140) and therapeutic exercise (97110) billed same day", fix: "Add modifier 59 if performed on distinct body regions — document each service separately" },
  { col1: "97140", col2: "97012", mod59Allowed: true,  message: "Manual therapy (97140) and traction (97012) billed same day", fix: "Add modifier 59 to 97012; document as a distinct service applied to a separate region" },
  { col1: "97035", col2: "97140", mod59Allowed: true,  message: "Ultrasound (97035) and manual therapy (97140) bundled by some payers", fix: "Add modifier 59 to 97035 if applied to a different area than the manual therapy" },
  // ECG components — never split a complete service
  { col1: "93000", col2: "93005", mod59Allowed: false, message: "93000 (complete ECG) already includes 93005 (tracing only)", fix: "Remove 93005 — it is a component of 93000 and will be denied as unbundled" },
  { col1: "93000", col2: "93010", mod59Allowed: false, message: "93000 (complete ECG) already includes 93010 (interpretation only)", fix: "Remove 93010 — it is a component of 93000 and will be denied as unbundled" },
  // Colonoscopy — more specific code replaces less specific
  { col1: "45380", col2: "45378", mod59Allowed: false, message: "45380 (colonoscopy with biopsy) replaces 45378 (diagnostic colonoscopy)", fix: "Remove 45378 — 45380 is the correct code when a biopsy is taken during the same session" },
  { col1: "45385", col2: "45378", mod59Allowed: false, message: "45385 (colonoscopy with polypectomy) replaces 45378 (diagnostic colonoscopy)", fix: "Remove 45378 — 45385 is the correct code when a polypectomy is performed" },
  { col1: "45385", col2: "45380", mod59Allowed: true,  message: "Polypectomy (45385) and biopsy (45380) on same colonoscopy session", fix: "Use modifier 59 on 45380 only if performed on a distinctly different polyp/lesion — document each site" },
  // Biopsy types
  { col1: "11104", col2: "11102", mod59Allowed: true,  message: "Punch biopsy (11104) and shave biopsy (11102) billed same day", fix: "Add modifier 59 to 11102 if taken from a different lesion — cannot bill both for the same lesion" },
  // Joint injection — complete vs component
  { col1: "20610", col2: "20600", mod59Allowed: true,  message: "Major joint injection (20610) and small joint injection (20600) billed same day", fix: "Add modifier 59 if performed on different anatomic joints — cannot bill both for the same joint" },
]

export function checkNcciBundling(cptCodes: string[]): ScrubIssue[] {
  const issues: ScrubIssue[] = []
  const codeSet = new Set(cptCodes)

  // Duplicate code check
  const duplicates = cptCodes.filter((c, i) => cptCodes.indexOf(c) !== i)
  if (duplicates.length > 0) {
    issues.push({ severity: "warning", message: `Duplicate CPT code(s): ${[...new Set(duplicates)].join(", ")}`, fix: "Remove duplicate codes — billing the same CPT twice on the same claim date requires unusual documentation and will likely be denied" })
  }

  // NCCI pair checks
  for (const pair of NCCI_PAIRS) {
    if (codeSet.has(pair.col1) && codeSet.has(pair.col2)) {
      if (pair.mod59Allowed) {
        issues.push({ severity: "warning", message: pair.message, fix: pair.fix })
      } else {
        issues.push({ severity: "error", message: pair.message, fix: pair.fix })
      }
    }
  }

  // E&M + same-day procedure: E&M must have modifier 25
  const emCodes = new Set(["99202","99203","99204","99205","99211","99212","99213","99214","99215"])
  const procedureCodes = cptCodes.filter(c => !emCodes.has(c) && c !== "" && !/^9[0-9]{3}[0-9]$/.test(c) && parseInt(c) < 90000)
  const emCodesPresent = cptCodes.filter(c => emCodes.has(c))
  if (emCodesPresent.length > 0 && procedureCodes.length > 0) {
    issues.push({ severity: "warning", message: `E&M (${emCodesPresent.join(", ")}) billed same day as procedure code(s) — modifier 25 required on the E&M`, fix: "Add modifier 25 to the E&M code to indicate a separate, significant, identifiable evaluation on the same day as the procedure" })
  }

  // E&M + standalone psychotherapy: should use add-on codes
  const psychCodes = new Set(["90832","90834","90837"])
  const addOnPsych = new Set(["90833","90836","90838"])
  const hasStandaloneEm = emCodesPresent.length > 0
  const hasStandalonePsych = cptCodes.some(c => psychCodes.has(c))
  const hasAddOn = cptCodes.some(c => addOnPsych.has(c))
  if (hasStandaloneEm && hasStandalonePsych && !hasAddOn) {
    issues.push({ severity: "warning", message: "E&M and standalone psychotherapy billed together without add-on code", fix: "Use the add-on psychotherapy codes with E&M: +90833 (30 min), +90836 (45 min), or +90838 (60 min) — billing 90832/90834/90837 alongside an E&M may be denied as duplicative" })
  }

  return issues
}

// ─── ICD-10 / CPT Alignment Check ─────────────────────────────────────────────

// Maps specialty → ICD-10 chapter letter prefixes that should appear for that specialty
const SPECIALTY_DX_CHAPTERS: Partial<Record<string, string[]>> = {
  behavioral_health:    ["F", "R0", "R1", "R3", "R4", "R5", "Z13.3", "Z65"],
  physical_therapy:     ["M", "S", "T", "G", "Z87", "Z96"],
  chiropractic:         ["M", "S", "T"],
  cardiology:           ["I", "R0", "Q"],
  gastroenterology:     ["K", "C18", "C19", "C20", "D12", "Z12.1"],
  dermatology:          ["L", "C44", "D22", "D23", "B", "Z12.8"],
  neurology:            ["G", "R51", "R55", "R56", "I6"],
  obgyn:                ["O", "N", "Z3", "Z34", "Z36"],
  urology:              ["N", "C6", "R30", "R31", "R33"],
  endocrinology:        ["E", "Z13.2"],
  rheumatology:         ["M", "L9"],
  optometry:            ["H"],
  allergy:              ["J", "L", "T78"],
  podiatry:             ["M", "L", "S", "E1"],
}

function detectSpecialtyFromCpts(cptCodes: string[]): string | null {
  for (const code of cptCodes) {
    const n = parseInt(code, 10)
    if (isNaN(n)) continue
    if (n >= 90785 && n <= 90899) return "behavioral_health"
    if (n >= 96130 && n <= 96139) return "behavioral_health"
    if (n >= 97110 && n <= 97799) return "physical_therapy"
    if (n >= 98940 && n <= 98943) return "chiropractic"
    if (n >= 92521 && n <= 92700) return "speech_language"
    if (n >= 92002 && n <= 92499) return "optometry"
    if (n >= 93000 && n <= 93799) return "cardiology"
    if (n >= 95004 && n <= 95199) return "allergy"
    if (n >= 95812 && n <= 95999) return "neurology"
    if ((n >= 11055 && n <= 11765) || n === 64455 || (n >= 28000 && n <= 28899)) return "podiatry"
    if ((n >= 11100 && n <= 11107) || (n >= 17000 && n <= 17999)) return "dermatology"
    if (n >= 43200 && n <= 45999) return "gastroenterology"
    if (n >= 57000 && n <= 59999) return "obgyn"
    if (n >= 20600 && n <= 29999) return "orthopedics"
    if (n >= 51700 && n <= 55706) return "urology"
    if (n === 95250 || n === 77080 || n === 76536) return "endocrinology"
    if (n >= 96365 && n <= 96417) return "rheumatology"
  }
  return null
}

export function checkDxCptAlignment(cptCodes: string[], icd10Codes: string[]): ScrubIssue[] {
  const issues: ScrubIssue[] = []
  const specialty = detectSpecialtyFromCpts(cptCodes)
  if (!specialty) return issues
  const expectedChapters = SPECIALTY_DX_CHAPTERS[specialty]
  if (!expectedChapters) return issues

  const normalizedDx = icd10Codes.map(c => c.toUpperCase())
  const hasExpectedDx = expectedChapters.some(prefix =>
    normalizedDx.some(dx => dx.startsWith(prefix.toUpperCase()))
  )

  if (!hasExpectedDx) {
    const specialtyLabels: Record<string, string> = {
      behavioral_health: "behavioral health (F-codes)", physical_therapy: "musculoskeletal/neurological (M, S, G-codes)",
      chiropractic: "musculoskeletal/spinal (M, S-codes)", cardiology: "circulatory (I-codes)",
      gastroenterology: "digestive (K-codes)", dermatology: "skin (L-codes)", neurology: "neurological (G-codes)",
      obgyn: "obstetric/gynecologic (O, N-codes)", urology: "genitourinary (N-codes)",
      endocrinology: "endocrine (E-codes)", rheumatology: "musculoskeletal (M-codes)",
      optometry: "eye disorders (H-codes)", allergy: "respiratory/allergy (J, L-codes)",
      podiatry: "foot/skin/injury (M, L, S-codes)",
    }
    const label = specialtyLabels[specialty] ?? specialty
    issues.push({
      severity: "warning",
      message: `Diagnosis codes may not support the specialty billed — no ${label} ICD-10 found`,
      fix: `Review diagnosis codes: the CPT codes suggest ${specialty.replace(/_/g, " ")} services but the ICD-10 codes don't include expected diagnoses for this specialty. This mismatch is a common denial trigger.`,
    })
  }

  return issues
}

// ─── Multi-Line Scrub ─────────────────────────────────────────────────────────

export async function multiLineScrub(input: MultiLineScrubInput): Promise<ScrubResult> {
  const { lineItems, icd10Codes, payerName, serviceDate } = input
  const cptCodes = lineItems.map(l => l.cptCode)
  const issues: ScrubIssue[] = []

  // Run all cross-code checks
  issues.push(...checkNcciBundling(cptCodes))
  issues.push(...checkDxCptAlignment(cptCodes, icd10Codes))

  // Run single-line checks for each line item
  for (const line of lineItems) {
    const lineResult = basicScrub({ cptCode: line.cptCode, icd10Codes, modifier: line.modifier, charge: line.charge ?? 0 })
    // Deduplicate: skip issues that multi-line already caught
    for (const issue of lineResult.issues) {
      if (!issues.some(i => i.message === issue.message)) {
        issues.push(issue)
      }
    }
  }

  // Optionally deepen with AI if configured
  if (isAIConfigured() && lineItems.length > 0) {
    const prompt = `You are a medical billing expert. Review this multi-line claim for denial risk.

CPT Codes: ${cptCodes.join(", ")} (modifiers: ${lineItems.map(l => `${l.cptCode}${l.modifier ? "/" + l.modifier : ""}`).join(", ")})
ICD-10 Codes: ${icd10Codes.join(", ")}
Payer: ${payerName ?? "unknown"}
Service Date: ${serviceDate ?? "not provided"}
Charges: ${lineItems.map(l => l.charge != null ? `${l.cptCode}=$${l.charge}` : null).filter(Boolean).join(", ") || "not provided"}

Focus only on cross-line issues not already checked: bundling edits, mutually exclusive codes, total charge reasonableness, missing modifiers across lines, or payer-specific multi-code policies.

Respond ONLY with valid JSON:
{ "issues": [{ "severity": "error"|"warning"|"info", "message": "...", "fix": "..." }] }`

    try {
      const raw = await aiComplete({ max_tokens: 512, messages: [{ role: "user", content: prompt }] })
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as { issues?: ScrubIssue[] }
        for (const issue of parsed.issues ?? []) {
          if (!issues.some(i => i.message === issue.message)) issues.push(issue)
        }
      }
    } catch { /* non-fatal */ }
  }

  const score = Math.max(0,
    100
    - issues.filter(i => i.severity === "error").length * 30
    - issues.filter(i => i.severity === "warning").length * 12
    - issues.filter(i => i.severity === "info").length * 3
  )

  return {
    score,
    verdict: score >= 85 ? "clean" : score >= 60 ? "caution" : "warning",
    issues,
    summary: issues.length === 0
      ? `All ${lineItems.length} line item${lineItems.length > 1 ? "s" : ""} look clean.`
      : `${issues.length} issue${issues.length > 1 ? "s" : ""} found across ${lineItems.length} line item${lineItems.length > 1 ? "s" : ""} — review before submitting.`,
  }
}
