import { NextRequest, NextResponse } from "next/server"
import { v4 as uuid } from "uuid"
import bcrypt from "bcryptjs"
import { signToken, COOKIE_NAME } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`

  if (error) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(error)}`)
  }

  const storedState = req.cookies.get("azure_state")?.value
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
  }

  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/login?error=azure_not_configured`)
  }

  try {
    const redirectUri = `${appUrl}/api/auth/azure/callback`

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: "openid profile email User.Read",
      }),
    })

    if (!tokenRes.ok) {
      console.error("[azure/callback] token exchange failed:", await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!graphRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=graph_failed`)
    }

    const profile = await graphRes.json()
    const email: string = profile.mail ?? profile.userPrincipalName
    const name: string = profile.displayName ?? email.split("@")[0]

    const { prisma } = await import("@/lib/prisma")
    const existing = await prisma.user.findUnique({ where: { email } })

    const clearState = (res: NextResponse) => {
      res.cookies.delete("azure_state")
      return res
    }

    if (existing) {
      const practice = await prisma.practice.findUnique({ where: { id: existing.practiceId } })
      const token = await signToken({
        userId: existing.id,
        email: existing.email,
        name: existing.name,
        practiceId: existing.practiceId,
        role: existing.role,
      })
      const res = NextResponse.redirect(appUrl + "/")
      clearState(res)
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
      return res
    }

    const practiceId = uuid()
    const userId = uuid()
    const hashedPassword = await bcrypt.hash(uuid(), 12)

    await prisma.$transaction([
      prisma.practice.create({
        data: {
          id: practiceId,
          name: `${name}'s Practice`,
          npi: `PENDING-${practiceId}`,
          taxId: "PENDING",
          taxonomy: "193200000X",
          addressLine1: "PENDING",
          city: "PENDING",
          state: "XX",
          zip: "00000",
          phone: "0000000000",
        },
      }),
      prisma.user.create({
        data: {
          id: userId,
          email,
          name,
          hashedPassword,
          practiceId,
          role: "ADMIN",
        },
      }),
    ])

    const token = await signToken({ userId, email, name, practiceId, role: "ADMIN" })
    const res = NextResponse.redirect(`${appUrl}/onboarding/setup`)
    clearState(res)
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return res
  } catch (err) {
    console.error("[azure/callback] failed:", err)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
