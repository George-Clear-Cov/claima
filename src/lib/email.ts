// Azure Communication Services (ACS) Email — HIPAA-covered under the Microsoft BAA.
// Auth via ACS access-key HMAC (no SDK dependency, matching the codebase style).
// Set ACS_CONNECTION_STRING (Key Vault ref in prod). Without it, emails are logged
// (redacted) — dev/staging mode. Patient statements/outreach contain PHI, so this
// wrapper NEVER logs recipient, subject, or body.

import { createHmac, createHash } from "crypto"

const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "no-reply@claima.io"
const API_VERSION = "2023-03-31"

function parseConnectionString(cs: string): { endpoint: string; key: string } {
  // Format: endpoint=https://<res>.<region>.communication.azure.com/;accesskey=<base64>
  const parts: Record<string, string> = {}
  for (const kv of cs.split(";")) {
    const i = kv.indexOf("=")
    if (i === -1) continue
    parts[kv.slice(0, i).trim().toLowerCase()] = kv.slice(i + 1).trim()
  }
  return { endpoint: (parts["endpoint"] ?? "").replace(/\/+$/, ""), key: parts["accesskey"] ?? "" }
}

// ACS senderAddress wants a bare address; accept "Name <addr>" or plain and return the address.
function toAddress(value: string): string {
  const m = value.match(/<([^>]+)>/)
  return (m ? m[1] : value).trim()
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
}: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void> {
  if (!ACS_CONNECTION_STRING) {
    // PHI-safe: log only a redacted marker, never the recipient/subject/body.
    const domain = to.includes("@") ? to.slice(to.indexOf("@")) : "redacted"
    console.warn(`[EMAIL] No ACS_CONNECTION_STRING — email to <redacted>${domain} not sent`)
    return
  }

  const { endpoint, key } = parseConnectionString(ACS_CONNECTION_STRING)
  if (!endpoint || !key) throw new Error("ACS_CONNECTION_STRING is malformed (need endpoint + accesskey)")

  const url = new URL(`${endpoint}/emails:send?api-version=${API_VERSION}`)
  const host = url.host
  const payload = JSON.stringify({
    senderAddress: toAddress(from ?? FROM_ADDRESS),
    content: { subject, html },
    recipients: { to: [{ address: toAddress(to) }] },
  })

  // ACS access-key HMAC: sign "VERB\npath?query\nx-ms-date;host;x-ms-content-sha256".
  const contentHash = createHash("sha256").update(payload, "utf8").digest("base64")
  const date = new Date().toUTCString()
  const stringToSign = `POST\n${url.pathname}${url.search}\n${date};${host};${contentHash}`
  const signature = createHmac("sha256", Buffer.from(key, "base64"))
    .update(stringToSign, "utf8")
    .digest("base64")

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ms-date": date,
      "x-ms-content-sha256": contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    },
    body: payload,
  })

  // ACS returns 202 Accepted (queued). Any 2xx is success.
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ACS Email error ${res.status}: ${err}`)
  }
}
