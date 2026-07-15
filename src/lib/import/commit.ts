/**
 * Backlog commit engine — turns normalized ImportedRecords into Patient / Claim / ClaimLine /
 * Denial rows, scoped to one practice. Shared by every format adapter.
 *
 * Design notes (v1 — flagged for review):
 *  - Patients created from an 835 have no DOB/address, so we stub those required fields
 *    ("PENDING"/1900-01-01) and warn — enrich later via a demographics CSV import.
 *  - Imported claims are attributed to one synthetic "Imported Backlog" provider per practice
 *    (a real rendering-NPI mapping is a later step); this avoids NPI-uniqueness collisions.
 *  - Dedup key = patient (memberId or name) + service date + total charge, checked against
 *    existing claims and within the batch, so re-running an import doesn't duplicate.
 *  - dryRun computes the same summary via reads only — no writes — to power the preview.
 */
import type { ImportedRecord, ImportCommitSummary } from "./types"
import { classifyDenial } from "../denial-codes"

function dedupKey(memberId?: string, first?: string, last?: string, serviceDate?: string, totalCharge?: number): string {
  const who = (memberId || `${first ?? ""}-${last ?? ""}`).trim().toLowerCase()
  return [who, serviceDate ?? "", totalCharge ?? ""].join("|")
}

function claimStatusOf(s: ImportedRecord["status"]): "DENIED" | "PAID" | "SUBMITTED" {
  return s === "denied" ? "DENIED" : s === "paid" ? "PAID" : "SUBMITTED"
}

export async function commitImport(
  records: ImportedRecord[],
  practiceId: string,
  opts: { dryRun?: boolean } = {},
): Promise<ImportCommitSummary> {
  const { prisma } = await import("../prisma")
  const dryRun = !!opts.dryRun
  const summary: ImportCommitSummary = {
    dryRun, patientsCreated: 0, providersCreated: 0, claimsCreated: 0, denialsCreated: 0, skipped: 0, warnings: [],
  }

  // ── Dedup set from existing claims ──
  const existing = await prisma.claim.findMany({
    where: { practiceId },
    select: { serviceDate: true, totalCharge: true, patient: { select: { memberId: true, firstName: true, lastName: true } } },
  })
  const seen = new Set<string>()
  for (const e of existing) {
    seen.add(dedupKey(e.patient?.memberId, e.patient?.firstName, e.patient?.lastName, e.serviceDate?.toISOString().slice(0, 10), Number(e.totalCharge)))
  }

  // ── One synthetic "import" provider per practice ──
  const importNpi = `IMPORT-${practiceId}`
  let providerId: string | null = null
  const existingProv = await prisma.provider.findFirst({ where: { practiceId, npi: importNpi }, select: { id: true } })
  if (existingProv) {
    providerId = existingProv.id
  } else if (dryRun) {
    summary.providersCreated++
  } else {
    const created = await prisma.provider.create({
      data: { practiceId, firstName: "Imported", lastName: "Backlog", npi: importNpi, taxonomy: "000000000X" },
      select: { id: true },
    })
    providerId = created.id
    summary.providersCreated++
  }

  // ── Patient cache (existing + created this run) ──
  const patientIds = new Map<string, string>()
  const patients = await prisma.patient.findMany({ where: { practiceId }, select: { id: true, memberId: true, firstName: true, lastName: true } })
  for (const p of patients) {
    if (p.memberId) patientIds.set(p.memberId.toLowerCase(), p.id)
    patientIds.set(`${p.firstName}-${p.lastName}`.toLowerCase(), p.id)
  }
  const patientKey = (r: ImportedRecord) => (r.patientMemberId || `${r.patientFirstName ?? ""}-${r.patientLastName ?? ""}`).toLowerCase()

  for (const r of records) {
    const dkey = dedupKey(r.patientMemberId, r.patientFirstName, r.patientLastName, r.serviceDate, r.totalCharge)
    if (seen.has(dkey)) { summary.skipped++; continue }
    seen.add(dkey)

    // resolve / create patient
    const pkey = patientKey(r)
    let patientId = patientIds.get(pkey) ?? null
    if (!patientId) {
      if (dryRun) {
        patientId = "dry"; patientIds.set(pkey, patientId); summary.patientsCreated++
      } else {
        const p = await prisma.patient.create({
          data: {
            practiceId,
            firstName: r.patientFirstName || "Unknown",
            lastName: r.patientLastName || "Patient",
            dob: r.patientDob ? new Date(r.patientDob) : new Date("1900-01-01"),
            gender: "U",
            memberId: r.patientMemberId || "UNKNOWN",
            payerId: r.payerId || "UNKNOWN",
            payerName: r.payerName || "Unknown Payer",
            addressLine1: "PENDING", city: "PENDING", state: "XX", zip: "00000",
          },
          select: { id: true },
        })
        patientId = p.id; patientIds.set(pkey, patientId); summary.patientsCreated++
      }
    }

    const primaryCarc = r.carcCodes?.[0]
    const classification = primaryCarc ? classifyDenial(primaryCarc) : null
    const denied = r.status === "denied"

    if (dryRun) {
      summary.claimsCreated++
      if (denied) summary.denialsCreated++
      continue
    }

    if (!providerId || !patientId) { summary.warnings.push("could not resolve provider/patient — skipped a record"); summary.skipped++; continue }

    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.claim.create({
          data: {
            practiceId,
            providerId: providerId!,
            patientId: patientId!,
            serviceDate: r.serviceDate ? new Date(r.serviceDate) : new Date("1900-01-01"),
            claimStatus: claimStatusOf(r.status),
            totalCharge: r.totalCharge ?? 0,
            placeOfService: "11",
            ...(r.totalPaid != null ? { paidAmount: r.totalPaid } : {}),
            ...(denied && primaryCarc ? { denialCode: primaryCarc, denialReason: r.denialReason || classification?.description } : {}),
            ...(r.externalClaimId ? { stediClaimId: r.externalClaimId } : {}),
            lineItems: {
              create: r.lines.map((l) => ({
                cptCode: l.cptCode,
                icd10Codes: l.icd10Codes ?? [],
                ...(l.modifiers?.[0] ? { modifier: l.modifiers[0] } : {}),
                units: l.units ?? 1,
                chargeAmount: l.charge ?? 0,
              })),
            },
          },
          select: { id: true },
        })
        summary.claimsCreated++

        if (denied && primaryCarc && classification) {
          await tx.denial.create({
            data: {
              claimId: claim.id,
              carcCode: primaryCarc,
              denialReason: r.denialReason || classification.description,
              category: classification.category,
              priority: classification.priority,
              action: classification.action,
              appealable: classification.appealable,
            },
          })
          summary.denialsCreated++
        }
      })
    } catch (e) {
      summary.warnings.push(`Skipped ${r.externalClaimId ?? r.patientMemberId ?? "a record"}: ${(e as Error).message}`)
    }
  }

  if (summary.patientsCreated > 0)
    summary.warnings.push(`${summary.patientsCreated} patient(s) ${dryRun ? "would be" : ""} created with placeholder demographics — enrich DOB/address via a demographics CSV.`)
  summary.warnings.push("Imported claims are attributed to a placeholder 'Imported Backlog' provider — reassign to real providers before provider-specific appeals.")

  return summary
}
