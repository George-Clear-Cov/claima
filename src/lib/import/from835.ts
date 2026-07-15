/**
 * 835 (remittance/ERA) backlog adapter — turns raw X12 835 files into normalized
 * ImportedRecords. This is the richest denial source: CLP02="4" flags a denial, and the CARC
 * codes (claim-level + service-line CAS segments) explain why. Reuses the audited parser in
 * ../x12-835.ts, which runs zero-dependency and already handles delimiter drift.
 */
import { parse835Files, type Remittance835, type ClaimPayment } from "../x12-835"
import type { ImportedRecord, ImportParseResult } from "./types"

function ymd(yyyymmdd?: string): string | undefined {
  if (!yyyymmdd || yyyymmdd.length < 8) return undefined
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

// CLP02: 1/2/3 = paid primary/secondary/tertiary, 4 = denied, 22 = reversal.
function statusOf(clp02: string): ImportedRecord["status"] {
  if (clp02 === "4") return "denied"
  if (clp02 === "1" || clp02 === "2" || clp02 === "3") return "paid"
  return "open"
}

function recordFromClaim(remit: Remittance835, c: ClaimPayment): ImportedRecord {
  // CARC codes: claim-level adjustments first, then each service line's.
  const carcCodes = [
    ...c.adjustments.map((a) => a.reason),
    ...c.lines.flatMap((l) => l.adjustments.map((a) => a.reason)),
  ].filter(Boolean)

  // x12-835 builds patientName as "First Last" (NM104 then NM103).
  const nameParts = (c.patientName ?? "").trim().split(/\s+/).filter(Boolean)

  const warnings: string[] = []
  if (!c.patientMemberId) warnings.push("no member ID on the remittance")
  // 835s carry no DOB/address — demographics will be placeholders until enriched.
  warnings.push("demographics (DOB/address) not in 835 — will be stubbed, enrich via CSV")

  return {
    externalClaimId: c.claimId || undefined,
    payerClaimControlNumber: c.payerClaimControlNumber,
    patientFirstName: nameParts[0],
    patientLastName: nameParts.slice(1).join(" ") || undefined,
    patientMemberId: c.patientMemberId,
    payerId: remit.payerId,
    payerName: remit.payerName,
    providerNpi: remit.payeeNpi, // billing NPI (rendering NPI isn't reliably in the 835)
    serviceDate: ymd(c.serviceDateFrom) ?? ymd(c.lines[0]?.serviceDate),
    lines: c.lines.map((l) => ({
      cptCode: l.cpt,
      modifiers: l.modifiers.length ? l.modifiers : undefined,
      units: l.units,
      charge: l.charge,
      paid: l.paid,
    })),
    totalCharge: c.totalCharge,
    totalPaid: c.totalPaid,
    status: statusOf(c.status),
    carcCodes: carcCodes.length ? carcCodes : undefined,
    patientResponsibility: c.patientResponsibility || undefined,
    warnings,
  }
}

export function parse835Backlog(contents: string[]): ImportParseResult {
  const remits = parse835Files(contents)
  const records = remits.flatMap((remit) => remit.claims.map((c) => recordFromClaim(remit, c)))
  const warnings: string[] = []
  if (records.length === 0) warnings.push("No claims found in the 835 file(s) — is this a valid remittance?")
  return { format: "835", records, warnings }
}
