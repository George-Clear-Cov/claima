import { createHmac, createHash } from "crypto"
import Anthropic from "@anthropic-ai/sdk"

type Provider = "anthropic" | "bedrock" | "azure"
type Tier = "fast" | "smart"

function getProvider(): Provider {
  const explicit = process.env.AI_PROVIDER as Provider | undefined
  if (explicit) return explicit
  if (process.env.AWS_BEDROCK_REGION && process.env.AWS_ACCESS_KEY_ID) return "bedrock"
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) return "azure"
  return "anthropic"
}

export interface AIMessageParams {
  max_tokens: number
  system?: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  temperature?: number
  /** "fast" routes to Haiku (cheaper, for simple parse/interpret/summary tasks). Default "smart" (Sonnet). */
  tier?: Tier
  /** Short label for cost attribution in logs, e.g. "claim-scrub". */
  label?: string
}

export function isAIConfigured(): boolean {
  const p = getProvider()
  if (p === "bedrock")
    return !!(
      process.env.AWS_BEDROCK_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    )
  if (p === "azure")
    return !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY)
  return !!process.env.ANTHROPIC_API_KEY
}

// ── Model selection & pricing ───────────────────────────────────────────────────

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
const ANTHROPIC_FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5-20251001"
const BEDROCK_MODEL =
  process.env.AWS_BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-6-20260909-v1:0"

function pickModel(provider: Provider, tier?: Tier): string {
  const fast = tier === "fast"
  if (provider === "bedrock")
    return fast
      ? process.env.AWS_BEDROCK_MODEL_ID_FAST ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0"
      : BEDROCK_MODEL
  if (provider === "azure")
    return fast
      ? process.env.AZURE_OPENAI_DEPLOYMENT_FAST ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? "claude-sonnet"
      : process.env.AZURE_OPENAI_DEPLOYMENT ?? "claude-sonnet"
  return fast ? ANTHROPIC_FAST_MODEL : ANTHROPIC_MODEL
}

// USD per million tokens. Update if Anthropic changes pricing.
function priceFor(model: string): { in: number; out: number; cw: number; cr: number } {
  if (/haiku/i.test(model)) return { in: 1, out: 5, cw: 1.25, cr: 0.1 }
  return { in: 3, out: 15, cw: 3.75, cr: 0.3 } // sonnet (default)
}

interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/** PHI-safe: logs token counts + estimated cost only, never prompt content. Disable with AI_COST_LOG=0. */
function logUsage(model: string, label: string | undefined, u: Usage | undefined): void {
  if (process.env.AI_COST_LOG === "0" || !u) return
  const p = priceFor(model)
  const i = u.input_tokens ?? 0
  const o = u.output_tokens ?? 0
  const cr = u.cache_read_input_tokens ?? 0
  const cw = u.cache_creation_input_tokens ?? 0
  const cost = (i * p.in + o * p.out + cw * p.cw + cr * p.cr) / 1e6
  const tag = /haiku/i.test(model) ? "haiku" : "sonnet"
  console.log(
    `[ai-cost] ${label ?? "ai"} ${tag} in=${i} out=${o}` +
      `${cr ? ` cacheRead=${cr}` : ""}${cw ? ` cacheWrite=${cw}` : ""} ~$${cost.toFixed(4)}`,
  )
}

/** Cache large, reusable system prompts (5-min TTL). Small/absent system prompts are sent as-is. */
function anthropicSystem(system?: string): string | unknown[] | undefined {
  if (!system) return undefined
  if (process.env.AI_PROMPT_CACHE === "0" || system.length < 1024) return system
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
}

/** Returns plain text from AI. Throws on error. */
export async function aiComplete(params: AIMessageParams): Promise<string> {
  const p = getProvider()
  if (p === "bedrock") return bedrockComplete(params)
  if (p === "azure") return azureComplete(params)
  return anthropicComplete(params)
}

/** Yields text chunks for streaming. */
export async function* aiStream(params: AIMessageParams): AsyncGenerator<string> {
  const p = getProvider()
  if (p === "bedrock") {
    yield* bedrockStream(params)
  } else if (p === "azure") {
    yield* azureStream(params)
  } else {
    yield* anthropicStream(params)
  }
}

// ── Anthropic direct ──────────────────────────────────────────────────────────

let _anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropicClient
}

async function anthropicComplete(params: AIMessageParams): Promise<string> {
  const client = getAnthropicClient()
  const model = pickModel("anthropic", params.tier)
  const msg = await client.messages.create({
    model,
    max_tokens: params.max_tokens,
    messages: params.messages,
    ...(anthropicSystem(params.system) ? { system: anthropicSystem(params.system) as never } : {}),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
  })
  logUsage(model, params.label, msg.usage)
  const block = msg.content[0]
  return block.type === "text" ? block.text : ""
}

async function* anthropicStream(params: AIMessageParams): AsyncGenerator<string> {
  const client = getAnthropicClient()
  const model = pickModel("anthropic", params.tier)
  const stream = await client.messages.create({
    model,
    max_tokens: params.max_tokens,
    messages: params.messages,
    ...(anthropicSystem(params.system) ? { system: anthropicSystem(params.system) as never } : {}),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    stream: true,
  })
  const usage: Usage = {}
  for await (const event of stream) {
    if (event.type === "message_start") {
      const u = event.message.usage
      usage.input_tokens = u.input_tokens
      usage.cache_read_input_tokens = u.cache_read_input_tokens ?? undefined
      usage.cache_creation_input_tokens = u.cache_creation_input_tokens ?? undefined
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text
    } else if (event.type === "message_delta") {
      usage.output_tokens = event.usage.output_tokens ?? usage.output_tokens
    }
  }
  logUsage(model, params.label, usage)
}

// ── Amazon Bedrock (SigV4 signed fetch) ───────────────────────────────────────

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest()
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex")
}

function sigV4Headers(
  method: string,
  path: string,
  region: string,
  service: string,
  body: string,
  accessKey: string,
  secretKey: string,
  sessionToken?: string,
): Record<string, string> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z"
  const dateStamp = amzDate.slice(0, 8)
  const host = `${service}.${region}.amazonaws.com`
  const payloadHash = sha256hex(body)

  const rawHeaders: Record<string, string> = {
    host,
    "content-type": "application/json",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }
  if (sessionToken) rawHeaders["x-amz-security-token"] = sessionToken

  const sortedKeys = Object.keys(rawHeaders).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${rawHeaders[k]}`).join("\n") + "\n"
  const signedHeaders = sortedKeys.join(";")
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n")

  const signingKey = hmacSHA256(
    hmacSHA256(
      hmacSHA256(hmacSHA256(Buffer.from(`AWS4${secretKey}`), dateStamp), region),
      service,
    ),
    "aws4_request",
  )
  const signature = hmacSHA256(signingKey, stringToSign).toString("hex")

  return {
    ...rawHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

async function bedrockComplete(params: AIMessageParams): Promise<string> {
  const region = process.env.AWS_BEDROCK_REGION!
  const accessKey = process.env.AWS_ACCESS_KEY_ID!
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY!
  const sessionToken = process.env.AWS_SESSION_TOKEN
  const model = pickModel("bedrock", params.tier)

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: params.max_tokens,
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
  })

  const path = `/model/${encodeURIComponent(model)}/invoke`
  const headers = sigV4Headers(
    "POST",
    path,
    region,
    "bedrock-runtime",
    body,
    accessKey,
    secretKey,
    sessionToken,
  )

  const res = await fetch(`https://bedrock-runtime.${region}.amazonaws.com${path}`, {
    method: "POST",
    headers,
    body,
  })

  if (!res.ok) throw new Error(`Bedrock error ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>
    usage?: Usage
  }
  logUsage(model, params.label, data.usage)
  const block = data.content?.[0]
  return block?.type === "text" ? block.text : ""
}

// Bedrock streaming uses binary AWS event stream — fall back to one-shot and yield
async function* bedrockStream(params: AIMessageParams): AsyncGenerator<string> {
  yield await bedrockComplete(params)
}

// ── Azure OpenAI ──────────────────────────────────────────────────────────────

function toAzureMessages(params: AIMessageParams): Array<{ role: string; content: string }> {
  const msgs: Array<{ role: string; content: string }> = []
  if (params.system) msgs.push({ role: "system", content: params.system })
  msgs.push(...params.messages)
  return msgs
}

function azureUrl(deployment: string, path: string): string {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "")
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview"
  return `${endpoint}/openai/deployments/${deployment}/${path}?api-version=${apiVersion}`
}

async function azureComplete(params: AIMessageParams): Promise<string> {
  const deployment = pickModel("azure", params.tier)
  const res = await fetch(azureUrl(deployment, "chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.AZURE_OPENAI_KEY!,
    },
    body: JSON.stringify({
      messages: toAzureMessages(params),
      max_tokens: params.max_tokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    }),
  })

  if (!res.ok) throw new Error(`Azure OpenAI error ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  logUsage(deployment, params.label, {
    input_tokens: data.usage?.prompt_tokens,
    output_tokens: data.usage?.completion_tokens,
  })
  return data.choices?.[0]?.message?.content ?? ""
}

async function* azureStream(params: AIMessageParams): AsyncGenerator<string> {
  const deployment = pickModel("azure", params.tier)
  const res = await fetch(azureUrl(deployment, "chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.AZURE_OPENAI_KEY!,
    },
    body: JSON.stringify({
      messages: toAzureMessages(params),
      max_tokens: params.max_tokens,
      stream: true,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    }),
  })

  if (!res.ok) throw new Error(`Azure OpenAI stream error ${res.status}`)
  if (!res.body) throw new Error("No response body from Azure OpenAI")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const json = line.slice(6).trim()
      if (json === "[DONE]") return
      try {
        const chunk = JSON.parse(json) as {
          choices: Array<{ delta: { content?: string } }>
        }
        const content = chunk.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // malformed SSE chunk
      }
    }
  }
}
