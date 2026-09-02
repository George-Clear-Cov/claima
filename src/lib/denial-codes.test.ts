import { test, expect, describe } from "bun:test"
import { classifyDenial, classifyRarc, normalizeCarc, CARC_CODES, RARC_CODES } from "./denial-codes"

describe("normalizeCarc", () => {
  test("strips a group-code prefix only when a digit follows", () => {
    for (const v of ["CO-45", "CO45", "PR 1", "OA-18", "co-45"]) {
      expect(normalizeCarc(v)).toMatch(/^\d+$/)
    }
    expect(normalizeCarc("CO-45")).toBe("45")
    expect(normalizeCarc("45")).toBe("45")
  })
  test("leaves RARC-style codes untouched", () => {
    // A naive prefix strip would mangle these into digits.
    expect(normalizeCarc("M1")).toBe("M1")
    expect(normalizeCarc("MA01")).toBe("MA01")
    expect(normalizeCarc("N115")).toBe("N115")
  })
})

describe("classifyDenial", () => {
  test("patient-responsibility codes are not appealable", () => {
    for (const c of ["1", "2", "3"]) {
      const d = classifyDenial(c)
      expect(d.category).toBe("PATIENT_RESPONSIBILITY")
      expect(d.appealable).toBe(false)
    }
  })
  test("contractual write-off is not appealable", () => {
    expect(classifyDenial("45").category).toBe("WRITE_OFF")
  })
  test("authorization denials are appealable and high priority", () => {
    for (const c of ["15", "197"]) {
      const d = classifyDenial(c)
      expect(d.appealable).toBe(true)
      expect(d.priority).toBe("HIGH")
    }
  })
  test("codes migrated from the curated reference are present", () => {
    for (const c of ["15", "109", "167", "204", "242", "252"]) {
      expect(CARC_CODES[c]).toBeDefined()
      expect(classifyDenial(c).description).not.toContain("Unknown")
    }
  })
  test("wrong-payer (109) routes to resubmit, not appeal", () => {
    expect(classifyDenial("109").category).toBe("RESUBMIT")
  })
  test("unknown codes fail safe — appealable, needs review", () => {
    const d = classifyDenial("99999")
    expect(d.category).toBe("APPEAL")
    expect(d.appealable).toBe(true)
  })
  test("group-prefixed input classifies the same as bare", () => {
    expect(classifyDenial("CO-197").action).toBe(classifyDenial("197").action)
  })
})

describe("classifyRarc", () => {
  test("resolves the documented remark codes", () => {
    expect(Object.keys(RARC_CODES).length).toBeGreaterThanOrEqual(10)
    expect(classifyRarc("N115")?.description).toContain("Local Coverage Determination")
    expect(classifyRarc("M127")?.action).toContain("operative report")
  })
  test("is case- and separator-insensitive", () => {
    expect(classifyRarc("n115")).toEqual(classifyRarc("N115"))
    expect(classifyRarc("N-115")).toEqual(classifyRarc("N115"))
  })
  test("returns null rather than guessing", () => {
    expect(classifyRarc("ZZ999")).toBeNull()
    expect(classifyRarc("")).toBeNull()
  })
})
