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
}

export function classifyDenial(carcCode: string): DenialCategory & { description: string } {
  return (
    CARC_CODES[carcCode] ?? {
      description: `Unknown denial code: ${carcCode}`,
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
