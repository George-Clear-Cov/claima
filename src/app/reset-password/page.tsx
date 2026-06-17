"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { LogoMark } from "@/components/Logo"
import { PASSWORD_RULES, validatePassword } from "@/lib/password"

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const check = validatePassword(password)
  const passed = PASSWORD_RULES.length - check.errors.length
  const pct = (passed / PASSWORD_RULES.length) * 100
  const color = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-0.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = !check.errors.includes(rule)
          return (
            <li key={rule} className={`text-xs flex items-center gap-1 ${ok ? "text-green-600" : "text-gray-400"}`}>
              <span>{ok ? "✓" : "·"}</span>{rule}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match"); return }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) { setError(pwCheck.errors.join(", ")); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to reset password")
      router.push("/login?reset=1")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-gray-500">This reset link is invalid.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">
          Request a new one →
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Set a new password</h1>
      <p className="text-gray-500 text-sm mb-6">Must meet all requirements below.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            placeholder="••••••••"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"
          />
          <PasswordStrength password={password} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"
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
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm"
        >
          {loading ? "Saving…" : "Set new password →"}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <LogoMark size={40} />
          <div>
            <div className="text-xl font-semibold tracking-tight text-gray-900">Claima</div>
            <div className="text-xs text-gray-400 -mt-0.5">Medical billing platform</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
