"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { LogoMark } from "@/components/Logo"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get("from") ?? "/"

  const didReset = params.get("reset") === "1"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Login failed")
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken)
        return
      }
      router.push(from)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      router.push(from)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <LogoMark size={40} />
          <div>
            <div className="text-xl font-semibold tracking-tight text-gray-900">Claima</div>
            <div className="text-xs text-gray-500 -mt-0.5">Medical billing platform</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          {mfaToken ? (
            <form onSubmit={handleMfaSubmit}>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Two-factor authentication</h1>
              <p className="text-gray-500 text-sm mb-6">Enter the 6-digit code from your authenticator app — or a backup code.</p>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                aria-label="Verification code"
                placeholder="123456"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-lg text-gray-900 tracking-[0.3em] text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"
              />
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mt-4 flex items-center gap-2">
                  <span className="text-red-500 shrink-0">⚠</span>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || mfaCode.trim().length < 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.99] mt-4"
              >
                {loading ? "Verifying…" : "Verify →"}
              </button>
              <button
                type="button"
                onClick={() => { setMfaToken(null); setMfaCode(""); setError(null) }}
                className="w-full text-gray-500 hover:text-gray-700 text-sm mt-3"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
          <>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Sign in</h1>
          {didReset ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm mb-4">
              Password updated — sign in with your new password.
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-6">Access your practice billing dashboard</p>
          )}

          <a
            href="/api/auth/azure"
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm mb-5 hover:shadow"
          >
            <svg viewBox="0 0 21 21" className="w-5 h-5" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </a>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"/></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-500">or sign in with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                aria-label="Email"
                placeholder="admin@yourpractice.com"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Password</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">Forgot password?</Link>
            </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-label="Password"
                placeholder="••••••••"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <span className="text-red-500 shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.99] mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in →"}
            </button>
          </form>
          </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">Create one free</Link>
        </p>

        <p className="text-center text-xs text-gray-500 mt-5">
          Claima · HIPAA-compliant billing platform ·{" "}
          <Link href="/privacy" className="underline hover:text-gray-600">Privacy</Link>{" "}·{" "}
          <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
