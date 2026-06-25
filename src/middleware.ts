import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { COOKIE_NAME } from "@/lib/auth"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/security",
  "/store",               // public storefront — customers don't need an account
  "/api/store",          // public product listing for the storefront
  "/api/checkout",       // customers initiate checkout without being logged in
  "/forgot-password",
  "/reset-password",
  "/baa",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/azure",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/webhooks/stripe",
  "/marketplace/aws",          // AWS Marketplace landing page
  "/marketplace/azure",        // Azure Marketplace / AppSource landing page
  "/api/marketplace/aws",      // AWS activate endpoint
  "/api/marketplace/azure",    // Azure activate endpoint
  "/api/webhooks/aws-marketplace",
  "/api/webhooks/azure-marketplace",
  "/api/cron",
  "/pay",
  "/api/pay",
]

// Rate limits for public unauthenticated routes — per IP, 1-minute window
// Module-level map persists within a warm serverless instance
const _rl = new Map<string, { n: number; t: number }>()
const RATE_LIMITS: [string, number][] = [
  ["/api/checkout", 10],
  ["/api/store", 200],
]

function isRateLimited(ip: string, pathname: string): boolean {
  const rule = RATE_LIMITS.find(([p]) => pathname.startsWith(p))
  if (!rule) return false
  const key = `${ip}::${rule[0]}`
  const now = Date.now()
  const entry = _rl.get(key)
  if (!entry || now > entry.t + 60_000) {
    _rl.set(key, { n: 1, t: now })
    return false
  }
  entry.n++
  return entry.n > rule[1]
}

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/favicon")
    || pathname.startsWith("/public/")
    || pathname.startsWith("/logos/")
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
    if (isRateLimited(ip, pathname)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value

  const isApiRoute = pathname.startsWith("/api/")

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "")
  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    if (isApiRoute) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      res.cookies.delete(COOKIE_NAME)
      return res
    }
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(COOKIE_NAME)
    return res
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
