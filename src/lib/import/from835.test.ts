import { test, expect, describe } from "bun:test"
import { parse835Backlog } from "./from835"

const era = (segs: string[]) =>
  [
    "ISA*00*          *00*          *ZZ*PAYER          *ZZ*CLAIMA         *260902*1200*^*00501*000000001*0*P*:~",
    "GS*HP*PAYER*CLAIMA*20260902*1200*1*X*005010X221A1~", "ST*835*0001~",
    "BPR*I*0*C*NON************20260902~", "TRN*1*12345*1999999999~",
    "N1*PR*MEDICARE~", "N1*PE*TEST PRACTICE*XX*1234567893~",
    ...segs, "SE*11*0001~", "GE*1*1~", "IEA*1*000000001~",
  ].join("")

describe("835 backlog import", () => {
  test("a denied claim yields status, CARC and RARC together", () => {
    // This is why the 835 beats a 277 for recovery work: a 277 gives status only.
    const r = parse835Backlog([
      era(["CLP*ACCT1*4*7500*0*0*MC*ICN1~", "SVC*HC:45380*7500*0**1~", "CAS*CO*197*7500~", "LQ*HE*N115~"]),
    ])
    const rec = r.records[0]
    expect(rec.status).toBe("denied")
    expect(rec.carcCodes).toContain("197")
    expect(rec.rarcCodes).toContain("N115")
    expect(rec.externalClaimId).toBe("ACCT1")
  })
  test("a paid claim is not flagged as denied", () => {
    const r = parse835Backlog([era(["CLP*ACCT2*1*100*80*20*MC*ICN2~", "SVC*HC:99213*100*80**1~"])])
    expect(r.records[0].status).toBe("paid")
  })
  test("claim-level remark codes are captured alongside line-level", () => {
    const r = parse835Backlog([
      era(["CLP*ACCT3*4*100*0*0*MC*ICN3~", "LQ*HE*N30~", "SVC*HC:99213*100*0**1~", "LQ*HE*M127~"]),
    ])
    expect(r.records[0].rarcCodes).toEqual(expect.arrayContaining(["N30", "M127"]))
  })
  test("records without remark codes leave rarcCodes undefined, not empty noise", () => {
    const r = parse835Backlog([era(["CLP*ACCT4*1*100*100*0*MC*ICN4~", "SVC*HC:99213*100*100**1~"])])
    expect(r.records[0].rarcCodes).toBeUndefined()
  })
})
