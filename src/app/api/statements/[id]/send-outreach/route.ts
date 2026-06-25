import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { sendEmail } from "@/lib/email"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: statementId } = await params
  const { prisma } = await import("@/lib/prisma")

  const statement = await prisma.patientStatement.findUnique({
    where: { id: statementId, claim: { practiceId: session.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      claim: {
        include: {
          lineItems: { select: { cptCode: true, description: true }, take: 1 },
          provider: { select: { firstName: true, lastName: true } },
          practice: { select: { name: true, phone: true } },
        },
      },
    },
  })

  if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 })
  if (!statement.patient.email) return NextResponse.json({ error: "No email on file for this patient" }, { status: 400 })

  const balanceDue = Number(statement.balanceDue)
  if (balanceDue <= 0) return NextResponse.json({ error: "No outstanding balance" }, { status: 400 })

  const outreachCount = statement.outreachCount
  const practiceName = statement.claim.practice.name
  const patientFirst = statement.patient.firstName
  const serviceDate = new Date(statement.claim.serviceDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  const cpt = statement.claim.lineItems[0]?.cptCode ?? ""
  const phone = statement.claim.practice.phone ?? ""

  const subjectMap = [
    `Your balance from ${practiceName}`,
    `Friendly reminder: $${balanceDue.toFixed(2)} balance due`,
    `Final notice: outstanding balance with ${practiceName}`,
  ]
  const subject = subjectMap[Math.min(outreachCount, 2)]

  const urgencyNote = outreachCount === 0
    ? ""
    : outreachCount === 1
    ? `<p style="color:#b45309;font-size:14px;">This is a follow-up reminder. If you have questions about your balance, please call us.</p>`
    : `<p style="color:#dc2626;font-size:14px;"><strong>This is a final notice.</strong> Please pay your balance by responding to this email or calling us. Unpaid balances may be referred to collections.</p>`

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:4px">${practiceName}</h1>
      <p style="color:#6b7280;font-size:13px;margin-bottom:24px">Patient billing statement</p>

      <p style="font-size:15px;">Hi ${patientFirst},</p>
      <p style="font-size:15px;line-height:1.6;">
        You have an outstanding balance of <strong>$${balanceDue.toFixed(2)}</strong>
        for your visit on <strong>${serviceDate}</strong>${cpt ? ` (CPT ${cpt})` : ""}.
      </p>
      ${urgencyNote}

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:24px 0">
        <table style="width:100%;font-size:13px;color:#374151">
          <tr><td style="padding:4px 0;color:#6b7280">Billed</td><td style="text-align:right">$${Number(statement.totalCharge).toFixed(2)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Insurance paid</td><td style="text-align:right">−$${Number(statement.insurancePaid).toFixed(2)}</td></tr>
          ${Number(statement.adjustments) > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Adjustments</td><td style="text-align:right">−$${Number(statement.adjustments).toFixed(2)}</td></tr>` : ""}
          <tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0 4px;font-weight:600;font-size:14px">Your balance</td><td style="text-align:right;font-weight:700;font-size:16px">$${balanceDue.toFixed(2)}</td></tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;">
        To pay, please call us at <strong>${phone || "the number on your insurance card"}</strong> or reply to this email.
        ${statement.dueDate ? `Payment is due by <strong>${new Date(statement.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong>.` : ""}
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="font-size:11px;color:#9ca3af;">
        This statement was sent by ${practiceName} via Claima. If you believe this is an error, please contact your provider directly.
      </p>
    </div>
  `

  await sendEmail({
    from: `${practiceName} Billing <noreply@claima.io>`,
    to: statement.patient.email,
    subject,
    html,
  })

  await prisma.patientStatement.update({
    where: { id: statementId },
    data: {
      outreachSentAt: new Date(),
      outreachCount: { increment: 1 },
      statementStatus: "SENT",
    },
  })

  logAudit({ action: "statement.outreach_sent", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "statement", resourceId: statementId, req })

  return NextResponse.json({ ok: true, outreachCount: outreachCount + 1 })
}
