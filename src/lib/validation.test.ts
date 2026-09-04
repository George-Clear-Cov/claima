import { test, expect, describe } from "bun:test"
import { registerSchema, taxIdSchema, verifyEmailSchema } from "./validation"

const base = {
  name: "Jane Doe",
  email: "jane@example.com",
  password: "Passw0rdd",
  practiceName: "Downtown GI",
  baaAccepted: true,
}

describe("taxIdSchema", () => {
  test("normalizes a hyphenated EIN to the nine digits an 837P REF*EI needs", () => {
    expect(taxIdSchema.parse("12-3456789")).toBe("123456789")
    expect(taxIdSchema.parse(" 123456789 ")).toBe("123456789")
  })

  test("rejects anything that is not nine digits", () => {
    for (const bad of ["12345678", "1234567890", "", "abcdefghi"]) {
      expect(taxIdSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe("registerSchema", () => {
  test("still accepts the plain signup payload with no identity fields", () => {
    // The /signup page does not collect NPI or Tax ID; adding them must not break it.
    expect(registerSchema.safeParse(base).success).toBe(true)
  })

  test("accepts a check-digit-valid NPI from the activation flow", () => {
    const r = registerSchema.safeParse({
      ...base,
      npi: "1234567893",
      taxId: "12-3456789",
      servicesAgreementAccepted: true,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.npi).toBe("1234567893")
      expect(r.data.taxId).toBe("123456789")
    }
  })

  test("rejects an NPI that fails the check digit before it can reach the database", () => {
    const r = registerSchema.safeParse({ ...base, npi: "1234567890" })
    expect(r.success).toBe(false)
  })
})

describe("verifyEmailSchema", () => {
  test("accepts exactly six digits", () => {
    expect(verifyEmailSchema.safeParse({ code: "012345" }).success).toBe(true)
  })

  test("rejects short, long, and non-numeric codes", () => {
    for (const bad of ["12345", "1234567", "12345a", ""]) {
      expect(verifyEmailSchema.safeParse({ code: bad }).success).toBe(false)
    }
  })
})
