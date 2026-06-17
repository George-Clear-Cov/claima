"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
              <span>{ok ? "✓" : "·"}</span>
              {rule}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()

  const [name, setName] = useState("")
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [practiceName, setPracticeName] = useState("")
  const [baaAccepted, setBaaAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!baaAccepted) {
      setError("You must accept the Business Associate Agreement to create an account.")
      return
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      setError(`Password requirements not met: ${pwCheck.errors.join(", ")}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, practiceName, baaAccepted }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Registration failed")
      router.push("/onboarding/setup")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"

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
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm mb-6">Start collecting more revenue with AI-powered billing</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Dr. Jane Smith"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="jane@yourpractice.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Practice Name</label>
              <input
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                required
                placeholder="Riverside Medical Group"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a strong password"
                className={inputClass}
              />
              <PasswordStrength password={password} />
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={baaAccepted}
                  onChange={(e) => { setBaaAccepted(e.target.checked); setError(null) }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I accept the{" "}
                  <Link href="/baa" target="_blank" className="text-blue-600 hover:underline font-medium">
                    Business Associate Agreement
                  </Link>
                  {" "}(required for HIPAA compliance) and{" "}
                  <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <span className="text-red-500 shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !baaAccepted}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.99] mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </span>
              ) : "Create account →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
