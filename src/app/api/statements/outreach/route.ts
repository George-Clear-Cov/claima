import { NextRequest, NextResponse } from "next/server"
import { aiComplete, isAIConfigured } from "@/lib/ai"
import { getSession } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { statementId } = await req.json()
  if (!statementId) return NextResponse.json({ error: "statementId required" }, { status: 400 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { prisma } = await import("@/lib/prisma")

  const statement = await prisma.patientStatement.findUnique({
    where: { id: statementId, claim: { practiceId: session.practiceId } },
    include: {
      patient: { select: { firstName: true, lastName: true, payerName: true } },
      claim: {
        include: {
          lineItems: { select: { cptCode: true, description: true } },
          provider: { select: { firstName: true, lastName: true } },
          practice: { select: { name: true, phone: true } },
        },
      },
    },
  })

  if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 })

  const balanceDue = Number(statement.balanceDue)
  const daysOverdue = statement.dueDate
    ? Math.max(0, Math.floor((Date.now() - new Date(statement.dueDate).getTime()) / 86400000))
    : 0

  const context = {
    patientFirst: statement.patient.firstName,
    patientLast: statement.patient.lastName,
    balanceDue,
    daysOverdue,
    serviceDate: statement.claim.serviceDate.toISOString().slice(0, 10),
    cptCode: statement.claim.lineItems[0]?.cptCode ?? "",
    description: statement.claim.lineItems[0]?.description ?? "therapy session",
    providerName: `${statement.claim.provider.firstName} ${statement.claim.provider.lastName}`,
    practiceName: statement.claim.practice.name,
    practicePhone: statement.claim.practice.phone ?? "",
    insurancePaid: Number(statement.insurancePaid),
    totalCharge: Number(statement.totalCharge),
    payer: statement.patient.payerName,
  }

  if (!isAIConfigured()) {
    const sms = `Hi ${context.patientFirst}, you have a $${balanceDue.toFixed(2)} balance from your ${new Date(context.serviceDate).toLocaleDateString()} session at ${context.practiceName}. Please call ${context.practicePhone} to pay. Thank you.`
    return NextResponse.json({
      sms,
      email: `Dear ${context.patientFirst},\n\nThis is a reminder that you have an outstanding balance of $${balanceDue.toFixed(2)} for your session on ${new Date(context.serviceDate).toLocaleDateString()}.\n\nPlease contact us at ${context.practicePhone} to arrange payment.\n\nThank you,\n${context.practiceName}`,
      portal: sms,
    })
  }

  const urgency = daysOverdue > 60 ? "urgent (60+ days overdue)" : daysOverdue > 30 ? "overdue (30+ days)" : daysOverdue > 0 ? "recently overdue" : "due soon"

  const prompt = `You are drafting patient billing outreach messages for a mental health practice. Write empathetic, professional messages — patients are dealing with mental health challenges.

Patient: ${context.patientFirst} ${context.patientLast}
Balance Due: $${balanceDue.toFixed(2)}
Status: ${urgency}
Service Date: ${new Date(context.serviceDate).toLocaleDateString()}
Service: ${context.description}
Provider: ${context.providerName}
Practice: ${context.practiceName}
Practice Phone: ${context.practicePhone}
Insurance (${context.payer}) paid: $${context.insurancePaid.toFixed(2)} of $${context.totalCharge.toFixed(2)}

Write THREE versions. Respond ONLY with valid JSON:
{
  "sms": "<under 160 chars — friendly SMS, include balance and practice name>",
  "email": "<professional email, 3-4 short paragraphs, explain the balance breakdown, include payment options mention>",
  "portal": "<medium-length portal message, 2-3 sentences, warm tone, mention they can call with questions>"
}

Tone: warm, non-judgmental, understanding that mental health care is important. Do not use collection agency language. Never say 'past due' or 'delinquent'. ${daysOverdue > 60 ? "This is the third outreach — be slightly more direct about needing resolution." : ""}`

  try {
    const text = await aiComplete({ max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON")
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: "Outreach generation failed" }, { status: 422 })
  }
}
