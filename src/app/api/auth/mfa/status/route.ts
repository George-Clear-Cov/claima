import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

// Current MFA state for the signed-in user (drives the settings UI).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mfaEnabled: true, mfaBackupCodes: true },
  })
  return NextResponse.json({
    enabled: !!user?.mfaEnabled,
    backupCodesRemaining: user?.mfaBackupCodes.length ?? 0,
  })
}
