import { test, expect, describe } from "bun:test"
import { resolvePayer, canonicalPayerName, triageAccount, playbookForPrompt, PAYER_RULES } from "./recovery-playbook"

describe("payer normalization", () => {
  test("collapses the five UnitedHealthcare spellings seen in one aging report", () => {
    // Unconsolidated these read as five small payers instead of the second-largest one.
    const variants = [
      "United Healthcare", "UNITED HEALTHCARE", "Oxford United Healthcare",
      "United Healthcare / Community Plan", "Emblem/United",
    ]
    const canonical = new Set(variants.map(canonicalPayerName))
    expect(canonical.size).toBe(1)
    expect([...canonical][0]).toBe("UnitedHealthcare")
  })
  test("is case-insensitive and tolerates substrings", () => {
    expect(canonicalPayerName("aetna us healthcare")).toBe("Aetna")
    expect(canonicalPayerName("CIGNA HEALTHCARE")).toBe("Cigna")
  })
  test("passes through unknown payers rather than mislabeling them", () => {
    expect(canonicalPayerName("Some Regional TPA")).toBe("Some Regional TPA")
    expect(resolvePayer("Some Regional TPA")).toBeNull()
    expect(canonicalPayerName(null)).toBe("Unknown")
  })
  test("timely-filing values match the curated reference, not estimates", () => {
    // These were wrong when hand-estimated: Aetna 120, Cigna 90, Humana 90.
    expect(resolvePayer("Aetna")?.timelyFilingDays).toBe(180)
    expect(resolvePayer("Cigna")?.timelyFilingDays).toBe(180)
    expect(resolvePayer("Humana")?.timelyFilingDays).toBe(365)
    expect(resolvePayer("Medicare")?.timelyFilingDays).toBe(365)
  })
  test("Medicare carries the 1-year reopening window", () => {
    expect(resolvePayer("Medicare")?.reopeningDays).toBe(365)
    expect(resolvePayer("Medicare")?.appealDays).toBe(120)
  })
  test("no payer rule is self-inconsistent", () => {
    for (const r of PAYER_RULES) {
      expect(r.timelyFilingDays).toBeGreaterThan(0)
      if (r.appealDays !== null) expect(r.appealDays).toBeGreaterThan(0)
      expect(r.aliases.length).toBeGreaterThan(0)
    }
  })
})

describe("triageAccount", () => {
  test("an aged claim with no worklog is STATUS_UNKNOWN, not a denial", () => {
    // The core rule: appealing a claim the payer never received burns the appeal.
    const r = triageAccount({ payer: "Cigna", arDays: 150, hasWorklog: false })
    expect(r.tier).toBe("STATUS_UNKNOWN")
    expect(r.template).toContain("claim-status-inquiry")
  })
  test("unworked Medicare past 120 days routes to reopening", () => {
    const r = triageAccount({ payer: "Medicare", arDays: 200, hasWorklog: false })
    expect(r.tier).toBe("MEDICARE_REOPENING")
    expect(r.pastAppealWindow).toBe(true)
    expect(r.priority).toBe("HIGH")
  })
  test("a payer that never adjudicated routes to escalation, not appeal", () => {
    const r = triageAccount({
      payer: "Emblem/United", arDays: 150, hasWorklog: true,
      notes: ["A HCFA with letter were mailed to Emblem asking to process this claim"],
    })
    expect(r.tier).toBe("NEVER_ADJUDICATED")
    expect(r.template).toContain("payer-escalation")
  })
  test("deductible balances leave payer A/R entirely", () => {
    const r = triageAccount({
      payer: "Cigna", arDays: 130, hasWorklog: true, notes: ["Charges were applied to the deductible"],
    })
    expect(r.tier).toBe("PATIENT_RESPONSIBILITY")
    expect(r.template).toBeNull()
  })
  test("screening billed as diagnostic is a corrected claim, not an appeal", () => {
    const r = triageAccount({
      payer: "Surest", arDays: 160, hasWorklog: true, notes: ["CLAIM WAS BILLED AS DIAGNOSTIC"],
    })
    expect(r.tier).toBe("CORRECTED_CLAIM")
    expect(r.priority).toBe("HIGH")
  })
  test("prior-auth denials respect the payer's appeal window", () => {
    const inWindow = triageAccount({ payer: "Aetna", arDays: 100, hasWorklog: true, notes: ["service requires authorization"] })
    const past = triageAccount({ payer: "Aetna", arDays: 300, hasWorklog: true, notes: ["service requires authorization"] })
    expect(inWindow.tier).toBe("APPEAL_IN_WINDOW")
    expect(past.tier).toBe("APPEAL_PAST_WINDOW")
    expect(past.priority).toBe("LOW")
  })
  test("Healthfirst's shorter 60-day window is honored", () => {
    const r = triageAccount({ payer: "Healthfirst", arDays: 90, hasWorklog: true, notes: ["denied"] })
    expect(r.pastAppealWindow).toBe(true)
  })
})

describe("playbookForPrompt", () => {
  test("emits the payer's authoritative rules", () => {
    const p = playbookForPrompt("Aetna")
    expect(p).toContain("180")
    expect(p).toContain("Availity")
  })
  test("says so plainly when there is no rule, rather than inventing one", () => {
    expect(playbookForPrompt("Nonexistent Payer")).toContain("read the EOB")
  })
})
