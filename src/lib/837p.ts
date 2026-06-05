/**
 * Generates an 837P (Professional Claims) EDI X12 transaction set.
 * Spec: ASC X12 005010X222A2
 */

import { v4 as uuidv4 } from "uuid"

interface Practice {
  npi: string
  taxId: string
  name: string
  taxonomy: string
  addressLine1: string
  city: string
  state: string
  zip: string
  phone: string
}

interface Provider {
  npi: string
  firstName: string
  lastName: string
  taxonomy: string
}

interface Patient {
  memberId: string
  groupNumber?: string
  firstName: string
  lastName: string
  dob: Date
  gender: string
  addressLine1: string
  city: string
  state: string
  zip: string
  payerId: string
  payerName: string
}

interface LineItem {
  cptCode: string
  icd10Codes: string[]
  modifier?: string
  units: number
  chargeAmount: number
}

interface ClaimData {
  practice: Practice
  provider: Provider
  patient: Patient
  serviceDate: Date
  lineItems: LineItem[]
  totalCharge: number
}

function pad(s: string, len: number) {
  return s.padEnd(len).slice(0, len)
}

function ediDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

function ediTime() {
  return new Date().toISOString().slice(11, 16).replace(":", "")
}

function genderCode(g: string) {
  return g.toUpperCase() === "M" ? "M" : g.toUpperCase() === "F" ? "F" : "U"
}

export function generate837P(data: ClaimData): string {
  const icn = uuidv4().replace(/-/g, "").slice(0, 9).toUpperCase()
  const today = new Date()
  const segments: string[] = []

  // ISA - Interchange Control Header
  segments.push(
    `ISA*00*          *00*          *ZZ*${pad(data.practice.npi, 15)}*ZZ*${pad(data.patient.payerId, 15)}*${ediDate(today).slice(2)}*${ediTime()}*^*00501*${icn}*0*P*:`
  )

  // GS - Functional Group Header
  segments.push(
    `GS*HC*${data.practice.npi}*${data.patient.payerId}*${ediDate(today)}*${ediTime()}*1*X*005010X222A2`
  )

  // ST - Transaction Set Header
  segments.push(`ST*837*0001*005010X222A2`)

  // BPR - Beginning of Hierarchical Transaction
  segments.push(`BHT*0019*00*${icn}*${ediDate(today)}*${ediTime()}*CH`)

  // NM1 - Submitter (practice)
  segments.push(
    `NM1*41*2*${data.practice.name}*****46*${data.practice.npi}`
  )
  segments.push(`PER*IC*BILLING*TE*${data.practice.phone}`)

  // NM1 - Receiver (payer)
  segments.push(
    `NM1*40*2*${data.patient.payerName}*****46*${data.patient.payerId}`
  )

  // HL - Billing Provider Hierarchical Level
  segments.push(`HL*1**20*1`)
  segments.push(
    `NM1*85*2*${data.practice.name}*****XX*${data.practice.npi}`
  )
  segments.push(`N3*${data.practice.addressLine1}`)
  segments.push(`N4*${data.practice.city}*${data.practice.state}*${data.practice.zip}`)
  segments.push(`REF*EI*${data.practice.taxId}`)
  segments.push(`PRV*BI*PXC*${data.practice.taxonomy}`)

  // HL - Subscriber (patient as subscriber for simplicity)
  segments.push(`HL*2*1*22*0`)
  segments.push(`SBR*P*18*${data.patient.groupNumber || ""}*${data.patient.payerName}*****CI`)

  // NM1 - Subscriber
  segments.push(
    `NM1*IL*1*${data.patient.lastName}*${data.patient.firstName}****MI*${data.patient.memberId}`
  )
  segments.push(`N3*${data.patient.addressLine1}`)
  segments.push(`N4*${data.patient.city}*${data.patient.state}*${data.patient.zip}`)
  segments.push(`DMG*D8*${ediDate(data.patient.dob)}*${genderCode(data.patient.gender)}`)

  // NM1 - Payer
  segments.push(
    `NM1*PR*2*${data.patient.payerName}*****PI*${data.patient.payerId}`
  )

  // CLM - Claim Information
  const claimId = uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()
  segments.push(
    `CLM*${claimId}*${data.totalCharge.toFixed(2)}***11:B:1*Y*A*Y*I`
  )

  // DTP - Service Date
  segments.push(`DTP*472*D8*${ediDate(data.serviceDate)}`)

  // NM1 - Rendering Provider
  segments.push(
    `NM1*82*1*${data.provider.lastName}*${data.provider.firstName}****XX*${data.provider.npi}`
  )
  segments.push(`PRV*PE*PXC*${data.provider.taxonomy}`)

  // LX + SV1 - Service Lines
  data.lineItems.forEach((item, idx) => {
    segments.push(`LX*${idx + 1}`)

    const diagPointers = item.icd10Codes
      .slice(0, 4)
      .map((_, i) => String.fromCharCode(65 + i))
      .join(":")

    const cptWithMod = item.modifier
      ? `HC:${item.cptCode}:${item.modifier}`
      : `HC:${item.cptCode}`

    segments.push(
      `SV1*${cptWithMod}*${item.chargeAmount.toFixed(2)}*UN*${item.units}***${diagPointers}`
    )
    segments.push(`DTP*472*D8*${ediDate(data.serviceDate)}`)
  })

  // Diagnosis codes (HI segment)
  const diagCodes = [
    ...new Set(data.lineItems.flatMap((l) => l.icd10Codes)),
  ].slice(0, 12)
  if (diagCodes.length > 0) {
    const hiCodes = diagCodes.map((c) => `ABK:${c.replace(".", "")}`).join("*")
    // Insert HI after CLM — rebuild by finding CLM position
    const clmIdx = segments.findIndex((s) => s.startsWith("CLM*"))
    segments.splice(clmIdx + 2, 0, `HI*${hiCodes}`)
  }

  // SE - Transaction Set Trailer
  const segCount = segments.length - 2 + 1 // exclude ISA/GS, +1 for SE itself
  segments.push(`SE*${segCount}*0001`)

  // GE - Functional Group Trailer
  segments.push(`GE*1*1`)

  // IEA - Interchange Control Trailer
  segments.push(`IEA*1*${icn}`)

  return segments.join("\n") + "\n"
}
