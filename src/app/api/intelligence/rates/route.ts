import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSessionFromRequest } from "@/lib/auth"

interface RateRow {
  payer: string
  cptCode: string
  claims: number
  avgBilled: number
  avgPaid: number
  collectionRate: number
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const paidClaims = await prisma.claim.findMany({
    where: {
      practiceId: session.practiceId,
      claimStatus: "PAID",
      paidAmount: { not: null },
    },
    select: {
      totalCharge: true,
      paidAmount: true,
      patient: { select: { payerName: true } },
      lineItems: { select: { cptCode: true, chargeAmount: true } },
    },
  })

  // Aggregate per payer × CPT
  const map: Record<string, { billedSum: number; paidSum: number; count: number }> = {}

  for (const claim of paidClaims) {
    const payer = claim.patient.payerName
    const paidTotal = Number(claim.paidAmount ?? 0)
    const billedTotal = Number(claim.totalCharge)
    // Distribute paid amount proportionally across line items by charge
    for (const li of claim.lineItems) {
      const key = `${payer}::${li.cptCode}`
      if (!map[key]) map[key] = { billedSum: 0, paidSum: 0, count: 0 }
      const liCharge = Number(li.chargeAmount)
      const liPaidShare = billedTotal > 0 ? (liCharge / billedTotal) * paidTotal : 0
      map[key].billedSum += liCharge
      map[key].paidSum += liPaidShare
      map[key].count++
    }
  }

  const rates: RateRow[] = Object.entries(map)
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => {
      const [payer, cptCode] = key.split("::")
      const avgBilled = Math.round((v.billedSum / v.count) * 100) / 100
      const avgPaid = Math.round((v.paidSum / v.count) * 100) / 100
      const collectionRate = Math.round((avgPaid / avgBilled) * 100)
      return { payer, cptCode, claims: v.count, avgBilled, avgPaid, collectionRate }
    })
    .sort((a, b) => a.collectionRate - b.collectionRate)

  // Expected collection rates by CPT (industry benchmarks across all outpatient specialties)
  const BENCHMARKS: Record<string, number> = {
    // E&M — office visits
    "99202": 80, "99203": 80, "99204": 80, "99205": 78,
    "99211": 85, "99212": 83, "99213": 82, "99214": 81, "99215": 79,
    // Preventive medicine
    "99385": 82, "99386": 82, "99395": 82, "99396": 82,
    "99381": 85, "99382": 85, "99383": 85, "99384": 85,
    "99391": 85, "99392": 85, "99393": 85, "99394": 85, "99397": 82,
    "G0438": 88, "G0439": 88, "G0402": 88,
    // Behavioral health — psychotherapy
    "90791": 72, "90792": 74,
    "90832": 70, "90834": 70, "90837": 70,
    "90833": 68, "90836": 68, "90838": 68,
    "90839": 75, "90840": 73,
    "90846": 68, "90847": 68, "90853": 65,
    "90785": 68,
    // Psychology testing
    "96130": 68, "96131": 66, "96132": 68, "96133": 66,
    "96136": 65, "96137": 63,
    // Physical therapy
    "97161": 78, "97162": 78, "97163": 78, "97164": 76,
    "97110": 75, "97140": 75, "97530": 73, "97112": 74,
    "97116": 73, "97035": 72, "97014": 70, "97012": 70,
    "97010": 65, "97032": 72, "97124": 70,
    // Occupational therapy
    "97165": 78, "97166": 78, "97167": 78, "97168": 76,
    "97129": 72, "97130": 70,
    // Speech therapy
    "92521": 76, "92522": 76, "92523": 76, "92524": 74,
    "92507": 74, "92508": 70, "92526": 73, "92610": 76,
    // Chiropractic
    "98940": 68, "98941": 68, "98942": 67, "98943": 66,
    // Cardiology
    "93000": 82, "93010": 80, "93306": 80, "93308": 78,
    "93015": 78, "93016": 76, "93018": 76,
    "93224": 76, "93880": 78, "93970": 78, "93971": 78,
    // Neurology
    "95816": 76, "95819": 76, "95860": 78, "95861": 78,
    "95907": 78, "95908": 78, "95910": 78,
    "95806": 74, "95810": 74,
    // Dermatology
    "11102": 82, "11104": 82, "11106": 82,
    "17000": 80, "17003": 78, "17110": 80, "17260": 82,
    "11200": 78, "10060": 82, "10061": 82,
    // Gastroenterology
    "45378": 80, "45380": 82, "45385": 82, "45390": 82,
    "43239": 80, "43251": 80,
    "G0105": 88, "G0121": 88,
    // Orthopedics
    "20610": 82, "20611": 82, "20605": 82, "20600": 80,
    "20552": 78, "20553": 78,
    "29125": 80, "29515": 80, "29530": 80, "29540": 80,
    // Podiatry
    "11720": 78, "11721": 78, "11730": 80, "11750": 82,
    "11055": 76, "11056": 76, "11057": 76,
    "97597": 78, "97598": 78, "64455": 80,
    // OB/GYN
    "58300": 82, "58301": 80, "57454": 82, "57461": 84,
    "76805": 82, "59025": 80, "88142": 85, "87624": 85,
    // Optometry
    "92004": 76, "92012": 76, "92014": 78,
    "92082": 74, "92083": 74, "92134": 76, "92250": 74,
    // Allergy
    "95004": 80, "95024": 80, "95115": 78, "95117": 78,
    "95165": 76, "95044": 78,
    // Endocrinology
    "95250": 78, "95251": 76, "77080": 82, "76536": 80,
    // Rheumatology
    "96365": 76, "96366": 74,
    // Urology
    "52000": 82, "52204": 82, "55700": 82, "51701": 80,
    // Primary care labs / diagnostics
    "85025": 88, "80053": 88, "80061": 88,
    "83036": 88, "81003": 88, "36415": 90,
  }

  const underpaid = rates.filter((r) => {
    const benchmark = BENCHMARKS[r.cptCode] ?? 70
    return r.collectionRate < benchmark - 5
  })

  let insights: string[] = []

  if (isAIConfigured() && rates.length > 0) {
    try {
      const prompt = `You are a medical billing analyst reviewing an outpatient practice's payer rate performance.

Rate data (per payer × CPT code):
${rates.slice(0, 15).map((r) => `  ${r.payer} / CPT ${r.cptCode}: ${r.claims} claims, avg billed $${r.avgBilled}, avg paid $${r.avgPaid} (${r.collectionRate}% collection rate)`).join("\n")}

Industry benchmarks vary by specialty: E&M codes typically 78-82%, therapy codes 65-75%, procedures vary widely.

Provide 2-3 specific, actionable insights. Respond ONLY with valid JSON:
["<insight 1>", "<insight 2>", "<insight 3>"]

Be specific: name payers, CPT codes, and dollar amounts. Focus on: underpayment, renegotiation opportunities, claim patterns.`

      const raw = await aiComplete({ max_tokens: 512, tier: "fast", label: "rate-estimate", messages: [{ role: "user", content: prompt }] })
      const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
      const match = stripped.match(/\[[\s\S]*\]/)
      if (match) insights = JSON.parse(match[0])
    } catch (err) {
      console.error("[intelligence/rates] failed:", err)
    }
  }

  return NextResponse.json({ rates, underpaid, insights })
}
