// Thin wrapper around Resend's REST API — no SDK package required.
// Set RESEND_API_KEY in Vercel to enable email delivery.
// Without the key, emails are logged to console (dev/staging mode).

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Claima <no-reply@claima.io>"

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
  if (!RESEND_API_KEY) {
    // [PLACEHOLDER] Add RESEND_API_KEY to Vercel env vars to enable real email delivery.
    // Get a free key at resend.com — free tier sends 3,000 emails/month.
    console.warn(`[EMAIL] No RESEND_API_KEY — would have sent to ${to}:`)
    console.warn(`[EMAIL] Subject: ${subject}`)
    console.warn(`[EMAIL] Body: ${html.replace(/<[^>]+>/g, "")}`)
    return
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: from ?? FROM_ADDRESS, to, subject, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend API error ${res.status}: ${err}`)
  }
}
