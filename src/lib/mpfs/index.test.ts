import { describe, expect, test } from "bun:test"
import {
  MPFS_LOCALITIES,
  MPFS_RELEASE,
  analyzeUnderpayment,
  benchmarkLine,
  classifyPayer,
  findLocality,
  localityKey,
  medicareAllowed,
  nationalAllowed,
} from "./index"

const NY = findLocality("NY-01")!.state === "NY" ? findLocality("NY-01")! : MPFS_LOCALITIES[0]
const MANHATTAN = MPFS_LOCALITIES.find((l) => /manhattan/i.test(l.name)) ?? NY

describe("fee schedule data", () => {
  test("loaded a real CMS release with a plausible conversion factor", () => {
    expect(MPFS_RELEASE.year).toBeGreaterThanOrEqual(2025)
    // The CF has sat between $32 and $37 for a decade. A value outside that means the column
    // index drifted in a future CMS layout change, which is exactly the silent failure to catch.
    expect(MPFS_RELEASE.conversionFactor).toBeGreaterThan(32)
    expect(MPFS_RELEASE.conversionFactor).toBeLessThan(37)
    expect(MPFS_RELEASE.codes).toBeGreaterThan(5000)
  })

  test("localities are complete and internally consistent", () => {
    expect(MPFS_LOCALITIES.length).toBeGreaterThan(80)
    for (const l of MPFS_LOCALITIES) {
      // The work GPCI carries a statutory 1.0 floor, so nothing may sit below it.
      expect(l.pw).toBeGreaterThanOrEqual(1)
      expect(l.pe).toBeGreaterThan(0.5)
      expect(l.mp).toBeGreaterThan(0)
      expect(l.name).not.toMatch(/\*/)
    }
    const keys = MPFS_LOCALITIES.map(localityKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test("99213 prices in a defensible range and office pays more than facility", () => {
    const office = nationalAllowed("99213", [], "office")!
    const facility = nationalAllowed("99213", [], "facility")!
    expect(office).toBeGreaterThan(70)
    expect(office).toBeLessThan(160)
    // Non-facility PE is higher because the practice bears the overhead.
    expect(office).toBeGreaterThan(facility)
  })

  test("component modifiers select their own priced row", () => {
    // 70450 is a CT with a real professional/technical split.
    const global = nationalAllowed("70450", [])
    const pro = nationalAllowed("70450", ["26"])
    const tech = nationalAllowed("70450", ["TC"])
    if (global && pro && tech) {
      expect(pro).toBeLessThan(global)
      expect(tech).toBeLessThan(global)
      // The two components should reconstruct the global fee within rounding.
      expect(Math.abs(pro + tech - global)).toBeLessThan(1)
    }
  })

  test("unknown and unpriced codes return null rather than zero", () => {
    expect(nationalAllowed("ZZZZZ", [])).toBeNull()
    expect(medicareAllowed("ZZZZZ", [], MANHATTAN)).toBeNull()
  })

  test("locality adjustment moves the number in the right direction", () => {
    const cheapest = [...MPFS_LOCALITIES].sort((a, b) => a.pe - b.pe)[0]
    const dearest = [...MPFS_LOCALITIES].sort((a, b) => b.pe - a.pe)[0]
    const low = medicareAllowed("99213", [], cheapest)!
    const high = medicareAllowed("99213", [], dearest)!
    expect(high).toBeGreaterThan(low)
  })

  test("units multiply the benchmark", () => {
    const one = medicareAllowed("99213", [], MANHATTAN, "office", 1)!
    const three = medicareAllowed("99213", [], MANHATTAN, "office", 3)!
    expect(three).toBeCloseTo(one * 3, 1)
  })
})

describe("payer classification", () => {
  test("Medicare Advantage is never misfiled as traditional Medicare", () => {
    // This is the classification that matters most: MA carries a weaker claim, so filing an
    // MA plan under `medicare` would overstate confidence on a real customer's report.
    expect(classifyPayer("Medicare Advantage")).toBe("medicare_advantage")
    expect(classifyPayer("AARP Medicare Complete")).toBe("medicare_advantage")
    expect(classifyPayer("UnitedHealthcare Dual Complete")).toBe("medicare_advantage")
    expect(classifyPayer("Humana Gold Plus HMO SNP")).toBe("medicare_advantage")
  })

  test("traditional Medicare and its MACs", () => {
    expect(classifyPayer("Medicare Part B")).toBe("medicare")
    expect(classifyPayer("NGS")).toBe("medicare")
    expect(classifyPayer("Novitas Solutions")).toBe("medicare")
  })

  test("medicaid and commercial", () => {
    expect(classifyPayer("NY Medicaid")).toBe("medicaid")
    expect(classifyPayer("Healthfirst")).toBe("medicaid")
    expect(classifyPayer("Aetna")).toBe("commercial")
    expect(classifyPayer("Oxford UHC")).toBe("commercial")
    expect(classifyPayer("")).toBe("unknown")
  })
})

describe("line benchmarking", () => {
  const bench = medicareAllowed("99213", [], MANHATTAN)!

  test("flags a genuine shortfall", () => {
    const r = benchmarkLine(
      { cpt: "99213", payerName: "Medicare Part B", allowed: bench * 0.7, paid: bench * 0.56 },
      MANHATTAN,
    )
    expect(r.verdict).toBe("underpaid")
    expect(r.variance).toBeGreaterThan(0)
    expect(r.confidence).toBe("high")
  })

  test("does not flag payment at or above the floor", () => {
    const r = benchmarkLine(
      { cpt: "99213", payerName: "Aetna", allowed: bench * 1.4, paid: bench * 1.4 },
      MANHATTAN,
    )
    expect(r.verdict).toBe("at_or_above")
    expect(r.variance).toBe(0)
  })

  test("rounding noise is not a finding", () => {
    const r = benchmarkLine(
      { cpt: "99213", payerName: "Medicare", allowed: bench - 0.4, paid: bench - 0.4 },
      MANHATTAN,
    )
    expect(r.verdict).toBe("at_or_above")
    expect(r.variance).toBe(0)
  })

  test("a modifier-51 second procedure is NOT called underpaid", () => {
    // The regression that matters. Multiple-procedure reduction means the second procedure is
    // supposed to pay about half. Reporting that as a shortfall would put a confident, wrong
    // finding on the first screen a practice ever sees.
    const r = benchmarkLine(
      { cpt: "99213", modifiers: ["51"], payerName: "Medicare", allowed: bench * 0.5, paid: bench * 0.5 },
      MANHATTAN,
    )
    expect(r.verdict).toBe("not_benchmarked_modifier")
    expect(r.variance).toBe(0)
  })

  test("denied lines are a denial, not an underpayment", () => {
    const r = benchmarkLine(
      { cpt: "99213", payerName: "Medicare", allowed: 0, paid: 0, denied: true },
      MANHATTAN,
    )
    expect(r.verdict).toBe("not_applicable")
  })

  test("falls back to paid + patient responsibility when AMT*B6 is absent", () => {
    const r = benchmarkLine(
      { cpt: "99213", payerName: "Medicare", paid: 60, patientResponsibility: 15 },
      MANHATTAN,
    )
    expect(r.actualAllowed).toBe(75)
  })
})

describe("portfolio analysis", () => {
  const bench = medicareAllowed("99213", [], MANHATTAN)!

  test("separates shortfall by confidence and never mixes the claims", () => {
    const report = analyzeUnderpayment(
      [
        { cpt: "99213", payerName: "Medicare Part B", allowed: bench * 0.6, paid: bench * 0.48 },
        { cpt: "99213", payerName: "Aetna", allowed: bench * 0.6, paid: bench * 0.6 },
        { cpt: "99213", payerName: "AARP Medicare Complete", allowed: bench * 0.6, paid: bench * 0.6 },
      ],
      MANHATTAN,
    )
    expect(report.shortfallByConfidence.high).toBeGreaterThan(0)
    expect(report.shortfallByConfidence.medium).toBeGreaterThan(0)
    expect(report.shortfallByConfidence.signal).toBeGreaterThan(0)
    const sum =
      report.shortfallByConfidence.high +
      report.shortfallByConfidence.medium +
      report.shortfallByConfidence.signal
    expect(sum).toBeCloseTo(report.shortfall, 1)
  })

  test("totals reconcile against the line verdicts", () => {
    const report = analyzeUnderpayment(
      [
        { cpt: "99213", payerName: "Medicare", allowed: bench * 0.6, paid: bench * 0.6 },
        { cpt: "99213", modifiers: ["51"], payerName: "Medicare", allowed: 1, paid: 1 },
        { cpt: "ZZZZZ", payerName: "Medicare", allowed: 100, paid: 100 },
        { cpt: "99213", payerName: "Medicare", allowed: 0, paid: 0, denied: true },
      ],
      MANHATTAN,
    )
    expect(report.totals.linesRead).toBe(4)
    expect(report.totals.linesBenchmarked).toBe(1)
    expect(report.totals.linesModifierSkipped).toBe(1)
    expect(report.totals.linesNoBenchmark).toBe(1)
    expect(report.totals.linesDenied).toBe(1)
  })

  test("ranks payers and codes by money, not count", () => {
    const report = analyzeUnderpayment(
      [
        { cpt: "99213", payerName: "Small Payer", allowed: bench * 0.95, paid: bench * 0.95 },
        { cpt: "99215", payerName: "Big Payer", allowed: 10, paid: 10 },
        { cpt: "99215", payerName: "Big Payer", allowed: 10, paid: 10 },
      ],
      MANHATTAN,
    )
    expect(report.byPayer[0]!.payerName).toBe("Big Payer")
    expect(report.byCode[0]!.cpt).toBe("99215")
    expect(report.byCode[0]!.shortfallPerUnit).toBeGreaterThan(0)
  })

  test("caveats always state the release, locality and setting", () => {
    const report = analyzeUnderpayment([{ cpt: "99213", payerName: "Medicare", allowed: 10, paid: 10 }], MANHATTAN)
    expect(report.caveats[0]).toContain(String(MPFS_RELEASE.conversionFactor))
    expect(report.caveats[0]).toContain(MANHATTAN.name)
    expect(report.caveats[0]).toContain("non-facility")
  })

  test("an empty file produces zeros, not NaN", () => {
    const report = analyzeUnderpayment([], MANHATTAN)
    expect(report.shortfall).toBe(0)
    expect(report.totals.linesRead).toBe(0)
    expect(Number.isNaN(report.totals.medicareAllowed)).toBe(false)
  })
})
