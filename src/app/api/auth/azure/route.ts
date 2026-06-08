import { NextRequest, NextResponse } from "next/server"
import { v4 as uuid } from "uuid"

export async function GET(req: NextRequest) {
  const clientId = process.env.AZURE_AD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Azure AD not configured" }, { status: 503 })
  }

  const state = uuid()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`
  const redirectUri = `${appUrl}/api/auth/azure/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid profile email User.Read",
    state,
    response_mode: "query",
  })

  const authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set("azure_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })
  return res
}
