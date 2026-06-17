import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  gender: z.enum(["M", "F", "U"]),
  memberId: z.string().min(1),
  groupNumber: z.string().optional(),
  payerId: z.string().min(1),
  payerName: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
})

// GET /api/patients — list patients for current practice
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 })

  const search = req.nextUrl.searchParams.get("q")?.trim()

  const { prisma } = await import("@/lib/prisma")
  logAudit({ action: "patient.list", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, req })
  const patients = await prisma.patient.findMany({
    where: {
      practiceId: session.practiceId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { memberId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
  return NextResponse.json(patients)
}

// POST /api/patients — add a patient
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "No database" }, { status: 503 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const { prisma } = await import("@/lib/prisma")
    logAudit({ action: "patient.create", practiceId: session.practiceId, userId: session.userId, userEmail: session.email, resource: "patient", req })
    const patient = await prisma.patient.create({
      data: {
        ...data,
        dob: new Date(data.dob),
        practiceId: session.practiceId,
      },
    })
    return NextResponse.json(patient, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 })
  }
}
