"use client"

import { useState } from "react"
import Link from "next/link"

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <Link href="/" className="text-gray-500 text-sm hover:text-gray-300">← Claima</Link>

        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold mb-6">C</div>

          <h1 className="text-2xl font-bold">Connect your practice to Stripe</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Claima collects patient payments on your behalf. We use Stripe Connect to
            route funds directly to your bank account — Claima takes a <span className="text-white font-medium">5% platform fee</span> on
            patient collections only (insurance payments are separate).
          </p>

          <div className="mt-6 space-y-3">
            {[
              ["Patient pays $75 copay", "$75.00"],
              ["Claima platform fee (5%)", "−$3.75"],
              ["You receive", "$71.25"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className={`font-mono ${value.startsWith("−") ? "text-red-400" : value === "$71.25" ? "text-green-400 font-bold" : ""}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800 space-y-3 text-xs text-gray-500">
            <div className="flex gap-2"><span>✓</span><span>Funds deposited to your bank in 2 business days</span></div>
            <div className="flex gap-2"><span>✓</span><span>Patients see your practice name on their card statement</span></div>
            <div className="flex gap-2"><span>✓</span><span>HIPAA-compliant — no PHI stored in Stripe</span></div>
          </div>

          {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? "Redirecting to Stripe…" : "Set up payments with Stripe →"}
          </button>

          <p className="text-center text-xs text-gray-600 mt-4">
            Powered by Stripe Connect · Takes ~2 minutes
          </p>
        </div>
      </div>
    </div>
  )
}
