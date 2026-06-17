import { createHmac, createHash } from "crypto"
import Anthropic from "@anthropic-ai/sdk"

type Provider = "anthropic" | "bedrock" | "azure"

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

const ANTHROPIC_MODEL = "claude-sonnet-4-6"

async function anthropicComplete(params: AIMessageParams): Promise<string> {
  const client = getAnthropicClient()
  const msg = await client.messages.create({ model: ANTHROPIC_MODEL, ...params })
  const block = msg.content[0]
  return block.type === "text" ? block.text : ""
}

async function* anthropicStream(params: AIMessageParams): AsyncGenerator<string> {
  const client = getAnthropicClient()
  const stream = await client.messages.create({ model: ANTHROPIC_MODEL, ...params, stream: true })
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text
    }
  }
}

// ── Amazon Bedrock (SigV4 signed fetch) ───────────────────────────────────────

const BEDROCK_MODEL =
  process.env.AWS_BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-6-20260909-v1:0"

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

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: params.max_tokens,
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
  })

  const path = `/model/${encodeURIComponent(BEDROCK_MODEL)}/invoke`
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

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
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

function azureUrl(path: string): string {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "")
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "claude-sonnet"
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview"
  return `${endpoint}/openai/deployments/${deployment}/${path}?api-version=${apiVersion}`
}

async function azureComplete(params: AIMessageParams): Promise<string> {
  const res = await fetch(azureUrl("chat/completions"), {
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
  }
  return data.choices?.[0]?.message?.content ?? ""
}

async function* azureStream(params: AIMessageParams): AsyncGenerator<string> {
  const res = await fetch(azureUrl("chat/completions"), {
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
