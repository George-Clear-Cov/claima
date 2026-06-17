import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSession } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { patientId, payerName, payerId, cptCode, serviceDate } = await req.json()

  // Count prior sessions for this patient
  let sessionCount = 0
  let recentDenials: { carcCode: string; reason: string }[] = []

  if (process.env.DATABASE_URL && patientId) {
    try {
      const { prisma } = await import("@/lib/prisma")
      const [pastClaims, pastDenials] = await Promise.all([
        prisma.claim.count({
          where: {
            patientId,
            claimStatus: { in: ["PAID", "SUBMITTED", "ACCEPTED"] },
          },
        }),
        prisma.denial.findMany({
          where: {
            claim: { patientId },
            appealStatus: { in: ["PENDING", "IN_PROGRESS", "LOST"] },
          },
          select: { carcCode: true, denialReason: true },
          take: 3,
        }),
      ])
      sessionCount = pastClaims
      recentDenials = pastDenials.map((d) => ({ carcCode: d.carcCode, reason: d.denialReason }))
    } catch {}
  }

  if (!isAIConfigured()) {
    return NextResponse.json({
      authRequired: null,
      confidence: "low",
      summary: "ANTHROPIC_API_KEY required for prior auth analysis.",
      steps: [],
      deadline: null,
      sessionWarning: null,
      parityCoverage: null,
    })
  }

  const prompt = `You are a prior authorization specialist for mental health outpatient services. Analyze whether prior authorization is required for this upcoming session.

Payer: ${payerName} (ID: ${payerId ?? "unknown"})
CPT Code: ${cptCode}
Service Date: ${serviceDate}
Patient's prior sessions billed to this payer: ${sessionCount}
Recent denial history for this patient: ${recentDenials.length > 0 ? recentDenials.map((d) => `CARC-${d.carcCode}: ${d.reason}`).join("; ") : "None"}

Analyze based on your knowledge of ${payerName}'s current prior authorization policies for mental health outpatient services:

Respond ONLY with valid JSON:
{
  "authRequired": <true | false | null — null means "cannot determine, verify directly">,
  "confidence": <"high" | "medium" | "low">,
  "summary": "<2-3 sentence plain-language summary of auth requirements for this payer/CPT>",
  "steps": ["<step 1>", "<step 2>", "<step 3>"],
  "deadline": "<how far in advance auth must be obtained, e.g. '3-5 business days before service'>",
  "sessionWarning": <null | "<warning if session count is approaching typical annual limit>"> ,
  "parityCoverage": "<one sentence on MHPAEA parity protections for this service type>",
  "payerPhone": "<prior auth phone number if known, or null>",
  "portalUrl": "<payer provider portal URL if known, or null>",
  "typicalTurnaround": "<expected auth approval time, e.g. '3-5 business days'>",
  "urgentOption": "<if same-day auth is available and how to get it>"
}

For session count context:
- Most commercial plans limit outpatient mental health to 20-52 sessions/year depending on plan type
- MHPAEA requires parity with medical/surgical benefits
- Some plans auto-approve initial 8-12 sessions, then require auth for continuation
- ${sessionCount} sessions already billed — flag if approaching typical limits`

  try {
    const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
    // Strip code fences if present, then extract JSON object
    const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in response: ${text.slice(0, 200)}`)
    return NextResponse.json(JSON.parse(match[0]))
  } catch (err) {
    console.error("[auth-check] failed:", err)
    const msg = err instanceof Error ? err.message : "Auth check failed"
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
