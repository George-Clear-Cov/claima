import { z } from "zod"
import { NextResponse } from "next/server"
import { isValidNpi, NPI_INVALID_MESSAGE } from "@/lib/npi"

// Reusable request-body schemas + a safe JSON parser. Every mutating route validates its body
// through parseJson(req, schema) so malformed / oversized / hostile payloads are rejected with a
// 400 before any DB, AI, or clearinghouse work runs (HIPAA input-validation; scripts/audit.ts).

const email = z.string().trim().toLowerCase().email().max(320)
const password = z.string().min(8).max(200)
const npi = z
  .string()
  .regex(/^\d{10}$/, "NPI must be 10 digits")
  .refine(isValidNpi, NPI_INVALID_MESSAGE)

/** Exported so every NPI entry point validates identically — see lib/npi.ts. */
export const npiSchema = npi
const optionalStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

/**
 * EIN: 9 digits, optionally hyphenated after the prefix (12-3456789). Normalized to digits
 * so the value stored is what an 837P REF*EI segment needs.
 */
export const taxIdSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^0-9]/g, ""))
  .refine((v) => /^\d{9}$/.test(v), "Tax ID (EIN) must be 9 digits")

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email,
  password,
  practiceName: z.string().trim().min(1).max(200),
  baaAccepted: z.boolean().optional(),
  // Identity + engagement, supplied by the self-serve activation flow. Optional so the
  // plain /signup page keeps working, but when a caller sends PHI-bearing data later the
  // import gate requires the practice to actually hold a real NPI.
  npi: npi.optional(),
  taxId: taxIdSchema.optional(),
  servicesAgreementAccepted: z.boolean().optional(),
})

export const verifyEmailSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(500),
  password,
})

export const azureActivateSchema = z.object({ marketplaceToken: z.string().min(1).max(4096) })

export const awsActivateSchema = z.object({ registrationToken: z.string().min(1).max(8192) })

// Azure marketplace webhook — Microsoft sends extra fields we ignore, so passthrough().
export const azureWebhookSchema = z
  .object({
    id: z.string().min(1).max(200),
    subscriptionId: z.string().min(1).max(200),
    action: z.string().min(1).max(100),
    planId: z.string().max(200).optional(),
    quantity: z.number().int().nonnegative().max(1_000_000).optional(),
    status: z.string().max(100).optional(),
  })
  .passthrough()

// Onboarding — preserve the route's "all required except taxonomy" behavior; NPI must be 10 digits
// (needed for 837P), other fields kept lenient so real-world formats (dashed tax IDs) aren't rejected.
export const onboardingSetupSchema = z.object({
  practiceName: z.string().trim().min(1).max(200),
  npi,
  taxId: z.string().trim().min(1).max(20),
  addressLine1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2),
  zip: z.string().trim().min(3).max(10),
  phone: z.string().trim().min(1).max(20),
  taxonomy: optionalStr(20),
})

export const denialRiskSchema = z.object({
  payerName: z.string().trim().min(1).max(200),
  cptCode: z.string().trim().min(1).max(10),
})

// claims/risk returns [] (not 400) for a missing/empty list, so default to [] and let the route
// short-circuit — only reject genuinely malformed input (non-string ids, >500 items).
export const claimsRiskSchema = z.object({
  claimIds: z.array(z.string().min(1).max(100)).max(500).optional().default([]),
})

export const assistantSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20000),
      }),
    )
    .min(1)
    .max(100),
})

export const importBacklogSchema = z.object({
  format: z.enum(["835", "837", "csv", "text"]),
  contents: z.array(z.string().max(5_000_000)).min(1).max(500),
  mode: z.enum(["preview", "commit"]).optional(),
  mapping: z.record(z.string(), z.string()).optional(),
})

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/**
 * Parse + validate a JSON request body against a zod schema.
 * Returns { ok: true, data } on success, or { ok: false, response } with a 400 to return directly.
 */
export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Validation failed", details: result.error.flatten() }, { status: 400 }),
    }
  }
  return { ok: true, data: result.data }
}
