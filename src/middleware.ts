import { NextRequest, NextResponse } from "next/server"
import { jwtVerify, SignJWT } from "jose"
import { COOKIE_NAME, JWT_EXPIRY, SESSION_MAX_AGE_S, REFRESH_AFTER_S } from "@/lib/auth"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/security",
  "/leak-report",         // free diagnostic — no account, and deliberately no auth wall
  "/engagement",          // recovery services agreement — must be readable before accepting
  "/support",             // public help/support page (marketplace + external support links)
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
  ["/api/auth/register", 5],
  ["/api/auth/login", 20],
  ["/api/auth/forgot-password", 5],
  ["/api/auth/reset-password", 5],
  // Guessing a 6-digit code is capped per-code at 5 attempts, but a caller can request
  // new codes; limit both so neither the code space nor the recipient's inbox is a target.
  ["/api/auth/verify-email/resend", 3],
  ["/api/auth/verify-email", 10],
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

// Root-level SEO / metadata / icon files that crawlers and social unfurlers
// must be able to fetch without an auth redirect. Next generates these from
// the app/ file conventions (robots.ts, sitemap.ts, opengraph-image, etc.).
const PUBLIC_FILES = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image.png",
  "/twitter-image.png",
  "/icon.svg",
  "/apple-icon.png",
  "/og.png",
  "/manifest.webmanifest",
])

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    || PUBLIC_FILES.has(pathname)
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
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
    // Server-side gate for the platform-admin console (/admin). The /api/admin/* routes keep their
    // own role checks; this stops the page shell from rendering for non-platform-admins.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const email = typeof payload.email === "string" ? payload.email.toLowerCase() : ""
      const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      if (!admins.includes(email)) {
        const url = req.nextUrl.clone()
        url.pathname = "/"
        return NextResponse.redirect(url)
      }
    }
    const res = NextResponse.next()
    // Sliding session: re-issue the token once it's older than REFRESH_AFTER_S so an active
    // user is never logged out mid-work, while an idle/leaked token still expires
    // SESSION_MAX_AGE_S after its last use (server backstop to the client idle timeout).
    const iat = typeof payload.iat === "number" ? payload.iat : 0
    if (Date.now() / 1000 - iat > REFRESH_AFTER_S) {
      const refreshed = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .sign(secret)
      res.cookies.set(COOKIE_NAME, refreshed, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_S,
        path: "/",
      })
    }
    return res
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
