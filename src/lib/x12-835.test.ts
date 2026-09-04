import { test, expect, describe } from "bun:test"
import { parse835 } from "./x12-835"

const era = (segments: string[]) =>
  [
    "ISA*00*          *00*          *ZZ*PAYER          *ZZ*CLAIMA         *260902*1200*^*00501*000000001*0*P*:~",
    "GS*HP*PAYER*CLAIMA*20260902*1200*1*X*005010X221A1~",
    "ST*835*0001~",
    "BPR*I*0*C*NON************20260902~",
    "TRN*1*12345*1999999999~",
    "N1*PR*MEDICARE~",
    "N1*PE*TEST PRACTICE*XX*1234567893~",
    ...segments,
    "SE*11*0001~", "GE*1*1~", "IEA*1*000000001~",
  ].join("")

describe("RARC extraction (LQ*HE)", () => {
  // Before the LQ segment was handled, remark codes were parsed away and lost —
  // which made the whole RARC table dead code.
  test("captures a line-level remark code", () => {
    const r = parse835(era(["CLP*A1*4*7500*0*0*MC*ICN1~", "SVC*HC:45380*7500*0**1~", "CAS*CO*197*7500~", "LQ*HE*N115~"]))
    expect(r.claims[0].lines[0].remarkCodes).toEqual(["N115"])
  })
  test("captures multiple remark codes on one line", () => {
    const r = parse835(era(["CLP*A1*4*100*0*0*MC*ICN1~", "SVC*HC:99213*100*0**1~", "LQ*HE*M127~", "LQ*HE*N382~"]))
    expect(r.claims[0].lines[0].remarkCodes).toEqual(["M127", "N382"])
  })
  test("a remark code before any SVC is claim-level, not line-level", () => {
    const r = parse835(era(["CLP*A1*4*100*0*0*MC*ICN1~", "LQ*HE*N30~", "SVC*HC:99213*100*0**1~"]))
    expect(r.claims[0].remarkCodes).toEqual(["N30"])
    expect(r.claims[0].lines[0].remarkCodes).toEqual([])
  })
  test("ignores LQ qualifiers other than HE", () => {
    const r = parse835(era(["CLP*A1*4*100*0*0*MC*ICN1~", "SVC*HC:99213*100*0**1~", "LQ*RX*SOMETHING~"]))
    expect(r.claims[0].lines[0].remarkCodes).toEqual([])
  })
  test("lines without remark codes default to an empty array, never undefined", () => {
    const r = parse835(era(["CLP*A1*1*100*80*20*MC*ICN1~", "SVC*HC:99213*100*80**1~"]))
    expect(r.claims[0].lines[0].remarkCodes).toEqual([])
    expect(r.claims[0].remarkCodes).toEqual([])
  })
})

describe("parse835 core", () => {
  test("still parses CAS adjustments alongside the new LQ handling", () => {
    const r = parse835(era(["CLP*A1*4*7500*0*0*MC*ICN1~", "SVC*HC:45380*7500*0**1~", "CAS*CO*197*7500~", "LQ*HE*N115~"]))
    const line = r.claims[0].lines[0]
    expect(line.cpt).toBe("45380")
    expect(line.adjustments.some((a) => a.reason === "197")).toBe(true)
    expect(r.claims[0].status).toBe("4") // 4 = denied
  })
})
