/**
 * CSV backlog adapter — turns a practice's own AR/denial CSV export (from their PM system,
 * a payer portal download, or a hand-built spreadsheet) into normalized ImportedRecords. This
 * is the enrichment/fallback path when a practice can't hand over raw 835/837 EDI: CSVs are the
 * lowest common denominator every billing system can export.
 *
 * Zero-dependency: the RFC-4180-ish parser below handles quoted fields, embedded commas/newlines,
 * escaped quotes (""), and CRLF/LF — so we don't pull in a CSV lib. Columns auto-map to
 * ImportedRecord fields by fuzzy header match; a `mapping` override handles nonstandard headers.
 */
import type { ImportedLine, ImportedRecord, ImportParseResult } from "./types"

/** The ImportedRecord (+ line) fields a CSV column can target. */
type CsvField =
  | "externalClaimId"
  | "patientFirstName"
  | "patientLastName"
  | "patientMemberId"
  | "patientDob"
  | "payerName"
  | "payerId"
  | "providerNpi"
  | "providerName"
  | "serviceDate"
  | "cptCode"
  | "modifier"
  | "icd10Codes"
  | "units"
  | "charge"
  | "paid"
  | "carcCodes"
  | "denialReason"
  | "status"
  | "patientResponsibility"

/** Normalize a header for matching: lowercase, strip anything that isn't a letter/digit. */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// Header aliases per field. Keys are already normalized (no spaces/underscores/punct).
const ALIASES: Record<CsvField, string[]> = {
  externalClaimId: ["claim", "claimid", "claimnumber", "claim#", "controlnumber", "pcn", "patientcontrolnumber", "account", "accountnumber", "acct", "acctnumber", "patientaccount", "patientaccountnumber", "chartnumber", "chart"],
  patientFirstName: ["patientfirst", "patientfirstname", "firstname", "first"],
  patientLastName: ["patientlast", "patientlastname", "lastname", "last"],
  patientMemberId: ["memberid", "subscriberid", "policy", "policynumber", "insuranceid", "member"],
  patientDob: ["dob", "dateofbirth", "birthdate", "patientdob"],
  payerName: ["payer", "payername", "insurance", "insurancename", "carrier", "plan", "planname", "payor", "payorname", "insurancecarrier", "primaryinsurance", "primarypayer"],
  payerId: ["payerid"],
  providerNpi: ["npi", "providernpi", "renderingnpi"],
  providerName: ["provider", "providername", "renderingprovider"],
  serviceDate: ["dos", "servicedate", "dateofservice", "fromdos", "servicedatefrom", "svcdate", "datefrom", "fromdate", "startdate", "servicedates"],
  cptCode: ["cpt", "cptcode", "procedure", "procedurecode", "hcpcs", "code", "proc", "proccode", "servicecode", "svccode", "cptcodes"],
  modifier: ["modifier", "mod", "modifiers"],
  icd10Codes: ["icd", "icd10", "icd10codes", "diagnosis", "dx", "diagnosiscode"],
  units: ["units", "qty", "quantity"],
  charge: ["charge", "billed", "billedamount", "amount", "totalcharge", "chargeamount", "chargeamt", "totalbilled", "fee", "arbalance", "balance"],
  paid: ["paid", "payment", "paidamount", "paymentamount"],
  carcCodes: ["carc", "denialcode", "reasoncode", "adjustmentcode", "carccode"],
  denialReason: ["denialreason", "reason", "description", "remark", "remarks", "note", "notes", "comment", "comments", "worklog", "followup"],
  status: ["status", "claimstatus"],
  patientResponsibility: ["patientresponsibility", "patientresp", "pramount", "patientbalance", "patientdue", "responsibility"],
}

/**
 * RFC-4180-ish CSV tokenizer. Returns rows of string cells. Handles:
 *  - double-quoted fields, with commas/newlines/quotes inside
 *  - escaped quotes ("") -> a single literal "
 *  - CRLF and LF line endings
 *  - a trailing newline / trailing blank lines (dropped)
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let started = false // did the current row have any content/field yet?

  const pushField = () => {
    row.push(field)
    field = ""
    started = true
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
    started = false
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++ // consume the escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      started = true
      continue
    }
    if (ch === ",") {
      pushField()
      continue
    }
    if (ch === "\r") {
      // handle CRLF (skip the paired \n) and lone CR
      if (text[i + 1] === "\n") i++
      pushRow()
      continue
    }
    if (ch === "\n") {
      pushRow()
      continue
    }
    field += ch
    started = true
  }
  // flush the final field/row if the file didn't end on a newline
  if (started || field.length > 0 || row.length > 0) pushRow()

  // Drop rows that are entirely empty (trailing blank lines / stray commas-only lines).
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

/** Parse a money/number cell: strip $, commas, spaces, parens. Returns undefined if blank/NaN. */
function num(v: string | undefined): number | undefined {
  if (v == null) return undefined
  const t = v.trim()
  if (t === "") return undefined
  const neg = /^\(.*\)$/.test(t) // (12.34) accounting-negative
  const cleaned = t.replace(/[$,\s()]/g, "")
  if (cleaned === "") return undefined
  const n = Number(cleaned)
  if (Number.isNaN(n)) return undefined
  return neg ? -n : n
}

/** Normalize a date cell to YYYY-MM-DD. Accepts YYYY-MM-DD, MM/DD/YYYY, M/D/YY, YYYYMMDD. */
function ymd(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const t = v.trim()
  if (t === "") return undefined

  // already ISO-ish
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`

  // MM/DD/YYYY or M/D/YY (also accepts - or . separators)
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    let yr = m[3]
    if (yr.length === 2) yr = Number(yr) > 50 ? `19${yr}` : `20${yr}`
    return `${yr}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
  }

  // YYYYMMDD
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  return t // leave as-is; better to surface the raw value than drop it
}

/** Split a multi-code cell (ICD list, CARC list) on comma / semicolon / whitespace. */
function splitCodes(v: string | undefined): string[] | undefined {
  if (v == null) return undefined
  const parts = v
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

function inferStatus(
  statusCell: string | undefined,
  carc: string[] | undefined,
  denialReason: string | undefined,
): ImportedRecord["status"] {
  if (statusCell != null && statusCell.trim() !== "") {
    const s = statusCell.toLowerCase()
    if (s.includes("den")) return "denied"
    if (s.includes("paid")) return "paid"
    if (s.includes("open")) return "open"
  }
  if ((carc && carc.length) || (denialReason && denialReason.trim() !== "")) return "denied"
  return "open"
}

/**
 * Parse a practice CSV backlog export into normalized ImportedRecords.
 * @param csvText the full CSV file contents (header row + data rows)
 * @param mapping optional override: ImportedRecord field name -> exact CSV header. Use when the
 *                practice's headers are nonstandard and auto-mapping can't find them.
 */
export function parseCsvBacklog(csvText: string, mapping?: Record<string, string>): ImportParseResult {
  const warnings: string[] = []
  const rows = parseCsv(csvText)
  if (rows.length === 0) {
    return { format: "csv", records: [], warnings: ["CSV is empty — no header row found."] }
  }

  const header = rows[0]
  const dataRows = rows.slice(1)

  // Build header index -> field. Explicit `mapping` wins; otherwise fuzzy-match aliases.
  const colToField: (CsvField | undefined)[] = new Array(header.length).fill(undefined)
  const unmapped: string[] = []

  // Precompute an alias -> field lookup for the auto path.
  const aliasToField = new Map<string, CsvField>()
  for (const [field, aliases] of Object.entries(ALIASES) as [CsvField, string[]][]) {
    for (const a of aliases) aliasToField.set(normHeader(a), field)
  }

  // If an explicit mapping is supplied, resolve each field -> the header column it names.
  const overrideByColumn = new Map<number, CsvField>()
  if (mapping) {
    for (const [field, headerName] of Object.entries(mapping)) {
      const wantNorm = normHeader(headerName)
      const idx = header.findIndex((h) => normHeader(h) === wantNorm)
      if (idx >= 0) overrideByColumn.set(idx, field as CsvField)
      else warnings.push(`mapping override for "${field}" points to header "${headerName}", which isn't in the CSV`)
    }
  }

  header.forEach((h, i) => {
    if (overrideByColumn.has(i)) {
      colToField[i] = overrideByColumn.get(i)
      return
    }
    const field = aliasToField.get(normHeader(h))
    if (field) colToField[i] = field
    else if (h.trim() !== "") unmapped.push(h.trim())
  })

  if (unmapped.length) {
    warnings.push(`Unmapped columns (ignored): ${unmapped.join(", ")}`)
  }

  const records: ImportedRecord[] = dataRows.map((cells, rowIdx) => {
    // Gather cell values by field (first column that maps to a field wins).
    const get = (field: CsvField): string | undefined => {
      const i = colToField.indexOf(field)
      if (i < 0) return undefined
      const v = cells[i]
      return v == null || v.trim() === "" ? undefined : v.trim()
    }

    const carcCodes = splitCodes(get("carcCodes"))
    const icd10Codes = splitCodes(get("icd10Codes"))
    const modifiers = splitCodes(get("modifier"))
    const denialReason = get("denialReason")
    const charge = num(get("charge"))
    const paid = num(get("paid"))
    const cptCode = get("cptCode")

    const line: ImportedLine = {
      cptCode: cptCode ?? "",
      modifiers: modifiers && modifiers.length ? modifiers : undefined,
      icd10Codes,
      units: num(get("units")),
      charge,
      paid,
    }

    const firstName = get("patientFirstName")
    const lastName = get("patientLastName")
    const memberId = get("patientMemberId")

    const recWarnings: string[] = []
    if (!memberId && !firstName && !lastName) {
      recWarnings.push(`row ${rowIdx + 2}: no member ID and no patient name — can't match to a patient`)
    }

    return {
      externalClaimId: get("externalClaimId"),
      patientFirstName: firstName,
      patientLastName: lastName,
      patientMemberId: memberId,
      patientDob: ymd(get("patientDob")),
      payerId: get("payerId"),
      payerName: get("payerName"),
      providerNpi: get("providerNpi"),
      providerName: get("providerName"),
      serviceDate: ymd(get("serviceDate")),
      lines: [line],
      totalCharge: charge,
      totalPaid: paid,
      status: inferStatus(get("status"), carcCodes, denialReason),
      carcCodes,
      denialReason,
      patientResponsibility: num(get("patientResponsibility")),
      warnings: recWarnings.length ? recWarnings : undefined,
    }
  })

  // Surface row-level "no identity" warnings at the file level too, so the preview flags them.
  const orphanRows = records.filter((r) => r.warnings?.some((w) => w.includes("no member ID"))).length
  if (orphanRows) {
    warnings.push(`${orphanRows} row(s) have neither a member ID nor a patient name and may not match a patient.`)
  }

  if (records.length === 0) warnings.push("No data rows found below the header.")

  return { format: "csv", records, warnings }
}
