/**
 * CARC (Claim Adjustment Reason Codes) and RARC (Remittance Advice Remark Codes)
 * These come back on the 835 ERA when a claim is denied or adjusted.
 */

export interface DenialCategory {
  category: "RESUBMIT" | "APPEAL" | "PATIENT_RESPONSIBILITY" | "WRITE_OFF" | "INFO_NEEDED"
  priority: "HIGH" | "MEDIUM" | "LOW"
  action: string
  appealable: boolean
}

export const CARC_CODES: Record<string, { description: string } & DenialCategory> = {
  "1": {
    description: "Deductible amount",
    category: "PATIENT_RESPONSIBILITY",
    priority: "LOW",
    action: "Bill patient for deductible amount",
    appealable: false,
  },
  "2": {
    description: "Coinsurance amount",
    category: "PATIENT_RESPONSIBILITY",
    priority: "LOW",
    action: "Bill patient for coinsurance",
    appealable: false,
  },
  "3": {
    description: "Co-payment amount",
    category: "PATIENT_RESPONSIBILITY",
    priority: "LOW",
    action: "Bill patient for copay",
    appealable: false,
  },
  "4": {
    description: "The service is not covered by this payer/contractor",
    category: "WRITE_OFF",
    priority: "LOW",
    action: "Write off or bill patient if non-covered service agreement signed",
    appealable: false,
  },
  "5": {
    description: "The procedure code/bill type is inconsistent with the place of service",
    category: "RESUBMIT",
    priority: "HIGH",
    action: "Correct place of service code and resubmit",
    appealable: false,
  },
  "11": {
    description: "The diagnosis is inconsistent with the procedure",
    category: "RESUBMIT",
    priority: "HIGH",
    action: "Review and correct diagnosis-procedure link, resubmit",
    appealable: false,
  },
  "16": {
    description: "Claim/service lacks information which is needed for adjudication",
    category: "INFO_NEEDED",
    priority: "HIGH",
    action: "Gather missing information and resubmit with complete data",
    appealable: false,
  },
  "18": {
    description: "Duplicate claim/service",
    category: "WRITE_OFF",
    priority: "LOW",
    action: "Verify if already paid; if not, resubmit with corrected billing",
    appealable: false,
  },
  "22": {
    description: "This care may be covered by another payer per coordination of benefits",
    category: "INFO_NEEDED",
    priority: "HIGH",
    action: "Coordinate benefits — submit to primary payer first",
    appealable: false,
  },
  "27": {
    description: "Expenses incurred after coverage terminated",
    category: "APPEAL",
    priority: "MEDIUM",
    action: "Verify coverage dates; appeal if coverage was active at service",
    appealable: true,
  },
  "29": {
    description: "The time limit for filing has expired",
    category: "WRITE_OFF",
    priority: "LOW",
    action: "Timely filing denial — typically not appealable unless proof of timely filing exists",
    appealable: true,
  },
  "45": {
    description: "Charge exceeds fee schedule/maximum allowable",
    category: "WRITE_OFF",
    priority: "LOW",
    action: "Contractual adjustment — write off difference",
    appealable: false,
  },
  "49": {
    description: "This is a non-covered service because it is a routine/preventive exam",
    category: "APPEAL",
    priority: "MEDIUM",
    action: "Appeal with medical necessity documentation",
    appealable: true,
  },
  "50": {
    description: "These are non-covered services because this is not deemed a medical necessity",
    category: "APPEAL",
    priority: "HIGH",
    action: "Submit appeal with clinical notes and medical necessity letter",
    appealable: true,
  },
  "55": {
    description: "Procedures or services are not covered when performed within the postoperative period",
    category: "APPEAL",
    priority: "MEDIUM",
    action: "Appeal with documentation showing procedure is distinct from surgical episode",
    appealable: true,
  },
  "96": {
    description: "Non-covered charge(s)",
    category: "WRITE_OFF",
    priority: "LOW",
    action: "Write off non-covered charge",
    appealable: false,
  },
  "97": {
    description: "The benefit for this service is included in the payment/allowance for another service",
    category: "RESUBMIT",
    priority: "MEDIUM",
    action: "Review bundling rules; unbundle or correct modifiers and resubmit",
    appealable: true,
  },
  "119": {
    description: "Benefit maximum for this time period or occurrence has been reached",
    category: "PATIENT_RESPONSIBILITY",
    priority: "MEDIUM",
    action: "Notify patient of benefit exhaustion; bill patient",
    appealable: true,
  },
  "151": {
    description: "Payment adjusted because the payer deems the information submitted does not support this many services",
    category: "APPEAL",
    priority: "HIGH",
    action: "Appeal with clinical documentation supporting all units billed",
    appealable: true,
  },
  "170": {
    description: "Payment is denied when performed/billed by this type of provider",
    category: "APPEAL",
    priority: "HIGH",
    action: "Verify provider credentialing; appeal or re-bill under correct provider",
    appealable: true,
  },
  "177": {
    description: "Patient has not met the required eligibility requirements",
    category: "INFO_NEEDED",
    priority: "HIGH",
    action: "Verify patient eligibility at time of service; appeal with proof of coverage",
    appealable: true,
  },
  "197": {
    description: "Precertification/authorization/notification absent",
    category: "APPEAL",
    priority: "HIGH",
    action: "Submit retroactive authorization request or appeal with medical necessity",
    appealable: true,
  },
  "256": {
    description: "Service not payable per managed care contract",
    category: "APPEAL",
    priority: "MEDIUM",
    action: "Review contract terms; appeal if service should be covered",
    appealable: true,
  },
  "15": {
    description: "Authorization number missing, invalid, or does not apply",
    category: "RESUBMIT",
    priority: "HIGH",
    action: "Obtain the auth number from the payer and resubmit with it populated",
    appealable: true,
  },
  "109": {
    description: "Claim/service not covered by this payer/contractor",
    category: "RESUBMIT",
    priority: "HIGH",
    action: "Wrong payer. Verify payer ID and member's active plan, then resubmit to the correct payer",
    appealable: false,
  },
  "167": {
    description: "Diagnosis not covered, missing, or invalid",
    category: "RESUBMIT",
    priority: "MEDIUM",
    action: "Verify the ICD-10 is covered for this CPT and coded to full specificity; correct and resubmit",
    appealable: true,
  },
  "204": {
    description: "Service/equipment/drug not covered under the patient's current benefit plan",
    category: "PATIENT_RESPONSIBILITY",
    priority: "LOW",
    action: "Confirm the benefit exclusion, then bill the patient (ABN/waiver if Medicare)",
    appealable: false,
  },
  "242": {
    description: "Services not provided by network/primary care providers",
    category: "APPEAL",
    priority: "HIGH",
    action:
      "Verify in-network status for the DOS. If the provider was in network, appeal as a " +
      "credentialing/loading error with the executed contract effective date",
    appealable: true,
  },
  "252": {
    description: "An attachment or other documentation is required to adjudicate",
    category: "INFO_NEEDED",
    priority: "HIGH",
    action: "Read the RARC for the specific document requested; submit records with the appeal",
    appealable: true,
  },
}

/**
 * Normalize a CARC to its bare code for lookup. Sources vary: an 835 CAS segment carries the group
 * code (CO/PR/OA/PI/CR) and reason code in separate elements, but some feeds/imports combine them
 * as "CO-45", "CO45", or "PR 1". Strip a leading group-code prefix only when a digit follows, so a
 * bare "45" and RARC-style codes (M1, MA01) are left untouched.
 */
export function normalizeCarc(carcCode: string): string {
  const c = String(carcCode ?? "").trim().toUpperCase()
  const m = c.match(/^(?:CO|PR|OA|PI|CR)[-_\s]?(\d.*)$/)
  return m ? m[1] : c
}

export function classifyDenial(carcCode: string): DenialCategory & { description: string } {
  const code = normalizeCarc(carcCode)
  return (
    CARC_CODES[code] ?? {
      description: `Unknown denial code: ${code}`,
      category: "APPEAL" as const,
      priority: "MEDIUM" as const,
      action: "Review denial reason and determine appropriate action",
      appealable: true,
    }
  )
}

export function getPriorityScore(priority: string): number {
  return { HIGH: 3, MEDIUM: 2, LOW: 1 }[priority] ?? 1
}

/**
 * RARC (Remittance Advice Remark Codes) accompany a CARC on the 835 and carry the specific
 * reason. A CARC says "we need documentation"; the RARC says *which* document. Appeals that
 * ignore the RARC usually get denied a second time for the same reason.
 */
export const RARC_CODES: Record<string, { description: string; action: string }> = {
  M51: { description: "Missing/incomplete/invalid procedure code", action: "Correct the CPT/HCPCS and resubmit" },
  M76: { description: "Missing/incomplete/invalid diagnosis or condition", action: "Correct the ICD-10 to full specificity and resubmit" },
  M127: { description: "Missing patient medical record for this service", action: "Attach the encounter note/operative report and resubmit with the appeal" },
  N30: { description: "Patient ineligible for this service on the date of service", action: "Re-verify eligibility (270/271) for the DOS; rebill correct payer or bill patient" },
  N115: { description: "Decision based on a Local Coverage Determination (LCD)", action: "Pull the LCD and document how the service meets its criteria" },
  N130: { description: "Consult plan benefit documents for limitations", action: "Check plan-level limits (visit caps, frequency); bill patient if exhausted" },
  N180: { description: "Item/service does not meet criteria for the category billed", action: "Re-code to the correct category or appeal with clinical justification" },
  N290: { description: "Missing/incomplete/invalid rendering provider identifier", action: "Populate the rendering provider NPI (loop 2310B) and resubmit" },
  N382: { description: "Missing/incomplete/invalid patient identifier", action: "Correct the member ID against the card/271 and resubmit" },
  N479: { description: "Missing Explanation of Benefits from the primary payer", action: "Attach the primary EOB; this is a COB sequencing issue" },
}

export function classifyRarc(rarcCode: string): { description: string; action: string } | null {
  const c = String(rarcCode ?? "").trim().toUpperCase().replace(/[-_\s]/g, "")
  return RARC_CODES[c] ?? null
}
