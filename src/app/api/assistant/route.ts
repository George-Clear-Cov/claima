import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export async function POST(req: NextRequest) {
  if (!client) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 503 })
  }

  const { messages, practiceId } = await req.json()

  // Fetch live billing context to ground the assistant in real data
  let context = ""
  if (process.env.DATABASE_URL && practiceId) {
    try {
      const { prisma } = await import("@/lib/prisma")

      const [claims, statements, denials] = await Promise.all([
        prisma.claim.findMany({
          where: { practiceId },
          include: {
            patient: { select: { firstName: true, lastName: true, payerName: true } },
            provider: { select: { firstName: true, lastName: true } },
            lineItems: { select: { cptCode: true } },
          },
          orderBy: { serviceDate: "desc" },
          take: 50,
        }),
        prisma.patientStatement.findMany({
          where: { patient: { practiceId } },
          select: { balanceDue: true, patientPaid: true, statementStatus: true, patientOwes: true },
        }),
        prisma.denial.findMany({
          where: { claim: { practiceId } },
          select: { carcCode: true, denialReason: true, appealStatus: true, category: true },
        }),
      ])

      const totalBilled = claims.reduce((s, c) => s + Number(c.totalCharge), 0)
      const paidClaims = claims.filter((c) => c.claimStatus === "PAID")
      const deniedClaims = claims.filter((c) => c.claimStatus === "DENIED")
      const pendingClaims = claims.filter((c) => ["SUBMITTED", "ACCEPTED"].includes(c.claimStatus))
      const totalOutstanding = statements
        .filter((s) => !["PAID", "WRITE_OFF"].includes(s.statementStatus))
        .reduce((sum, s) => sum + Number(s.balanceDue), 0)
      const totalCollected = statements.reduce((sum, s) => sum + Number(s.patientPaid), 0)
      const openDenials = denials.filter((d) => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus))

      const payerMap: Record<string, { count: number; billed: number }> = {}
      for (const claim of claims) {
        const payer = claim.patient.payerName
        if (!payerMap[payer]) payerMap[payer] = { count: 0, billed: 0 }
        payerMap[payer].count++
        payerMap[payer].billed += Number(claim.totalCharge)
      }

      const denialRate = claims.length > 0 ? Math.round((deniedClaims.length / claims.length) * 100) : 0

      context = `
LIVE PRACTICE DATA:
- Claims: ${claims.length} total — ${paidClaims.length} paid, ${deniedClaims.length} denied, ${pendingClaims.length} pending/accepted, ${claims.length - paidClaims.length - deniedClaims.length - pendingClaims.length} draft
- Revenue: $${totalBilled.toFixed(2)} billed | $${totalCollected.toFixed(2)} patient collections | $${totalOutstanding.toFixed(2)} outstanding
- Denial rate: ${denialRate}% | ${openDenials.length} open denials requiring action
- Payer mix: ${Object.entries(payerMap).map(([p, v]) => `${p}: ${v.count} claims ($${v.billed.toFixed(0)})`).join(" | ")}
${openDenials.length > 0 ? `- Open denial reasons: ${[...new Set(openDenials.map((d) => `CARC-${d.carcCode} (${d.category})`))].join(", ")}` : ""}
`
    } catch {
      // DB unavailable — proceed without context
    }
  }

  const systemPrompt = `You are Claima AI, an expert medical billing assistant for mental health outpatient practices. You help billers and providers:
- Understand and appeal insurance denials (CARC/RARC codes, appeal letter strategy)
- Optimize claim submission to minimize rejections
- Navigate prior authorization requirements
- Interpret ERA/EOB documents and remittance advice
- Manage patient billing, statements, and collections
- Understand mental health parity laws (MHPAEA)
- Benchmark collection rates and denial rates

${context ? context : ""}

Be direct and specific. Reference actual numbers from the practice data when answering. For denials, always name the CARC code and give concrete next steps. Keep answers concise — billers are busy.`

  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    stream: true,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
        controller.close()
      } catch {
        controller.error(new Error("Stream interrupted"))
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
