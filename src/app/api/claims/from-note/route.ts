import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSessionFromRequest } from "@/lib/auth"
import { taxonomyToSpecialtyLabel } from "@/lib/specialty"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAIConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY required" }, { status: 503 })

  const { note, patients, providers } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: "note required" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  // Fetch practice taxonomy for specialty context
  let practiceSpecialtyLabel = ""
  try {
    const { prisma } = await import("@/lib/prisma")
    const practice = await prisma.practice.findUnique({ where: { id: session.practiceId }, select: { taxonomy: true } })
    if (practice?.taxonomy) practiceSpecialtyLabel = taxonomyToSpecialtyLabel(practice.taxonomy)
  } catch { /* non-fatal */ }

  const { CPT_CHARGE_MASTER } = await import("@/lib/specialty")

  const specialtyContext = practiceSpecialtyLabel
    ? `\nPRACTICE SPECIALTY: ${practiceSpecialtyLabel} — prioritize ${practiceSpecialtyLabel} CPT codes and diagnoses when the note is ambiguous.\n`
    : ""

  // Top 40 most common CPT charges for quick AI reference
  const chargeHints = Object.entries(CPT_CHARGE_MASTER).slice(0, 40).map(([c, v]) => `${c}=$${v}`).join(", ")

  const prompt = `You are a medical billing specialist reviewing a clinical session note for insurance claim submission. You cover all outpatient specialties.${specialtyContext}

SESSION NOTE:
"""
${note}
"""

Today: ${today}

Available patients (match by name — first, last, or nickname):
${(patients as { id: string; firstName: string; lastName: string; payerName: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | ${p.payerName}`).join("\n") || "  (none — set patientId to null)"}

Available providers:
${(providers as { id: string; firstName: string; lastName: string; npi: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | NPI ${p.npi}`).join("\n") || "  (none — set providerId to null)"}

CPT SELECTION GUIDE — identify the specialty from clinical keywords, then select the correct code:

GENERAL E&M (all specialties): 99202-99205 (new pt), 99211-99215 (est pt) — select by complexity/MDM
PREVENTIVE: 99385/99395 (18-39), 99386/99396 (40-64), G0438/G0439 (Medicare AWV)
PEDIATRIC PREVENTIVE: 99381-99384 (new), 99391-99394 (est), 99460 (newborn); add 96110 for developmental screening

BEHAVIORAL HEALTH (psychiatry, psychology, counseling, social work):
  Intake: 90791 (diagnostic eval), 90792 (with medical — MD/NP only)
  Therapy: 90832 (30 min), 90834 (45 min), 90837 (60 min), 90839 (crisis first 60 min), +90840 (crisis add-on 30 min)
  Add-ons to E&M: +90833 (30 min), +90836 (45 min), +90838 (60 min)
  Family: 90847 (with pt), 90846 (without pt); Group: 90853
  Psych testing: 96130 (eval 1st hr), 96136 (admin 1st 30 min)

PHYSICAL THERAPY: 97161-97163 (eval by complexity), 97164 (re-eval)
  Treatment (15-min units): 97110 (therapeutic exercise), 97140 (manual therapy), 97530 (therapeutic activities)
  Other: 97012 (traction), 97014 (e-stim unattended), 97116 (gait training), 97035 (ultrasound)

OCCUPATIONAL THERAPY: 97165-97167 (eval), 97168 (re-eval)
  Treatment: 97110 (exercise), 97530 (activities), 97535 (self-care training), 97129 (cognitive, 1st 15 min)

SPEECH-LANGUAGE PATHOLOGY: 92521-92524 (evals), 92610 (swallowing eval)
  Treatment: 92507 (individual), 92508 (group), 92526 (swallowing)

CHIROPRACTIC: 98940 (1-2 spinal regions), 98941 (3-4 regions), 98942 (5 regions), 98943 (extraspinal)
  IMPORTANT: Add modifier AT (active treatment) — required for Medicare coverage

CARDIOLOGY: 93000 (ECG with interp), 93306 (echo 2D+Doppler), 93308 (echo limited), 93015 (stress test complete)
  Holter: 93224 (24 hr); Vascular: 93880 (carotid bilateral), 93970 (venous bilateral)

NEUROLOGY: 95816 (EEG awake/drowsy), 95819 (EEG awake/asleep)
  EMG/NCS: 95860 (EMG 1 extremity), 95907 (NCS 1-2 studies), 95908 (NCS 3-4 studies)
  Sleep: 95806 (HSAT home), 95810 (PSG lab 6+ hrs)

GASTROENTEROLOGY: 45378 (colonoscopy diagnostic), 45380 (w/ biopsy), 45385 (w/ polypectomy)
  EGD: 43239 (w/ biopsy), 43251 (lesion removal)
  Medicare screening: G0105 (high risk), G0121 (not high risk) — use instead of 45378 for Medicare screening

DERMATOLOGY: 11102 (shave biopsy), 11104 (punch biopsy), 17000 (destroy premalignant, 1st)
  17110 (destroy benign ≤14), 10060 (I&D simple), 10061 (I&D complicated)

ORTHOPEDIC SURGERY: 20610 (major joint injection/asp), 20605 (intermediate joint), 20600 (small joint)
  Fracture: 25600 (distal radius no manip), 25605 (with manip)
  Splints/casts: 29125 (short arm splint), 29515 (short leg splint), 29530 (knee strap), 29540 (ankle strap)

PODIATRY: 11720 (nail debridement ≤5), 11730 (avulsion, single), 11055 (paring, single)
  97597 (wound debridement 1st 20 sq cm), 64455 (plantar fascia injection), 28292 (bunionectomy)

OB/GYN: 58300 (IUD insertion), 58301 (IUD removal), 57454 (colposcopy w/ biopsy), 57461 (LEEP)
  76805 (OB US 14+ wks), 59025 (fetal NST), 88142 (Pap liquid-based), 87624 (HPV high-risk)

OPTOMETRY: 92004 (comprehensive exam, new pt), 92012 (intermediate, est pt), 92014 (comprehensive, est pt)
  92015 (refraction — check payer coverage), 92082/92083 (visual fields), 92134 (OCT/RNFL), 92250 (fundus photo)

ALLERGY: 95004 (percutaneous tests), 95115 (immunotherapy, single), 95117 (immunotherapy 2+), 95165 (1-8 doses)

ENDOCRINOLOGY: 95250 (CGM professional), 95251 (CGM interp), 77080 (DXA axial), 76536 (thyroid US)

RHEUMATOLOGY: 96365 (IV infusion 1st hr), 96366 (each add-on hr), 20610 (major joint injection)

UROLOGY: 52000 (cystoscopy), 52204 (cystoscopy w/ biopsy), 55700 (prostate biopsy), 51702 (catheter insertion)

MODIFIER RULES:
  95 or GT: telehealth (also set telehealth:true)
  25: E&M on same day as procedure (required when both billed)
  AT: chiropractic active treatment (Medicare required)
  59: distinct procedural service (separate body site)

CHARGE MASTER (use these amounts when the CPT matches; otherwise estimate): ${chargeHints}

ICD-10 — include ALL diagnoses, conditions, and symptoms mentioned or implied. Use the most specific code available.

Respond ONLY with valid JSON (no code fences):
{
  "patientId": "<exact ID from list or null>",
  "patientName": "<full name as mentioned in note, or null>",
  "providerId": "<exact ID from list or null>",
  "providerName": "<provider name from note, or null>",
  "serviceDate": "<YYYY-MM-DD — use today if not specified>",
  "sessionDurationMinutes": <integer or null>,
  "cptCode": "<primary CPT code>",
  "additionalCptCodes": ["<add-on CPT codes or empty array>"],
  "icd10Codes": ["<at least one ICD-10 code>"],
  "modifier": "<modifier code or ''>",
  "chargeAmount": <number — use charge master if available, else typical market rate>,
  "telehealth": <true|false>,
  "clinicalSummary": "<1 sentence for billing notes field>",
  "confidence": <0-100>,
  "flags": ["<any compliance, documentation, or prior auth flags>"]
}`

  try {
    const raw = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
    const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")
    return NextResponse.json(JSON.parse(match[0]))
  } catch (err) {
    console.error("[claims/from-note] failed:", err)
    return NextResponse.json({ error: "Note parsing failed" }, { status: 422 })
  }
}
