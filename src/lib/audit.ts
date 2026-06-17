import type { NextRequest } from "next/server"

interface AuditEvent {
  practiceId?: string
  userId?: string
  userEmail?: string
  action: string
  resource?: string
  resourceId?: string
  req?: NextRequest
}

// Fire-and-forget — never awaited so it never blocks a request.
// Failures are logged to console but never thrown.
export function logAudit(event: AuditEvent): void {
  void (async () => {
    try {
      const { prisma } = await import("@/lib/prisma")
      const ip =
        event.req?.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        event.req?.headers.get("x-real-ip") ??
        undefined
      const userAgent = event.req?.headers.get("user-agent") ?? undefined

      await prisma.auditLog.create({
        data: {
          practiceId: event.practiceId,
          userId: event.userId,
          userEmail: event.userEmail,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          ip,
          userAgent,
        },
      })
    } catch (err) {
      console.error("[audit] Failed to write audit log:", err)
    }
  })()
}
