import { test, expect, describe } from "bun:test"
import { lookupModifier, needsPreventiveModifier, modifierGuidanceForPrompt } from "./modifiers"

describe("needsPreventiveModifier", () => {
  // This is the exact defect behind the pilot's $4,035 Surest balance.
  test("flags a screening colonoscopy that converted to therapeutic", () => {
    expect(needsPreventiveModifier(["45380"], ["Z12.11"], [])).toBe(true)
    expect(needsPreventiveModifier(["45385"], ["Z12.11"], [])).toBe(true)
  })
  test("clears once PT or 33 is applied", () => {
    expect(needsPreventiveModifier(["45380"], ["Z12.11"], ["PT"])).toBe(false)
    expect(needsPreventiveModifier(["45380"], ["Z12.11"], ["33"])).toBe(false)
    expect(needsPreventiveModifier(["45380"], ["Z12.11"], ["pt"])).toBe(false)
  })
  test("does not fire without a screening indication", () => {
    expect(needsPreventiveModifier(["45380"], ["K63.5"], [])).toBe(false)
  })
  test("does not fire on a non-screening-convertible procedure", () => {
    expect(needsPreventiveModifier(["99213"], ["Z12.11"], [])).toBe(false)
  })
})

describe("lookupModifier", () => {
  test("resolves preventive, telehealth and common modifiers", () => {
    expect(lookupModifier("PT")?.payerNote).toContain("Medicare")
    expect(lookupModifier("33")?.meaning).toContain("Preventive")
    expect(lookupModifier("95")?.meaning).toContain("telehealth")
    expect(lookupModifier("25")?.meaning).toContain("separately identifiable")
  })
  test("flags AT as required for Medicare chiropractic", () => {
    expect(lookupModifier("AT")?.payerNote).toContain("REQUIRED")
  })
  test("is case-insensitive and returns null for unknowns", () => {
    expect(lookupModifier("pt")).toEqual(lookupModifier("PT"))
    expect(lookupModifier("ZZ")).toBeNull()
  })
})

describe("modifierGuidanceForPrompt", () => {
  test("tells the model this is a corrected claim, not an appeal", () => {
    const g = modifierGuidanceForPrompt(["45380"], ["Z12.11"])
    expect(g).toContain("CORRECTED CLAIM")
    expect(g).toContain("PT")
  })
  test("stays silent when there is nothing to say", () => {
    expect(modifierGuidanceForPrompt(["99213"], ["R10.84"])).toBe("")
  })
})

describe("real-world procedure code shapes", () => {
  test("a suffixed CPT still triggers the screening-modifier check", () => {
    // Found in a live practice export: 45380O + Z12.11 with no PT/33, $2,500 at stake.
    expect(needsPreventiveModifier(["45380O"], ["Z12.11"], [])).toBe(true)
    expect(needsPreventiveModifier(["45380O"], ["Z12.11"], ["PT"])).toBe(false)
  })
})
