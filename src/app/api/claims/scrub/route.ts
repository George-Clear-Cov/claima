import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { scrubClaim, multiLineScrub } from "@/lib/claim-scrub"

const singleSchema = z.object({
  cptCode: z.string().min(5).max(5),
  icd10Codes: z.array(z.string().max(10)).min(1).max(12),
  modifier: z.string().max(10).optional(),
  payerName: z.string().max(100).optional(),
  charge: z.number().positive().optional(),
  serviceDate: z.string().optional(),
  specialty: z.string().max(100).optional(),
})

const multiSchema = z.object({
  lineItems: z.array(z.object({
    cptCode: z.string().min(5).max(5),
    modifier: z.string().max(10).optional(),
    charge: z.number().positive().optional(),
  })).min(1).max(20),
  icd10Codes: z.array(z.string().max(10)).min(1).max(12),
  payerName: z.string().max(100).optional(),
  serviceDate: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  // Multi-line path
  const multiParsed = multiSchema.safeParse(body)
  if (multiParsed.success) {
    const result = await multiLineScrub(multiParsed.data)
    return NextResponse.json(result)
  }

  // Single-line path (backwards-compatible)
  const singleParsed = singleSchema.safeParse(body)
  if (!singleParsed.success) {
    return NextResponse.json({ error: singleParsed.error.issues }, { status: 400 })
  }

  const result = await scrubClaim(singleParsed.data)
  return NextResponse.json(result)
}
