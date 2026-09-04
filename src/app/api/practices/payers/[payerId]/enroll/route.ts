import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { initiateEnrollment, lookupPayer } from "@/lib/claimmd"

const enrollSchema = z.object({
  enrollType: z.enum(["era", "claim"]).default("era"),
})

// POST /api/practices/payers/[payerId]/enroll — initiate EDI/ERA enrollment
// with Claim.MD for this practice + payer; stores the returned portal link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ payerId: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  const { payerId } = await params
  let input: z.infer<typeof enrollSchema>
  try {
    input = enrollSchema.parse(await req.json().catch(() => ({})))
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { prisma } = await import("@/lib/prisma")

  const enrollment = await prisma.practicePayerEnrollment.findUnique({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
  })
  if (!enrollment) {
    return NextResponse.json({ error: "Payer not found for this practice — add it on the Payers tab first" }, { status: 404 })
  }

  const practice = await prisma.practice.findUniqueOrThrow({
    where: { id: session.practiceId },
    select: { name: true, npi: true, taxId: true },
  })

  // Resolve the Claim.MD payer id if we don't have one yet
  let claimMdPayerId = enrollment.claimMdPayerId
  if (!claimMdPayerId) {
    const info = await lookupPayer(enrollment.payerId).catch(() => null)
    claimMdPayerId = info?.payerId ?? enrollment.payerId
  }

  const result = await initiateEnrollment({
    payerId: claimMdPayerId,
    enrollType: input.enrollType,
    taxId: practice.taxId,
    npi: practice.npi,
    providerName: practice.name,
    contactEmail: session.email,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message ?? "Enrollment initiation failed", raw: result.raw }, { status: 502 })
  }

  const linkNote = result.enrollmentUrl ? `${input.enrollType.toUpperCase()} enrollment initiated ${new Date().toISOString().slice(0, 10)}: ${result.enrollmentUrl}` : null
  const updated = await prisma.practicePayerEnrollment.update({
    where: { practiceId_payerId: { practiceId: session.practiceId, payerId } },
    data: {
      claimMdPayerId,
      notes: linkNote ? (enrollment.notes ? `${enrollment.notes}\n${linkNote}` : linkNote) : enrollment.notes,
    },
  })

  logAudit({ action: "payers.enroll.initiate", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "payer-enrollment", resourceId: updated.id, req })

  return NextResponse.json({ ok: true, enrollmentUrl: result.enrollmentUrl, enrollment: updated })
}
