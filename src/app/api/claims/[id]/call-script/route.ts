import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Database required" }, { status: 503 })

  const { id } = await params
  const { prisma } = await import("@/lib/prisma")

  const claim = await prisma.claim.findUnique({
    where: { id, practiceId: session.practiceId },
    include: {
      patient: true,
      provider: true,
      lineItems: true,
      practice: { select: { name: true, npi: true, phone: true } },
    },
  })

  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 })

  const daysPending = claim.submittedAt
    ? Math.floor((Date.now() - new Date(claim.submittedAt).getTime()) / 86400000)
    : 0

  const cptCodes = claim.lineItems.map((l) => l.cptCode).join(", ")
  const serviceDate = new Date(claim.serviceDate).toLocaleDateString("en-US")
  const submittedDate = claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString("en-US") : "unknown"

  if (!client) {
    return NextResponse.json(fallbackScript({ claim, daysPending, cptCodes, serviceDate, submittedDate }))
  }

  const prompt = `You are a medical billing expert. Generate a verbatim phone call script for a biller following up on an unpaid insurance claim.

Practice: ${claim.practice.name} | NPI: ${claim.practice.npi}
Provider: Dr. ${claim.provider.firstName} ${claim.provider.lastName}
Patient: ${claim.patient.firstName} ${claim.patient.lastName} | DOB: ${new Date(claim.patient.dob).toLocaleDateString("en-US")} | Member ID: ${claim.patient.memberId}
Payer: ${claim.patient.payerName} | Payer ID: ${claim.patient.payerId}
Service Date: ${serviceDate}
CPT Codes: ${cptCodes}
Total Charge: $${Number(claim.totalCharge).toFixed(2)}
Submitted: ${submittedDate} (${daysPending} days ago)
Claim Status: ${claim.claimStatus}

Write a complete, professional phone call script the biller reads verbatim. Include:
1. Opening / verification intro
2. What information to have ready before calling
3. Exact words for each step (greeting, identifying self, requesting info)
4. What to ask: claim status, processing date, any issues, expected payment date
5. What to do if denied / pending / lost
6. How to close the call and document it

Use natural, professional language. Mark placeholders like [CLAIM NUMBER] where the biller fills in data.

Respond ONLY with JSON:
{
  "providerLine": "<the phone number to call — payer provider services>",
  "bestTimeToCall": "<when to call for shortest hold times>",
  "infoToHaveReady": ["<item>", "<item>"],
  "script": "<full verbatim script with clear section headers like 'OPENING:', 'MAIN REQUEST:', etc., using newlines for readability>",
  "documentationNote": "<what to write in the claim notes after the call>"
}`

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const raw = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")

    return NextResponse.json(JSON.parse(match[0]))
  } catch (err) {
    console.error("[call-script] failed:", err)
    return NextResponse.json(fallbackScript({ claim, daysPending, cptCodes, serviceDate, submittedDate }))
  }
}

function fallbackScript({ claim, daysPending, cptCodes, serviceDate, submittedDate }: {
  claim: { patient: { firstName: string; lastName: string; memberId: string; payerName: string }; provider: { firstName: string; lastName: string }; practice: { name: string; npi: string }; totalCharge: unknown }
  daysPending: number
  cptCodes: string
  serviceDate: string
  submittedDate: string
}) {
  return {
    providerLine: "Call payer's provider services line (back of insurance card)",
    bestTimeToCall: "Tuesday–Thursday, 10am–2pm local time (avoid Monday mornings and Friday afternoons)",
    infoToHaveReady: [
      `Practice NPI: ${claim.practice.npi}`,
      `Patient member ID: ${claim.patient.memberId}`,
      `Date of service: ${serviceDate}`,
      `CPT codes: ${cptCodes}`,
      `Submitted date: ${submittedDate}`,
    ],
    script: `OPENING:
"Thank you for calling, this is [YOUR NAME] calling from ${claim.practice.name}. I'm calling to follow up on a claim for one of our patients."

VERIFICATION:
"Our NPI is ${claim.practice.npi}. I'm calling about a claim for patient ${claim.patient.firstName} ${claim.patient.lastName}, member ID ${claim.patient.memberId}. The date of service was ${serviceDate}, CPT code(s) ${cptCodes}, total charge $${Number(claim.totalCharge ?? 0).toFixed(2)}."

MAIN REQUEST:
"This claim was submitted on ${submittedDate} and it's been ${daysPending} days with no response. Can you check the status of this claim and let me know if there are any issues preventing processing?"

IF CLAIM NOT RECEIVED:
"We submitted this claim electronically on ${submittedDate}. Can I get a reference number for a manual resubmission?"

IF PENDING:
"When can I expect a determination? Can you note today's call on the account?"

IF DENIED:
"Can you give me the CARC and RARC codes for the denial reason so I can appeal appropriately?"

CLOSING:
"Thank you for your help. Can I get your name and a reference number for this call? I'll document that in our system."`,
    documentationNote: `Called ${claim.patient.payerName} on [DATE] re: claim for ${claim.patient.firstName} ${claim.patient.lastName}, DOS ${serviceDate}. Status: [STATUS]. Rep: [NAME]. Ref: [REF#]. Next step: [ACTION].`,
  }
}
