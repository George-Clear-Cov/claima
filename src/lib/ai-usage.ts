/**
 * Per-practice AI usage guardrails (Layer 2 + 3 of API cost protection).
 * - checkRateLimit: in-memory burst cap per practice (per server instance).
 * - checkQuota: DB-backed daily call cap + monthly cost cap per practice.
 * - recordUsage: increments the practice's daily usage row.
 *
 * Fail-open: if the DB usage table is unavailable (e.g. not yet migrated), we
 * log and allow the call — the Anthropic console spend limit is the hard backstop.
 */

export class AiGuardError extends Error {
  reason: "rate" | "quota" | "input"
  constructor(reason: "rate" | "quota" | "input", message: string) {
    super(message)
    this.name = "AiGuardError"
    this.reason = reason
  }
}

const DAILY_CALL_CAP = Number(process.env.AI_DAILY_CALL_CAP ?? 1000)
const MONTHLY_COST_CAP_CENTS = Number(process.env.AI_MONTHLY_COST_CAP_CENTS ?? 5000) // $50
const RATE_PER_MIN = Number(process.env.AI_RATE_PER_MIN ?? 30)

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}
function monthPrefix(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

// ── Layer 3: in-memory per-practice burst limiter ──
const buckets = new Map<string, number[]>()

export function checkRateLimit(practiceId: string): void {
  const now = Date.now()
  const since = now - 60_000
  const hits = (buckets.get(practiceId) ?? []).filter((t) => t > since)
  if (hits.length >= RATE_PER_MIN) {
    throw new AiGuardError("rate", `AI rate limit reached (${RATE_PER_MIN}/min). Try again shortly.`)
  }
  hits.push(now)
  buckets.set(practiceId, hits)
}

// ── Layer 2: DB-backed daily + monthly caps ──
export async function checkQuota(practiceId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const day = today()
    const todayRow = await prisma.aiUsage.findUnique({
      where: { practiceId_day: { practiceId, day } },
      select: { calls: true },
    })
    if (todayRow && todayRow.calls >= DAILY_CALL_CAP) {
      throw new AiGuardError("quota", `Daily AI limit reached (${DAILY_CALL_CAP} calls).`)
    }
    const monthRows = await prisma.aiUsage.findMany({
      where: { practiceId, day: { startsWith: monthPrefix() } },
      select: { estCostMicros: true },
    })
    const monthMicros = monthRows.reduce((s, r) => s + r.estCostMicros, 0)
    if (monthMicros >= MONTHLY_COST_CAP_CENTS * 10_000) {
      throw new AiGuardError("quota", `Monthly AI budget reached ($${(MONTHLY_COST_CAP_CENTS / 100).toFixed(0)}).`)
    }
  } catch (e) {
    if (e instanceof AiGuardError) throw e
    console.warn("[ai-usage] checkQuota unavailable — allowing (fail-open):", (e as Error).message)
  }
}

export async function recordUsage(
  practiceId: string,
  costMicros: number,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const day = today()
    await prisma.aiUsage.upsert({
      where: { practiceId_day: { practiceId, day } },
      create: { practiceId, day, calls: 1, inputTokens, outputTokens, estCostMicros: costMicros },
      update: {
        calls: { increment: 1 },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        estCostMicros: { increment: costMicros },
      },
    })
  } catch (e) {
    console.warn("[ai-usage] recordUsage failed:", (e as Error).message)
  }
}
