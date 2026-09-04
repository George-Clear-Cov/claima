import { test, expect, describe } from "bun:test"
import { parseCsvBacklog } from "./import/fromCsv"
import { analyzeLeakReport, CONTINGENCY_RATE, RECOVERY_RATES } from "./leak-report"

const csv = (rows: string[]) => rows.join("\n")

// Fixed clock so AR-day math and filing windows are deterministic. Service dates below sit
// 120-240 days back from this date, which is where real aged A/R lives.
const AS_OF = new Date("2026-09-01T00:00:00Z")

const HEADER = "Account #,Carrier,Service Date,Proc Code,Billed,Notes"

function report(rows: string[], name = "Practice") {
  const parsed = parseCsvBacklog(csv([HEADER, ...rows]))
  return analyzeLeakReport([{ name, records: parsed.records }], { asOf: AS_OF })
}

describe("unworked A/R — the headline finding", () => {
  test("counts accounts with no worklog note as never worked", () => {
    const r = report([
      "1001,Medicare,2026-03-01,45378,2000.00,",
      "1002,Medicare,2026-03-01,45378,1000.00,",
      "1003,Aetna,2026-03-01,45378,1000.00,Called payer 5/1 claim in process",
    ])
    expect(r.unworked.accounts).toBe(2)
    expect(r.unworked.balance).toBe(3000)
    // 3000 of 4000 = 75% of the balance has never been touched.
    expect(r.unworked.pctBalance).toBe(75)
    expect(r.unworked.pctAccounts).toBeCloseTo(66.67, 1)
  })

  test("an aged unworked claim is status-unknown, not denied", () => {
    // The single most important rule in the playbook: appealing a claim the payer never
    // received burns the appeal and misses the real fix.
    const r = report(["1001,NYCE PPO,2026-03-01,45378,2000.00,"])
    expect(r.tiers[0].tier).toBe("STATUS_UNKNOWN")
    expect(r.tiers[0].action).toContain("276/277")
  })

  test("aged unworked Medicare routes to a reopening, not an appeal", () => {
    // 2026-03-01 to 2026-09-01 is 184 days: past the 120-day redetermination window but
    // well inside the 1-year reopening window under 42 CFR 405.980.
    const r = report(["1001,Medicare,2026-03-01,45378,5000.00,"])
    expect(r.tiers[0].tier).toBe("MEDICARE_REOPENING")
  })
})

describe("payer fragmentation — the finding nobody else shows", () => {
  test("consolidates one payer written five ways and surfaces its true rank", () => {
    // This is the real pattern from the first engagement: UnitedHealthcare appeared under
    // five names totalling more than any single visible payer, and was invisible until
    // consolidated.
    const r = report([
      "1,Medicare,2026-03-01,45378,22000.00,",
      "2,United Healthcare,2026-03-01,45378,6000.00,",
      "3,UNITED HEALTHCARE,2026-03-01,45378,5000.00,",
      "4,Oxford UHC,2026-03-01,45378,5200.00,",
      "5,UHC Community Plan,2026-03-01,45378,4000.00,",
      "6,Emblem/United,2026-03-01,45378,3000.00,",
      "7,NYCE PPO,2026-03-01,45378,17000.00,",
    ])

    expect(r.totals.payersAsWritten).toBe(7)
    expect(r.totals.payersConsolidated).toBe(3)

    const uhc = r.payers.find((p) => p.canonical === "UnitedHealthcare")
    expect(uhc).toBeDefined()
    expect(uhc!.variants).toHaveLength(5)
    expect(uhc!.balance).toBe(23200)

    // Written out, its biggest single spelling ranked 3rd. Consolidated, it is the largest
    // payer in the book. That gap is the entire point of the finding.
    expect(uhc!.rankAsWritten).toBe(3)
    expect(uhc!.rankConsolidated).toBe(1)
    expect(r.fragmentation.hidden.map((p) => p.canonical)).toContain("UnitedHealthcare")
  })

  test("a payer with one spelling is never reported as hidden", () => {
    const r = report([
      "1,Medicare,2026-03-01,45378,2000.00,",
      "2,Aetna,2026-03-01,45378,1000.00,",
    ])
    expect(r.fragmentation.merged).toHaveLength(0)
    expect(r.fragmentation.hidden).toHaveLength(0)
  })
})

describe("accounts vs service lines", () => {
  test("collapses multiple lines on one account into a single account", () => {
    const r = report([
      "1001,Aetna,2026-03-01,45378,500.00,",
      "1001,Aetna,2026-03-01,45385,300.00,",
      "1002,Aetna,2026-03-01,45378,200.00,",
    ])
    // Counting rows would say 3 accounts and overstate the work by 50%.
    expect(r.totals.accounts).toBe(2)
    expect(r.totals.serviceLines).toBe(3)
    expect(r.totals.balance).toBe(1000)
  })

  test("a worklog note on any line marks the whole account as worked", () => {
    const r = report([
      "1001,Aetna,2026-03-01,45378,500.00,",
      "1001,Aetna,2026-03-01,45385,300.00,Appeal filed 6/2",
    ])
    expect(r.unworked.accounts).toBe(0)
  })

  test("a note on a later line re-triages the account, it does not just relabel it", () => {
    // Regression: triage used to run when an account was first seen and never again, so a
    // note arriving on the second line flipped hasWorklog while leaving the account parked
    // in STATUS_UNKNOWN. The report then said 25 accounts were unworked and 27 were
    // status-unknown, which cannot both be true.
    const r = report([
      "1001,Aetna,2026-03-01,45378,500.00,",
      "1001,Aetna,2026-03-01,45385,300.00,Appeal filed 6/2",
    ])
    expect(r.tiers.some((t) => t.tier === "STATUS_UNKNOWN")).toBe(false)
  })

  test("the oldest service date on an account drives its filing deadline", () => {
    // Healthfirst timely filing is 180 days. The 2026-01-01 line is already past it; the
    // 2026-08-01 line is not. The account is only safe if the oldest date wins.
    const r = report([
      "1001,Healthfirst,2026-08-01,45378,500.00,",
      "1001,Healthfirst,2026-01-01,45385,300.00,",
    ])
    expect(r.deadlines.alreadyClosed.accounts).toBe(1)
  })
})

describe("recovery math", () => {
  test("applies the per-tier rate to each account's balance", () => {
    const r = report(["1001,Medicare,2026-03-01,45378,10000.00,"])
    const rate = RECOVERY_RATES["MEDICARE_REOPENING:in"]
    expect(r.recovery.low).toBe(10000 * rate.low)
    expect(r.recovery.high).toBe(10000 * rate.high)
  })

  test("the contingency fee is 30% of recovered dollars, not of the book", () => {
    const r = report(["1001,Medicare,2026-03-01,45378,10000.00,"])
    expect(r.recovery.feeLow).toBeCloseTo(r.recovery.low * CONTINGENCY_RATE, 2)
    expect(r.recovery.feeHigh).toBeCloseTo(r.recovery.high * CONTINGENCY_RATE, 2)
    // Sanity: the fee must never approach the balance itself.
    expect(r.recovery.feeHigh).toBeLessThan(r.totals.balance * 0.3)
  })

  test("recovery is a fraction of the book, never all of it", () => {
    const r = report([
      "1,Medicare,2026-03-01,45378,22000.00,",
      "2,Healthfirst,2026-02-01,45378,14000.00,",
      "3,NYCE PPO,2026-04-01,45378,17000.00,",
    ])
    expect(r.recovery.highPct).toBeLessThan(100)
    expect(r.recovery.lowPct).toBeGreaterThan(0)
    expect(r.recovery.low).toBeLessThan(r.recovery.high)
  })
})

describe("closing filing windows", () => {
  test("flags balance whose timely-filing window has already closed", () => {
    // Healthfirst timely filing is 180 days; 2026-01-01 to 2026-09-01 is 243 days.
    const r = report(["1001,Healthfirst,2026-01-01,45378,4000.00,"])
    expect(r.deadlines.alreadyClosed.accounts).toBe(1)
    expect(r.deadlines.alreadyClosed.balance).toBe(4000)
  })

  test("flags balance closing in the next 30 and 60 days", () => {
    // Medicare timely filing is 365 days. 2025-10-15 -> 2026-09-01 is 321 days, so 44
    // days remain: inside 60, outside 30.
    const r = report(["1001,Medicare,2025-10-15,45378,3000.00,"])
    expect(r.deadlines.within60.accounts).toBe(1)
    expect(r.deadlines.within30.accounts).toBe(0)
  })

  test("excludes accounts with no known payer rule from deadline math", () => {
    const r = report(["1001,Some Regional IPA,2026-01-01,45378,4000.00,"])
    expect(r.deadlines.alreadyClosed.accounts).toBe(0)
    expect(r.dataQuality.join(" ")).toContain("no filing-deadline rule")
  })
})

describe("portfolio mode — the PE framing", () => {
  test("rolls up multiple practices and reports each separately", () => {
    const a = parseCsvBacklog(csv([HEADER, "1,Medicare,2026-03-01,45378,10000.00,"]))
    const b = parseCsvBacklog(
      csv([HEADER, "1,Medicare,2026-03-01,45378,4000.00,", "2,Aetna,2026-03-01,45378,6000.00,Worked 5/1"]),
    )
    const r = analyzeLeakReport(
      [
        { name: "Downtown GI", records: a.records },
        { name: "Westside GI", records: b.records },
      ],
      { asOf: AS_OF },
    )

    expect(r.totals.sources).toBe(2)
    expect(r.totals.balance).toBe(20000)
    expect(r.sources).toHaveLength(2)
    expect(r.sources[0].name).toBe("Downtown GI")
    expect(r.sources[0].unworkedPctBalance).toBe(100)
    expect(r.sources[1].unworkedPctBalance).toBe(40)
  })

  test("identical account numbers in different files stay separate accounts", () => {
    // Two practices both number an account "1". Keying on the account alone would silently
    // merge two different practices' A/R into one.
    const a = parseCsvBacklog(csv([HEADER, "1,Medicare,2026-03-01,45378,10000.00,"]))
    const b = parseCsvBacklog(csv([HEADER, "1,Medicare,2026-03-01,45378,4000.00,"]))
    const r = analyzeLeakReport(
      [
        { name: "A", records: a.records },
        { name: "B", records: b.records },
      ],
      { asOf: AS_OF },
    )
    expect(r.totals.accounts).toBe(2)
    expect(r.totals.balance).toBe(14000)
  })
})

describe("honesty guards", () => {
  test("an empty file produces zeros, not NaN", () => {
    const r = analyzeLeakReport([{ name: "Empty", records: [] }], { asOf: AS_OF })
    expect(r.totals.balance).toBe(0)
    expect(r.unworked.pctBalance).toBe(0)
    expect(r.recovery.lowPct).toBe(0)
    expect(Number.isNaN(r.recovery.low)).toBe(false)
  })

  test("discloses that an aging report carries no denial codes", () => {
    const r = report(["1001,Aetna,2026-06-01,45378,1000.00,Appeal filed 7/1 no response"])
    expect(r.dataQuality.join(" ")).toContain("no CARC/RARC")
  })

  test("discloses accounts with no service date instead of silently dating them", () => {
    const r = report(["1001,Aetna,,45378,1000.00,"])
    expect(r.dataQuality.join(" ")).toContain("no service date")
  })
})

describe("internal consistency", () => {
  // The tiers partition the same accounts the summary counts. Any tier that is by
  // definition a subset of unworked A/R has to stay inside it, and every tier has to add
  // back up to the whole book. These invariants are cheap and catch desync bugs that
  // individual assertions miss.
  const rows = [
    "1,Medicare,2026-03-01,45378,3000.00,",
    "1,Medicare,2026-03-01,45385,1200.00,Called payer 6/1",
    "2,Medicare,2026-03-01,45378,2200.00,",
    "3,Healthfirst,2026-02-01,45378,1800.00,",
    "4,Oxford UHC,2026-04-01,45378,1400.00,Applied to the deductible per EOB",
    "5,Aetna,2026-05-01,45378,900.00,Denied requires authorization",
    "6,Cigna,2026-06-01,45378,700.00,Billed as diagnostic, was a screening",
    "7,NYCE PPO,2026-03-15,45378,2600.00,",
  ]

  test("tiers that imply no follow-up never exceed the unworked count", () => {
    const r = report(rows)
    const noFollowUp = r.tiers
      .filter((t) => t.tier === "STATUS_UNKNOWN" || t.tier === "MEDICARE_REOPENING")
      .reduce((n, t) => n + t.accounts, 0)
    expect(noFollowUp).toBeLessThanOrEqual(r.unworked.accounts)
  })

  test("tier balances sum to the total book", () => {
    const r = report(rows)
    const tierBalance = r.tiers.reduce((n, t) => n + t.balance, 0)
    expect(tierBalance).toBeCloseTo(r.totals.balance, 2)
  })

  test("tier accounts sum to the total account count", () => {
    const r = report(rows)
    const tierAccounts = r.tiers.reduce((n, t) => n + t.accounts, 0)
    expect(tierAccounts).toBe(r.totals.accounts)
  })

  test("estimated recovery never exceeds the balance it is drawn from", () => {
    const r = report(rows)
    expect(r.recovery.high).toBeLessThanOrEqual(r.totals.balance)
    for (const t of r.tiers) expect(t.recoveryHigh).toBeLessThanOrEqual(t.balance)
  })
})

describe("tier actions describe the tier", () => {
  test("the action shown is the one carrying the most balance, not the first account's", () => {
    // Both land in APPEAL_PAST_WINDOW, by different routes. The prior-auth account arrives
    // first but holds a tenth of the balance, so its intra-operative-conversion instruction
    // must not be what the tier tells the reader to do.
    const r = report([
      "1,Healthfirst,2026-01-01,45378,500.00,Denied requires authorization",
      "2,Healthfirst,2026-01-01,45378,9000.00,Appeal filed 3/1 denied again",
    ])
    const tier = r.tiers.find((t) => t.tier === "APPEAL_PAST_WINDOW")
    expect(tier).toBeDefined()
    expect(tier!.accounts).toBe(2)
    expect(tier!.action).not.toContain("intra-operative")
    expect(tier!.action).toContain("good-cause")
  })
})
