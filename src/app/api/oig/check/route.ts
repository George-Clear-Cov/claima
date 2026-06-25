import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { checkOigExclusion } from "@/lib/oig"
import { logAudit } from "@/lib/audit"

const schema = z.object({
  providerId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { providerId } = schema.parse(body)

    const { prisma } = await import("@/lib/prisma")

    const provider = await prisma.provider.findUnique({
      where: { id: providerId, practiceId: session.practiceId },
      select: { id: true, firstName: true, lastName: true, npi: true, practiceId: true },
    })
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const result = await checkOigExclusion(provider.firstName, provider.lastName, provider.npi)

    const check = await prisma.oigCheck.create({
      data: {
        practiceId:  session.practiceId,
        providerId:  provider.id,
        status:      result.error ? "ERROR" : result.excluded ? "EXCLUDED" : "CLEAR",
        matchFound:  result.excluded,
        matchDetails: result.matches.length > 0 ? (result.matches as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
        error:       result.error ?? undefined,
      },
    })

    logAudit({
      action: "oig.check",
      practiceId: session.practiceId,
      userId: session.userId,
      userEmail: session.email,
      resource: "provider",
      resourceId: provider.id,
      req,
    })

    return NextResponse.json({ check, result })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: "OIG check failed" }, { status: 500 })
  }
}
