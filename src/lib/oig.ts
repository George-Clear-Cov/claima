// OIG LEIE (List of Excluded Individuals/Entities) check
// Calls the HHS OIG public exclusion search. Penalties for billing Medicare/Medicaid
// with an excluded provider can reach $10K+ per item + repayment of all claims.

const OIG_SEARCH_URL = "https://oig.hhs.gov/exclusions/exclusions_output.asp"
const TIMEOUT_MS = 15_000

export interface OigMatch {
  lastName: string
  firstName: string
  npi: string
  exclusionType: string
  exclusionDate: string
  reinstatementDate: string
  waiverDate: string
  waiverState: string
  address: string
  city: string
  state: string
  zip: string
  specialty: string
}

export interface OigResult {
  excluded: boolean
  matches: OigMatch[]
  error?: string
  checkedAt: string
}

function parseOigHtml(html: string): OigMatch[] {
  // OIG returns an HTML table. "No Records Found" means clean.
  if (html.includes("No Records Found")) return []
  if (!html.includes("<table")) return []

  const matches: OigMatch[] = []

  // Extract all <tr> rows after the header
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let row: RegExpExecArray | null

  const rows: string[][] = []
  while ((row = rowRegex.exec(html)) !== null) {
    const cells: string[] = []
    let cell: RegExpExecArray | null
    const tdPattern = new RegExp(tdRegex.source, "gi")
    while ((cell = tdPattern.exec(row[1])) !== null) {
      // Strip inner HTML tags
      cells.push(cell[1].replace(/<[^>]+>/g, "").trim())
    }
    if (cells.length >= 6) rows.push(cells)
  }

  // Skip header row (contains "Last Name", "First Name", etc.)
  for (const cells of rows) {
    if (cells[0]?.toLowerCase() === "last name") continue
    if (cells[0] === "") continue
    matches.push({
      lastName:          cells[0]  ?? "",
      firstName:         cells[1]  ?? "",
      npi:               cells[2]  ?? "",
      exclusionType:     cells[3]  ?? "",
      exclusionDate:     cells[4]  ?? "",
      reinstatementDate: cells[5]  ?? "",
      waiverDate:        cells[6]  ?? "",
      waiverState:       cells[7]  ?? "",
      address:           cells[8]  ?? "",
      city:              cells[9]  ?? "",
      state:             cells[10] ?? "",
      zip:               cells[11] ?? "",
      specialty:         cells[12] ?? "",
    })
  }

  return matches.filter((m) => m.lastName || m.firstName)
}

export async function checkOigExclusion(
  firstName: string,
  lastName: string,
  npi: string
): Promise<OigResult> {
  const checkedAt = new Date().toISOString()

  try {
    const params = new URLSearchParams({
      lastname:  lastName.trim(),
      firstname: firstName.trim(),
      npi:       npi.trim(),
      state:     "",
      busname:   "",
      DOB:       "",
      address:   "",
      city:      "",
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`${OIG_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "claima.io/1.0 OIG-exclusion-check (contact: admin@claima.io)",
        "Accept": "text/html",
      },
    }).finally(() => clearTimeout(timer))

    if (!res.ok) {
      return { excluded: false, matches: [], error: `OIG returned HTTP ${res.status}`, checkedAt }
    }

    const html = await res.text()
    const matches = parseOigHtml(html)

    return {
      excluded: matches.length > 0,
      matches,
      checkedAt,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return {
      excluded: false,
      matches: [],
      error: msg.includes("abort") ? "OIG search timed out — check manually at exclusions.oig.hhs.gov" : msg,
      checkedAt,
    }
  }
}
