import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSessionFromRequest } from "@/lib/auth"
import { taxonomyToSpecialtyLabel } from "@/lib/specialty"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isAIConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY required" }, { status: 503 })

  const { text, patients, providers } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  // Fetch practice taxonomy for specialty context
  let practiceSpecialtyLabel = ""
  try {
    const { prisma } = await import("@/lib/prisma")
    const practice = await prisma.practice.findUnique({ where: { id: session.practiceId }, select: { taxonomy: true } })
    if (practice?.taxonomy) practiceSpecialtyLabel = taxonomyToSpecialtyLabel(practice.taxonomy)
  } catch { /* non-fatal */ }

  const specialtyContext = practiceSpecialtyLabel
    ? `\nPRACTICE SPECIALTY: ${practiceSpecialtyLabel} — when the description is ambiguous, bias toward ${practiceSpecialtyLabel} CPT codes.\n`
    : ""

  const { CPT_CHARGE_MASTER } = await import("@/lib/specialty")
  const chargeHints = Object.entries(CPT_CHARGE_MASTER).slice(0, 40).map(([c, v]) => `${c}=$${v}`).join(", ")

  const prompt = `You are a medical billing intake system. Extract structured claim data from a brief description of a clinical service. You cover all outpatient specialties.${specialtyContext}

Service description: "${text}"
Today's date: ${today}

Available patients (match by name):
${(patients as { id: string; firstName: string; lastName: string; payerName: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | ${p.payerName}`).join("\n")}

Available providers (match by name):
${(providers as { id: string; firstName: string; lastName: string; npi: string }[]).map((p) => `  ${p.id} | ${p.firstName} ${p.lastName} | NPI ${p.npi}`).join("\n")}

SPECIALTY DETECTION + CPT SELECTION — use clinical keywords to identify specialty, then pick the best code:

E&M (all specialties): 99213 (low/15-20 min), 99214 (moderate/30 min), 99215 (high/40+ min); new pt add 1 digit (99203/99204/99205)
Preventive: 99395/99385 (adult 18-39), 99396/99386 (40-64), G0438/G0439 (Medicare AWV)
Pediatric well visit: 99382-99384 (new), 99392-99394 (est); 99460 (newborn)

Behavioral health intake/eval: 90791; therapy 30/45/60 min: 90832/90834/90837; crisis: 90839; family w/ pt: 90847; group: 90853
PT eval: 97162 (moderate); PT treatment: 97110/97140/97530 (per 15 min unit)
OT eval: 97166 (moderate); OT treatment: 97530/97535
SLP eval: 92523; SLP treatment: 92507; swallowing: 92526
Chiropractic: 98941 (3-4 regions most common); add modifier AT for Medicare
ECG: 93000; Echo: 93306; Stress test: 93015; Holter: 93224
EEG: 95816; EMG: 95860; NCS: 95907-95912; Sleep study lab: 95810; HSAT: 95806
Colonoscopy: 45380 (w/ biopsy), G0105/G0121 (Medicare screening); EGD: 43239
Skin biopsy: 11104 (punch); destroy premalignant: 17000; destroy benign: 17110; I&D: 10060
Joint injection: 20610 (major — knee/shoulder/hip), 20605 (intermediate — wrist/ankle), 20600 (small)
Fracture: 25600 (distal radius); splint: 29125 (short arm), 29515 (short leg)
Nail debridement: 11720; plantar fascia injection: 64455; bunionectomy: 28292
Eye exam new pt: 92004; est pt: 92014; visual fields: 92083; OCT: 92134
Allergy tests: 95004; immunotherapy shot: 95115/95117
CGM professional: 95250; DXA bone density: 77080; thyroid US: 76536
IV infusion biologics: 96365 (1st hr) + 96366 (add-on hrs)
Cystoscopy: 52000; prostate biopsy: 55700; catheter: 51702
IUD insertion: 58300; colposcopy w/ biopsy: 57454; Pap: 88142; OB US: 76805

CHARGE MASTER (use these exact amounts when CPT matches): ${chargeHints}

MODIFIERS: 95 or GT (telehealth), 25 (E&M + same-day procedure), AT (chiro Medicare), 59 (distinct service)

Select the most accurate ICD-10 code(s) for any diagnoses, conditions, or symptoms mentioned.

Respond ONLY with valid JSON:
{
  "patientId": "<exact ID from list above, null if no match>",
  "providerId": "<exact ID from list above, null if no match>",
  "cptCode": "<most appropriate CPT code>",
  "icd10Codes": ["<most specific ICD-10 code(s)>"],
  "modifier": "<modifier or ''>",
  "serviceDate": "<YYYY-MM-DD>",
  "chargeAmount": <number — typical market rate for this service>,
  "confidence": <0-100>,
  "explanation": "<one sentence: specialty detected, code selected, and why>"
}`

  try {
    const raw = await aiComplete({ max_tokens: 512, tier: "fast", label: "parse-natural", messages: [{ role: "user", content: prompt }] })
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: "Parse failed", confidence: 0 }, { status: 422 })
  }
}
