import { test, expect, describe } from "bun:test"
import { parseCsvBacklog } from "./fromCsv"

const csv = (rows: string[]) => rows.join("\n")

describe("header auto-mapping", () => {
  // These headers came from a real practice aging export. Before the alias table was
  // widened, "Account #" and "Proc Code" both went unmapped — which silently produced
  // records with no dedup key and no CPT.
  test("maps the headers a real PM export actually emits", () => {
    const r = parseCsvBacklog(
      csv([
        "Account #,Carrier,Service Date,Proc Code,Billed,Status",
        "70804,Aetna US Healthcare,03/04/2026,99203,235.00,open",
      ]),
    )
    expect(r.records).toHaveLength(1)
    const rec = r.records[0]
    expect(rec.externalClaimId).toBe("70804") // the dedup/matching key
    expect(rec.payerName).toBe("Aetna US Healthcare")
    expect(rec.serviceDate).toBe("2026-03-04")
    expect(rec.lines[0].cptCode).toBe("99203")
    expect(rec.totalCharge).toBe(235)
  })

  test("accepts the common synonyms for each key field", () => {
    const variants: Array<[string, string]> = [
      ["Acct Number", "externalClaimId"],
      ["Patient Account", "externalClaimId"],
      ["Chart Number", "externalClaimId"],
      ["Payor", "payerName"],
      ["Primary Insurance", "payerName"],
      ["Svc Date", "serviceDate"],
      ["From Date", "serviceDate"],
    ]
    for (const [header] of variants) {
      const r = parseCsvBacklog(csv([`${header},Billed`, `X1,100.00`]))
      // the column must be consumed, not reported as unmapped
      expect(r.warnings.join(" ")).not.toContain(header)
    }
  })

  test("service-code synonyms all reach cptCode", () => {
    for (const h of ["Proc Code", "Service Code", "CPT Code", "HCPCS"]) {
      const r = parseCsvBacklog(csv([`Account,${h},Billed`, `A1,45380,100.00`]))
      expect(r.records[0].lines[0].cptCode).toBe("45380")
    }
  })

  test("worklog note columns map to denialReason", () => {
    // The pilot's triage depends on these free-text notes.
    for (const h of ["Notes", "Comments", "Worklog"]) {
      const r = parseCsvBacklog(csv([`Account,${h},Billed`, `A1,Claim denied - requires authorization,100.00`]))
      expect(r.records[0].denialReason).toContain("authorization")
    }
  })

  test("an explicit mapping overrides fuzzy matching", () => {
    const r = parseCsvBacklog(csv(["Weird Col,Billed", "ZZ9,100.00"]), { externalClaimId: "Weird Col" })
    expect(r.records[0].externalClaimId).toBe("ZZ9")
  })
})

describe("parse robustness", () => {
  test("quoted fields containing commas survive", () => {
    const r = parseCsvBacklog(csv(['Account,Notes,Billed', 'A1,"Denied, then appealed",100.00']))
    expect(r.records[0].denialReason).toBe("Denied, then appealed")
  })
  test("empty input is reported, not thrown", () => {
    const r = parseCsvBacklog("")
    expect(r.records).toEqual([])
    expect(r.warnings.length).toBeGreaterThan(0)
  })
  test("warns when rows cannot be matched to a patient", () => {
    const r = parseCsvBacklog(csv(["Account,Billed", "A1,100.00"]))
    expect(r.warnings.join(" ")).toMatch(/member ID|patient name/i)
  })
  test("unmapped columns are surfaced rather than silently dropped", () => {
    const r = parseCsvBacklog(csv(["Account,Billed,Sasquatch", "A1,100.00,x"]))
    expect(r.warnings.join(" ")).toContain("Sasquatch")
  })
})
