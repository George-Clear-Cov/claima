/**
 * 837P (professional claim) backlog adapter — turns raw inbound X12 837P files into normalized
 * ImportedRecords. Unlike the 835, an 837 is the SUBMITTED claim with no remittance, so every
 * record is `status: "open"` and carries no CARC/denial data. One ImportedRecord is emitted per
 * CLM (claim) loop; a single file may hold many claims (multiple HL/CLM loops) and each claim
 * many SV1 service lines.
 *
 * This parser is the inverse of ../837p.ts (the outbound generator, spec 005010X222A2), and real
 * inbound files follow the same segment layout: NM1/SBR/CLM/HI/SV1/DTP/DMG/N3/N4. We reuse the
 * audited X12 tokenizer approach from ../x12-835.ts (delimiter detection + bare ST..SE handling).
 *
 * Zero dependencies and no Node APIs — safe to run in the browser alongside the 835 adapter.
 */
import type { ImportedRecord, ImportedLine, ImportParseResult } from "./types"

// ── Tokenizing (mirrors ../x12-835.ts) ──────────────────────────────────────────

interface Delimiters {
  element: string
  segment: string
  component: string
}

/**
 * The spec fixes ISA at 106 characters, which would make the delimiters positional. Real
 * clearinghouse files drift off that width, so instead we count: ISA always has exactly 16
 * elements, ISA16 is always the single component separator, and the segment terminator is
 * always the character right after it. Falls back to common defaults for bare ST..SE fragments.
 */
function detectDelimiters(raw: string): Delimiters {
  const fallback: Delimiters = { element: "*", component: ":", segment: "~" }
  if (!raw.startsWith("ISA") || raw.length < 4) return fallback

  const element = raw[3]
  let separators = 0
  let i = 3
  while (i < raw.length && separators < 16) {
    if (raw[i] === element) separators++
    i++
  }
  // i now sits on ISA16 (the component separator); the terminator immediately follows.
  if (separators < 16 || i + 1 >= raw.length) return fallback

  return { element, component: raw[i], segment: raw[i + 1] }
}

type Segment = { id: string; el: string[] }

function tokenize(raw: string, d: Delimiters): Segment[] {
  return raw
    .split(d.segment)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(d.element)
      return { id: parts[0].toUpperCase(), el: parts }
    })
}

/** 1-indexed element access matching how the X12 spec names them (CLM01 → at(seg, 1)). */
function at(seg: Segment, i: number): string {
  return seg.el[i] ?? ""
}

function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function ymd(yyyymmdd?: string): string | undefined {
  if (!yyyymmdd || yyyymmdd.length < 8) return undefined
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

// ── Working shapes (mutable while walking segments) ─────────────────────────────

interface WorkingLine {
  cptCode: string
  modifiers: string[]
  units: number
  charge: number
  serviceDate?: string
}

interface WorkingClaim {
  externalClaimId?: string
  totalCharge?: number
  patientLastName?: string
  patientFirstName?: string
  patientMemberId?: string
  patientDob?: string
  payerName?: string
  payerId?: string
  providerNpi?: string
  providerName?: string
  /** Billing-provider fallback (NM1*85) used only when no rendering provider (NM1*82) present. */
  billingNpi?: string
  billingName?: string
  serviceDate?: string
  diagnoses: string[]
  lines: WorkingLine[]
}

function newClaim(): WorkingClaim {
  return { diagnoses: [], lines: [] }
}

/**
 * SV101 is a composite "HC:<cpt>:<mod1>:<mod2>...". The first element is the qualifier (HC),
 * the second the CPT/HCPCS code, the rest are modifiers.
 */
function parseSV101(composite: string, comp: string): { cptCode: string; modifiers: string[] } {
  const parts = composite.split(comp)
  return { cptCode: parts[1] ?? "", modifiers: parts.slice(2).filter(Boolean) }
}

/**
 * HI carries up to 12 diagnosis composites, one per element from HI01 onward. Each is
 * "<qualifier>:<code>", where the qualifier is ABK/BK (primary) or ABF/BF (secondary) for ICD-10.
 * The generator strips the decimal point; we keep whatever the sender emits.
 */
function parseHI(seg: Segment, comp: string): string[] {
  const dxQualifiers = new Set(["ABK", "BK", "ABF", "BF"])
  const out: string[] = []
  for (let i = 1; i < seg.el.length; i++) {
    const parts = at(seg, i).split(comp)
    const qualifier = (parts[0] ?? "").toUpperCase()
    const code = parts[1] ?? ""
    if (code && dxQualifiers.has(qualifier)) out.push(code)
  }
  return out
}

/** Turn a fully-walked WorkingClaim into a normalized ImportedRecord, or null if unusable. */
function finalizeClaim(c: WorkingClaim): ImportedRecord | null {
  // A claim with no identifier and no service lines is noise (e.g. a stray CLM in a malformed loop).
  if (!c.externalClaimId && c.lines.length === 0) return null

  const warnings: string[] = []

  const lines: ImportedLine[] = c.lines.map((l) => ({
    cptCode: l.cptCode,
    modifiers: l.modifiers.length ? l.modifiers : undefined,
    icd10Codes: c.diagnoses.length ? [...c.diagnoses] : undefined,
    units: l.units,
    charge: l.charge,
  }))

  // CLM02 is authoritative; fall back to summing the SV1 line charges when absent.
  const summedCharge = c.lines.reduce((sum, l) => sum + l.charge, 0)
  const totalCharge = c.totalCharge ?? (summedCharge || undefined)

  // Rendering provider (NM1*82) preferred; billing provider (NM1*85) is the fallback.
  const providerNpi = c.providerNpi ?? c.billingNpi
  const providerName = c.providerName ?? c.billingName

  if (lines.length === 0) warnings.push("claim has no service lines (SV1) — charges/CPT missing")
  if (!c.patientMemberId) warnings.push("no subscriber member ID (NM1*IL) on the claim")
  if (!providerNpi) warnings.push("no rendering (NM1*82) or billing (NM1*85) provider NPI")

  // Prefer a per-line service date (DTP*472 inside the SV1 loop); fall back to the claim-level DTP.
  const serviceDate = c.lines.find((l) => l.serviceDate)?.serviceDate ?? c.serviceDate

  return {
    externalClaimId: c.externalClaimId || undefined,
    patientFirstName: c.patientFirstName || undefined,
    patientLastName: c.patientLastName || undefined,
    patientMemberId: c.patientMemberId || undefined,
    patientDob: c.patientDob,
    payerId: c.payerId || undefined,
    payerName: c.payerName || undefined,
    providerNpi: providerNpi || undefined,
    providerName: providerName || undefined,
    serviceDate,
    lines,
    totalCharge,
    // 837 is the submitted claim — no remittance, so it is always open (no paid/denied outcome).
    status: "open",
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * Parse one 837P transaction file into records. NM1 identifiers can appear in two roles:
 * envelope-level (submitter NM1*41, receiver NM1*40) and claim-level. We only key on the
 * exact qualifiers we care about (IL/PR/82/85), so the envelope NM1s are naturally ignored.
 *
 * The subscriber/payer/provider NM1 loops in the outbound generator sit BEFORE the CLM segment,
 * so we buffer whatever demographics we've seen and attach them to the CLM when it opens. HI and
 * SV1 loops follow the CLM, so those attach to the current claim directly.
 */
function parse837Transaction(raw: string): ImportedRecord[] {
  const d = detectDelimiters(raw)
  const segments = tokenize(raw, d)

  const records: ImportedRecord[] = []

  // Demographics seen before the CLM belong to the claim that CLM opens.
  let pending = newClaim()
  let claim: WorkingClaim | null = null
  let line: WorkingLine | null = null

  const closeLine = () => {
    if (claim && line) claim.lines.push(line)
    line = null
  }
  const closeClaim = () => {
    closeLine()
    if (claim) {
      const rec = finalizeClaim(claim)
      if (rec) records.push(rec)
    }
    claim = null
    // A new HL/subscriber loop starts fresh demographics for the next claim.
    pending = newClaim()
  }

  // Route a demographic value onto whichever object is "active": the open claim, or the pending buffer.
  const active = (): WorkingClaim => claim ?? pending

  for (const seg of segments) {
    switch (seg.id) {
      case "HL":
        // A new hierarchical level (billing/subscriber/patient) starts a new logical grouping.
        // Close any open claim so its lines don't leak into the next loop.
        closeClaim()
        break

      case "SBR":
        // Subscriber loop begins — reset the pending demographics buffer.
        pending = newClaim()
        break

      case "NM1": {
        const qualifier = at(seg, 1)
        const entityType = at(seg, 2) // 1 = person, 2 = non-person
        const id = at(seg, 9)
        const tgt = active()
        if (qualifier === "IL") {
          // Subscriber/patient. Person name: NM103 last, NM104 first, NM109 member id (MI).
          tgt.patientLastName = at(seg, 3)
          tgt.patientFirstName = at(seg, 4)
          if (id) tgt.patientMemberId = id
        } else if (qualifier === "PR") {
          // Payer (non-person). NM103 name, NM109 payer id (PI).
          tgt.payerName = at(seg, 3)
          if (id) tgt.payerId = id
        } else if (qualifier === "82") {
          // Rendering provider. NM109 NPI, NM103/NM104 name (person or org).
          tgt.providerNpi = id
          tgt.providerName =
            entityType === "1" ? [at(seg, 4), at(seg, 3)].filter(Boolean).join(" ") : at(seg, 3)
        } else if (qualifier === "85") {
          // Billing provider — fallback when no rendering provider is present.
          tgt.billingNpi = id
          tgt.billingName =
            entityType === "1" ? [at(seg, 4), at(seg, 3)].filter(Boolean).join(" ") : at(seg, 3)
        }
        break
      }

      case "DMG":
        // DMG01=D8 date format, DMG02=DOB (YYYYMMDD). Applies to the subscriber/patient.
        if (at(seg, 1) === "D8") {
          const dob = ymd(at(seg, 2))
          if (dob) active().patientDob = dob
        }
        break

      case "CLM": {
        // Open the claim, inheriting the buffered subscriber/payer/provider demographics.
        closeLine()
        if (claim) {
          const rec = finalizeClaim(claim)
          if (rec) records.push(rec)
        }
        claim = pending
        pending = newClaim()
        claim.externalClaimId = at(seg, 1) || undefined
        const total = at(seg, 2)
        if (total) claim.totalCharge = num(total)
        break
      }

      case "HI":
        // Diagnosis codes — attach to the current claim (HI follows CLM in the loop).
        if (claim) claim.diagnoses.push(...parseHI(seg, d.component))
        break

      case "SV1": {
        // Service line composite in SV101; charge SV102; unit basis SV103; units SV104.
        closeLine()
        if (claim) {
          const { cptCode, modifiers } = parseSV101(at(seg, 1), d.component)
          line = {
            cptCode,
            modifiers,
            charge: num(at(seg, 2)),
            units: num(at(seg, 4)) || 1,
          }
        }
        break
      }

      case "DTP":
        // 472 = service date, format D8 (YYYYMMDD). A DTP after an SV1 is that line's date;
        // before any line it is the claim-level service date.
        if (at(seg, 1) === "472") {
          const date = ymd(at(seg, 3) || at(seg, 2))
          if (date) {
            if (line) line.serviceDate = date
            else if (claim) claim.serviceDate = date
          }
        }
        break

      case "SE":
        closeClaim()
        break
    }
  }

  closeClaim()
  return records
}

/**
 * Parse many inbound 837P files. Each file may contain several ST..SE transactions concatenated;
 * we tokenize the whole file at once (the ISA delimiters hold across the interchange), so multiple
 * transactions and multiple claims are handled by the CLM/HL looping above. Malformed files are
 * skipped with a file-level warning rather than throwing.
 */
export function parse837Backlog(contents: string[]): ImportParseResult {
  const records: ImportedRecord[] = []
  const warnings: string[] = []

  contents.forEach((raw, idx) => {
    try {
      const recs = parse837Transaction(raw)
      if (recs.length === 0) {
        warnings.push(`File ${idx + 1}: no claims (CLM) found — is this a valid 837P?`)
      }
      records.push(...recs)
    } catch (e) {
      warnings.push(`File ${idx + 1}: failed to parse (${e instanceof Error ? e.message : "unknown error"})`)
    }
  })

  if (records.length === 0 && warnings.length === 0) {
    warnings.push("No claims found in the 837 file(s) — is this a valid professional claim?")
  }

  return { format: "837", records, warnings }
}
