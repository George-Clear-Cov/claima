import { test, expect, describe, beforeAll } from "bun:test"
import type { NextRequest } from "next/server"

// Regression guard for the signature bypass fixed in 62419d4. The handler previously
// treated a MISSING stripe-signature header as "dev mode" and skipped verification
// entirely, so an unauthenticated POST could forge payment_intent.succeeded and mark a
// patient balance paid. This class of bug is invisible to typecheck and lint.
const SECRET = "whsec_testsecretfortestingonlynotreal12345"

beforeAll(() => {
  process.env.STRIPE_V1_WEBHOOK_SECRET = SECRET
  process.env.STRIPE_WEBHOOK_SECRET ??= SECRET
  process.env.STRIPE_SECRET_KEY ??= "sk_test_placeholder"
  ;(process.env as Record<string, string>).NODE_ENV = "production"
})

// The handler only reads .text() and .headers, so a plain Request is structurally
// sufficient; the cast avoids constructing a full NextRequest in tests.
function post(body: string, headers: Record<string, string> = {}): NextRequest {
  return new Request("https://claima.io/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  }) as unknown as NextRequest
}

async function sign(payload: string, secret = SECRET) {
  const ts = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `t=${ts},v1=${hex}`
}

describe("stripe webhook signature verification", () => {
  test("rejects a POST with NO signature header", async () => {
    const { POST } = await import("./route")
    const res = await POST(post(JSON.stringify({ type: "ping" })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signature/i)
  })

  test("rejects a FORGED signature", async () => {
    const { POST } = await import("./route")
    const res = await POST(post(JSON.stringify({ type: "ping" }), { "stripe-signature": "t=1,v1=deadbeef" }) as never)
    expect(res.status).toBe(400)
  })

  test("rejects a payload signed with the WRONG secret", async () => {
    const { POST } = await import("./route")
    const payload = JSON.stringify({ type: "ping" })
    const res = await POST(post(payload, { "stripe-signature": await sign(payload, "whsec_wrongsecret000000000000000000") }) as never)
    expect(res.status).toBe(400)
  })

  test("a forged payment_intent.succeeded cannot mark a statement paid", async () => {
    // The concrete exploit: without verification this would settle a patient balance.
    const { POST } = await import("./route")
    const payload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_forged", metadata: { statementId: "forged-statement-id" } } },
    })
    const res = await POST(post(payload) as never)
    expect(res.status).toBe(400)
  })
})
