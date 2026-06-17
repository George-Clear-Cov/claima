import { aiComplete, isAIConfigured } from "./ai"
import { classifyDenial } from "./denial-codes"

interface AppealContext {
  patientName: string
  patientDob: string
  memberId: string
  payerName: string
  claimId: string
  serviceDate: string
  cptCodes: string[]
  icd10Codes: string[]
  totalCharge: number
  carcCode: string
  denialReason: string
  providerName: string
  providerNpi: string
  practiceName: string
}

export async function generateAppealLetter(ctx: AppealContext): Promise<string> {
  const denial = classifyDenial(ctx.carcCode)

  if (!isAIConfigured()) {
    return generateTemplateAppeal(ctx, denial.action)
  }

  const prompt = `You are a medical billing specialist writing an insurance appeal letter for a denied mental health claim.

Write a professional, persuasive appeal letter using the following claim details:

Patient: ${ctx.patientName} (DOB: ${ctx.patientDob})
Member ID: ${ctx.memberId}
Payer: ${ctx.payerName}
Claim ID: ${ctx.claimId}
Service Date: ${ctx.serviceDate}
Provider: ${ctx.providerName}, NPI ${ctx.providerNpi}
Practice: ${ctx.practiceName}
CPT Codes: ${ctx.cptCodes.join(", ")}
ICD-10 Codes: ${ctx.icd10Codes.join(", ")}
Total Charge: $${ctx.totalCharge.toFixed(2)}
Denial Reason (CARC ${ctx.carcCode}): ${ctx.denialReason}
Recommended Action: ${denial.action}

Requirements:
- Professional business letter format
- Reference the specific denial reason and why it should be overturned
- Cite medical necessity based on the diagnosis codes
- Reference mental health parity laws (Mental Health Parity and Addiction Equity Act) where applicable
- Request a response within 30 days
- Include placeholders for [SIGNATURE] and [DATE]

Write only the letter body, no explanations.`

  const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
  return text || generateTemplateAppeal(ctx, denial.action)
}

function generateTemplateAppeal(ctx: AppealContext, action: string): string {
  return `[DATE]

Appeals Department
${ctx.payerName}

RE: Appeal of Denied Claim
Patient: ${ctx.patientName}
Member ID: ${ctx.memberId}
Claim ID: ${ctx.claimId}
Date of Service: ${ctx.serviceDate}
CPT Code(s): ${ctx.cptCodes.join(", ")}
Diagnosis Code(s): ${ctx.icd10Codes.join(", ")}
Total Charge: $${ctx.totalCharge.toFixed(2)}

To Whom It May Concern:

I am writing to formally appeal the denial of the above-referenced claim for mental health services provided to ${ctx.patientName} on ${ctx.serviceDate} by ${ctx.providerName} (NPI: ${ctx.providerNpi}) at ${ctx.practiceName}.

The claim was denied with reason code CARC-${ctx.carcCode}: "${ctx.denialReason}". We respectfully disagree with this determination and request that you reconsider based on the following:

1. MEDICAL NECESSITY
The services billed under CPT code(s) ${ctx.cptCodes.join(", ")} were medically necessary for the treatment of the patient's documented diagnoses (${ctx.icd10Codes.join(", ")}). The treating clinician determined these services were clinically appropriate and consistent with evidence-based treatment guidelines.

2. MENTAL HEALTH PARITY
Pursuant to the Mental Health Parity and Addiction Equity Act (MHPAEA), mental health benefits must be provided at parity with medical/surgical benefits. Denial of these services on grounds that would not apply to analogous medical services constitutes a parity violation.

3. PLAN COVERAGE
The patient's plan was active at the time of service and covers mental health treatment. The services rendered fall within the scope of covered benefits.

Recommended action: ${action}

We respectfully request:
- Immediate reconsideration and reversal of this denial
- Payment of $${ctx.totalCharge.toFixed(2)} per the contracted fee schedule
- Written response within 30 days

If you require additional clinical documentation or a peer-to-peer review, please contact our office immediately. We are committed to resolving this matter promptly on behalf of our patient.

Sincerely,

[SIGNATURE]
${ctx.providerName}, ${ctx.practiceName}
NPI: ${ctx.providerNpi}`
}
