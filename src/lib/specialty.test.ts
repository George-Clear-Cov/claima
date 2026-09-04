import { test, expect, describe } from "bun:test"
import { detectSpecialty, SPECIALTY_LABELS, getServiceTypeForCPT, normalizeProcCode } from "./specialty"
import { CPT_SPECIALTY_FIXTURE } from "./__fixtures__/cpt-specialty"

describe("detectSpecialty", () => {
  test("routes every code in the curated reference to the right specialty", () => {
    const misrouted = CPT_SPECIALTY_FIXTURE.filter(([cpt, want]) => detectSpecialty([cpt]) !== want).map(
      ([cpt, want]) => `${cpt}: expected ${want}, got ${detectSpecialty([cpt])}`,
    )
    expect(misrouted).toEqual([])
  })

  // Each of these was an actual ordering bug: a broad range tested first swallowed
  // another specialty's codes. They are the reason the fixture above exists.
  describe("range-ordering regressions", () => {
    test("podiatry does not swallow dermatology biopsy/skin-tag codes", () => {
      for (const c of ["11102", "11103", "11104", "11105", "11106", "11107", "11200", "11201"]) {
        expect(detectSpecialty([c])).toBe("dermatology")
      }
      // ...while podiatry keeps its own nail and callus codes
      for (const c of ["11055", "11719", "11730", "11750"]) expect(detectSpecialty([c])).toBe("podiatry")
    })

    test("physical therapy does not swallow OT cognitive intervention", () => {
      expect(detectSpecialty(["97129"])).toBe("occupational_therapy")
      expect(detectSpecialty(["97130"])).toBe("occupational_therapy")
      expect(detectSpecialty(["97110"])).toBe("physical_therapy")
    })

    test("speech does not swallow the pediatric hearing screen", () => {
      expect(detectSpecialty(["92551"])).toBe("pediatrics")
      expect(detectSpecialty(["92507"])).toBe("speech_language")
    })
  })

  describe("range gaps that were missing entirely", () => {
    test("cardiology covers vascular duplex studies", () => {
      for (const c of ["93880", "93882", "93922", "93925", "93970", "93971"]) {
        expect(detectSpecialty([c])).toBe("cardiology")
      }
    })
    test("neurology covers sleep studies", () => {
      for (const c of ["95805", "95806", "95810", "95811"]) expect(detectSpecialty([c])).toBe("neurology")
    })
    test("physical therapy covers modalities", () => {
      for (const c of ["97010", "97012", "97035"]) expect(detectSpecialty([c])).toBe("physical_therapy")
    })
    test("orthopedics covers injections below 20600", () => {
      for (const c of ["20550", "20551", "20560", "20561"]) expect(detectSpecialty([c])).toBe("orthopedics")
    })
  })

  test("HCPCS letter-prefixed codes resolve (they never parsed as ints)", () => {
    // G0105/G0121 are screening colonoscopy — directly relevant to screening-vs-diagnostic denials.
    expect(detectSpecialty(["G0105"])).toBe("gastroenterology")
    expect(detectSpecialty(["G0121"])).toBe("gastroenterology")
    expect(detectSpecialty(["G0127"])).toBe("podiatry")
  })

  test("codes that belong to more than one specialty stay unclaimed", () => {
    // Claiming these would misroute the other specialty that also bills them.
    expect(detectSpecialty(["76700"])).toBe("general_medicine") // abdominal US — used by everyone
    expect(detectSpecialty(["77002"])).toBe("general_medicine") // fluoroscopic guidance
  })

  test("unknown codes fall back to general medicine rather than guessing", () => {
    expect(detectSpecialty(["00000"])).toBe("general_medicine")
    expect(detectSpecialty([])).toBe("general_medicine")
  })

  test("first matching code in a claim wins", () => {
    expect(detectSpecialty(["45380", "99213"])).toBe("gastroenterology")
  })
})

describe("specialty metadata completeness", () => {
  test("every specialty detectable from the fixture has a label and a service type", () => {
    const specialties = new Set(CPT_SPECIALTY_FIXTURE.map(([c]) => detectSpecialty([c])))
    for (const s of specialties) {
      expect(SPECIALTY_LABELS[s as keyof typeof SPECIALTY_LABELS]).toBeTruthy()
      expect(getServiceTypeForCPT([[...CPT_SPECIALTY_FIXTURE].find(([, w]) => w === s)?.[0] ?? "99213"])).toBeTruthy()
    }
  })
  test("nephrology and pulmonology are wired end to end", () => {
    expect(detectSpecialty(["90935"])).toBe("nephrology")
    expect(detectSpecialty(["94010"])).toBe("pulmonology")
    expect(detectSpecialty(["31622"])).toBe("pulmonology")
    expect(SPECIALTY_LABELS.nephrology).toBe("Nephrology")
    expect(SPECIALTY_LABELS.pulmonology).toBe("Pulmonology")
  })
})

describe("normalizeProcCode", () => {
  // Real PM exports append internal indicators to CPTs. Before this, "45380O" matched
  // nothing: no specialty, no description, and the preventive-modifier check could not fire.
  test("strips a single trailing letter after five digits", () => {
    expect(normalizeProcCode("45380O")).toBe("45380")
    expect(normalizeProcCode("43239O")).toBe("43239")
    expect(normalizeProcCode("45384o")).toBe("45384")
  })
  test("leaves HCPCS Level II codes alone", () => {
    expect(normalizeProcCode("A4550")).toBe("A4550")
    expect(normalizeProcCode("G0105")).toBe("G0105")
  })
  test("leaves plain CPTs and junk unchanged", () => {
    expect(normalizeProcCode("99213")).toBe("99213")
    expect(normalizeProcCode("")).toBe("")
    expect(normalizeProcCode("45380OO")).toBe("45380OO") // two letters is not a known shape
  })
  test("suffixed codes route to the right specialty", () => {
    expect(detectSpecialty(["45380O"])).toBe("gastroenterology")
    expect(detectSpecialty(["43239O"])).toBe("gastroenterology")
  })
})
