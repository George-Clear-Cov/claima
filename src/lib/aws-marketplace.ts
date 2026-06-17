/**
 * AWS Marketplace SaaS integration.
 *
 * API: AWS Marketplace Metering Service (us-east-1 only)
 * Docs: https://docs.aws.amazon.com/marketplace/latest/userguide/saas-integrate.html
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   AWS_MARKETPLACE_PRODUCT_CODE
 *   AWS_MARKETPLACE_REGION (default: us-east-1)
 */

import { createHmac, createHash } from "crypto"

const REGION = process.env.AWS_MARKETPLACE_REGION ?? "us-east-1"
const PRODUCT_CODE = process.env.AWS_MARKETPLACE_PRODUCT_CODE ?? ""

// ── SigV4 (shared with ai.ts logic — minimal reimplementation here) ───────────

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest()
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex")
}

function meteringHeaders(
  action: string,
  bodyJson: string,
): Record<string, string> {
  const accessKey = process.env.AWS_ACCESS_KEY_ID!
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY!
  const sessionToken = process.env.AWS_SESSION_TOKEN

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z"
  const dateStamp = amzDate.slice(0, 8)
  const host = `metering.marketplace.${REGION}.amazonaws.com`
  const service = "aws-marketplace"
  const payloadHash = sha256hex(bodyJson)

  const rawHeaders: Record<string, string> = {
    host,
    "content-type": "application/x-amz-json-1.1",
    "x-amz-date": amzDate,
    "x-amz-target": `AWSMPMeteringService.${action}`,
    "x-amz-content-sha256": payloadHash,
  }
  if (sessionToken) rawHeaders["x-amz-security-token"] = sessionToken

  const sortedKeys = Object.keys(rawHeaders).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${rawHeaders[k]}`).join("\n") + "\n"
  const signedHeaders = sortedKeys.join(";")
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope = `${dateStamp}/${REGION}/${service}/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n")
  const signingKey = hmacSHA256(
    hmacSHA256(hmacSHA256(hmacSHA256(Buffer.from(`AWS4${secretKey}`), dateStamp), REGION), service),
    "aws4_request",
  )
  const signature = hmacSHA256(signingKey, stringToSign).toString("hex")

  return {
    ...rawHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

async function meteringRequest<T>(action: string, body: unknown): Promise<T> {
  const bodyJson = JSON.stringify(body)
  const headers = meteringHeaders(action, bodyJson)
  const endpoint = `https://metering.marketplace.${REGION}.amazonaws.com`

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: bodyJson,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AWS Metering ${action} error ${res.status}: ${err}`)
  }

  return res.json() as Promise<T>
}

/** Resolves a registration token from the marketplace landing page into a CustomerIdentifier. */
export async function resolveCustomer(registrationToken: string): Promise<{
  CustomerIdentifier: string
  ProductCode: string
  CustomerAWSAccountId: string
}> {
  return meteringRequest("ResolveCustomer", { RegistrationToken: registrationToken })
}

/** Records usage for a customer. Call this on billing cycle (daily/monthly). */
export async function meterUsage(params: {
  customerId: string
  dimension: string
  quantity: number
  timestamp?: Date
}): Promise<{ MeteringRecordId: string }> {
  return meteringRequest("MeterUsage", {
    ProductCode: PRODUCT_CODE,
    UsageDimension: params.dimension,
    UsageQuantity: params.quantity,
    CustomerIdentifier: params.customerId,
    Timestamp: Math.floor((params.timestamp ?? new Date()).getTime() / 1000),
  })
}

/** Batch meter usage records (max 25 per call). */
export async function batchMeterUsage(
  records: Array<{ customerId: string; dimension: string; quantity: number }>,
  timestamp: Date = new Date(),
): Promise<{ Results: Array<{ MeteringRecordId: string; Status: string }> }> {
  return meteringRequest("BatchMeterUsage", {
    ProductCode: PRODUCT_CODE,
    UsageRecords: records.map((r) => ({
      CustomerIdentifier: r.customerId,
      Dimension: r.dimension,
      Quantity: r.quantity,
      Timestamp: Math.floor(timestamp.getTime() / 1000),
    })),
  })
}

export function isAwsMarketplaceConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_MARKETPLACE_PRODUCT_CODE
  )
}
