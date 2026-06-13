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
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/azure",
  "/api/webhooks/stripe",
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/favicon")
    || pathname.startsWith("/public/")
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

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
