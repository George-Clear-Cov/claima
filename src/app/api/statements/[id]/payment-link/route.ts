import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"
import { getSessionFromRequest } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit"

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "")
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: statementId } = await params
  const { prisma } = await import("@/lib/prisma")

  const statement = await prisma.patientStatement.findFirst({
    where: { id: statementId, patient: { practiceId: session.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      claim: { select: { serviceDate: true } },
    },
  })

  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (Number(statement.balanceDue) <= 0) {
    return NextResponse.json({ error: "No balance due" }, { status: 400 })
  }

  const token = await new SignJWT({
    statementId,
    practiceId: session.practiceId,
    type: "payment_link",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret())

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://claima.io"
  const paymentUrl = `${baseUrl}/pay/${token}`

  const { sendEmail: send } = await import("@/lib/email").then(() => ({ sendEmail }))

  if (statement.patient.email) {
    const dueDate = statement.dueDate
      ? new Date(statement.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null

    await send({
      to: statement.patient.email,
      subject: `Your balance of $${Number(statement.balanceDue).toFixed(2)} is ready to pay`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">You have a balance due</div>
          <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:4px">
            Hi ${statement.patient.firstName},
          </p>
          <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:24px">
            Your insurance has processed your claim. Your remaining balance is
            <strong style="color:#111">$${Number(statement.balanceDue).toFixed(2)}</strong>${dueDate ? `, due ${dueDate}` : ""}.
          </p>
          <a href="${paymentUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none">
            Pay $${Number(statement.balanceDue).toFixed(2)} securely →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            This link expires in 30 days. Pay securely via Stripe — your card info is never stored by us.
          </p>
        </div>
      `,
    })
  }

  logAudit({
    action: "statement.payment_link_sent",
    practiceId: session.practiceId,
    userId: session.userId,
    userEmail: session.email,
    resource: "statement",
    resourceId: statementId,
    req,
  })

  return NextResponse.json({
    url: paymentUrl,
    emailSent: !!statement.patient.email,
    patientEmail: statement.patient.email ?? null,
  })
}
