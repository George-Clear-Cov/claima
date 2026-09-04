import { test, expect, describe } from "bun:test"
import { isValidNpi, isSyntheticNpi, isPlaceholderNpi, practiceNpiIsUsable, npiCheckDigit } from "./npi"

// 1234567893 is the canonical CMS example: base 123456789 + check digit 3.
const VALID = "1234567893"

describe("check digit", () => {
  test("computes the CMS example correctly", () => {
    expect(npiCheckDigit("123456789")).toBe(3)
    expect(isValidNpi(VALID)).toBe(true)
  })

  test("rejects a transposed digit", () => {
    expect(isValidNpi("1234567839")).toBe(false)
  })

  test("rejects anything that is not exactly ten digits", () => {
    for (const bad of ["", "123456789", "12345678931", "123456789a", "123-456-7893"]) {
      expect(isValidNpi(bad)).toBe(false)
    }
  })
})

describe("placeholders", () => {
  test("tells the two placeholder kinds apart", () => {
    // They come from different places and mean different things: PENDING- means we do not
    // know who the practice is; IMPORT- means a claim has no real rendering provider yet.
    expect(isPlaceholderNpi("PENDING-abc-123")).toBe(true)
    expect(isSyntheticNpi("PENDING-abc-123")).toBe(false)
    expect(isSyntheticNpi("IMPORT-abc-123")).toBe(true)
    expect(isPlaceholderNpi("IMPORT-abc-123")).toBe(false)
  })
})

describe("practiceNpiIsUsable — the PHI ingress gate", () => {
  test("accepts only a real, check-digit-valid NPI", () => {
    expect(practiceNpiIsUsable(VALID)).toBe(true)
  })

  test("rejects the registration placeholder", () => {
    // This is the regression that matters: before the gate, a practice created by the
    // self-serve flow carried PENDING-<uuid> and could still push a full A/R backlog.
    expect(practiceNpiIsUsable("PENDING-9f3c2b1a-0000-4444-8888-abcdefabcdef")).toBe(false)
  })

  test("rejects the import provider placeholder and empty values", () => {
    expect(practiceNpiIsUsable("IMPORT-9f3c2b1a")).toBe(false)
    expect(practiceNpiIsUsable(null)).toBe(false)
    expect(practiceNpiIsUsable(undefined)).toBe(false)
    expect(practiceNpiIsUsable("")).toBe(false)
  })

  test("rejects a well-formed but check-digit-invalid NPI", () => {
    expect(practiceNpiIsUsable("1234567890")).toBe(false)
  })
})
