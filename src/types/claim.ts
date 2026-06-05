export interface ClaimLineInput {
  cptCode: string
  icd10Codes: string[]
  modifier?: string
  units: number
  chargeAmount: number
  description?: string
}

export interface SubmitClaimInput {
  practiceId: string
  providerId: string
  patientId: string
  serviceDate: string
  lineItems: ClaimLineInput[]
}

export interface ClaimSummary {
  id: string
  patientName: string
  providerName: string
  serviceDate: string
  totalCharge: number
  claimStatus: string
  submittedAt: string | null
  denialReason: string | null
  paidAmount: number | null
}

// Common mental health CPT codes for autocomplete
export const COMMON_CPT_CODES = [
  { code: "90791", description: "Psychiatric diagnostic evaluation" },
  { code: "90792", description: "Psychiatric diagnostic eval with medical services" },
  { code: "90832", description: "Psychotherapy, 30 min" },
  { code: "90834", description: "Psychotherapy, 45 min" },
  { code: "90837", description: "Psychotherapy, 60 min" },
  { code: "90839", description: "Psychotherapy for crisis, first 60 min" },
  { code: "90840", description: "Psychotherapy for crisis, each additional 30 min" },
  { code: "90845", description: "Psychoanalysis" },
  { code: "90847", description: "Family psychotherapy with patient present" },
  { code: "90853", description: "Group psychotherapy" },
  { code: "99213", description: "Office visit, established patient, low complexity" },
  { code: "99214", description: "Office visit, established patient, moderate complexity" },
]

// Common mental health ICD-10 codes
export const COMMON_ICD10_CODES = [
  { code: "F32.0", description: "Major depressive disorder, single episode, mild" },
  { code: "F32.1", description: "Major depressive disorder, single episode, moderate" },
  { code: "F32.2", description: "Major depressive disorder, single episode, severe" },
  { code: "F33.0", description: "Major depressive disorder, recurrent, mild" },
  { code: "F33.1", description: "Major depressive disorder, recurrent, moderate" },
  { code: "F41.0", description: "Panic disorder" },
  { code: "F41.1", description: "Generalized anxiety disorder" },
  { code: "F43.10", description: "PTSD, unspecified" },
  { code: "F43.11", description: "PTSD, acute" },
  { code: "F43.12", description: "PTSD, chronic" },
  { code: "F90.0", description: "ADHD, predominantly inattentive" },
  { code: "F90.1", description: "ADHD, predominantly hyperactive" },
  { code: "F90.2", description: "ADHD, combined type" },
]
