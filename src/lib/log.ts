/**
 * PHI-safe error logging.
 *
 * Passing a full Error (or a Prisma error, whose `meta` carries query params / field values)
 * to console.error serializes it into Vercel/edge logs and can leak PHI. Log only the error's
 * name, code, and message — never the raw object, request body, or record data.
 */
export function logError(context: string, err: unknown): void {
  const e = err as { name?: string; code?: string; message?: string } | null | undefined
  const name = e?.name ?? "Error"
  const code = e?.code ? ` ${e.code}` : ""
  const message = e?.message ?? String(err)
  console.error(`[${context}]${code} ${name}: ${message}`)
}
