import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSessionFromRequest } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { patientId, payerName, payerId, cptCode, serviceDate, specialty } = body
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (patientId && !UUID_RE.test(patientId)) {
    return NextResponse.json({ error: "Invalid patientId" }, { status: 400 })
  }

  let sessionCount = 0
  let recentDenials: { carcCode: string; reason: string }[] = []

  if (process.env.DATABASE_URL && patientId) {
    try {
      const { prisma } = await import("@/lib/prisma")
      const [pastClaims, pastDenials] = await Promise.all([
        prisma.claim.count({
          where: {
            patientId,
            practiceId: session.practiceId,
            claimStatus: { in: ["PAID", "SUBMITTED", "ACCEPTED"] },
          },
        }),
        prisma.denial.findMany({
          where: {
            claim: { patientId, practiceId: session.practiceId },
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
      coverageNote: null,
    })
  }

  const prompt = `You are a prior authorization specialist with expertise across all outpatient medical specialties. Analyze whether prior authorization is required for this service.

Payer: ${payerName} (ID: ${payerId ?? "unknown"})
CPT Code: ${cptCode}
Specialty: ${specialty ?? "not specified"}
Service Date: ${serviceDate}
Prior claims billed to this payer for this patient: ${sessionCount}
Recent denial history: ${recentDenials.length > 0 ? recentDenials.map((d) => `CARC-${d.carcCode}: ${d.reason}`).join("; ") : "None"}

Analyze based on your knowledge of ${payerName}'s current prior authorization policies for ${specialty ?? "this service type"}:

Respond ONLY with valid JSON:
{
  "authRequired": <true | false | null — null means "cannot determine, verify directly">,
  "confidence": <"high" | "medium" | "low">,
  "summary": "<2-3 sentence plain-language summary of auth requirements for this payer/CPT>",
  "steps": ["<step 1>", "<step 2>", "<step 3>"],
  "deadline": "<how far in advance auth must be obtained, e.g. '3-5 business days before service'>",
  "sessionWarning": <null | "<warning if prior claim count is approaching typical annual or episode limits>">,
  "coverageNote": "<one sentence on any relevant coverage rules, parity laws, or limitations for this service type>",
  "payerPhone": "<prior auth phone number if known, or null>",
  "portalUrl": "<payer provider portal URL if known, or null>",
  "typicalTurnaround": "<expected auth approval time>",
  "urgentOption": "<if expedited auth is available and how to request it>"
}

Context on prior claim count:
- Many commercial plans have annual visit or episode-of-care limits that vary by specialty and plan type
- ${sessionCount} prior claims already billed — flag if approaching common limits for this specialty
- Some plans require auth for initial visits, others only after a threshold`

  try {
    const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
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
