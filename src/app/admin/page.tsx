"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface PracticeStat {
  id: string
  name: string
  npi: string
  city: string
  state: string
  createdAt: string
  adminEmail: string | null
  stripeOnboarded: boolean
  platformFeePercent: number
  providerCount: number
  patientCount: number
  claimCount: number
  totalBilled: number
  totalCollected: number
  patientCollected: number
  platformFeeEarned: number
  denialRate: number
  openDenials: number
  pendingAR: number
  avgDaysToPayment: number | null
  collectionRate: number
}

interface PlatformData {
  totals: {
    practices: number
    totalBilled: number
    totalCollected: number
    totalPlatformFee: number
    totalPendingAR: number
    avgDenialRate: number
  }
  practices: PracticeStat[]
}

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`
}

export default function AdminPage() {
  const [data, setData] = useState<PlatformData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/admin/platform")
      .then(r => {
        if (r.status === 403) throw new Error("Not authorized as platform admin")
        if (!r.ok) throw new Error("Failed to load")
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => router.push("/")} className="mt-4 text-sm text-blue-600 hover:underline">Go home</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Loading platform data…</div>
      </div>
    )
  }

  const { totals, practices } = data

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
            <p className="text-sm text-gray-500 mt-0.5">All practices · internal only</p>
          </div>
          <button onClick={() => router.push("/")} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to app
          </button>
        </div>

        {/* Platform totals */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Practices", value: totals.practices.toString() },
            { label: "Total billed", value: fmt(totals.totalBilled) },
            { label: "Total collected", value: fmt(totals.totalCollected) },
            { label: "Platform fees", value: fmt(totals.totalPlatformFee), highlight: true },
            { label: "Pending AR", value: fmt(totals.totalPendingAR) },
            { label: "Avg denial rate", value: `${totals.avgDenialRate}%` },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`rounded-xl border p-4 ${highlight ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${highlight ? "text-blue-700" : "text-gray-900"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Practice table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">All practices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">
                  <th className="px-4 py-3">Practice</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3 text-right">Claims</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                  <th className="px-4 py-3 text-right">Platform fee</th>
                  <th className="px-4 py-3 text-right">Denial %</th>
                  <th className="px-4 py-3 text-right">Pending AR</th>
                  <th className="px-4 py-3 text-right">Days to pay</th>
                  <th className="px-4 py-3">Stripe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {practices.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.city}, {p.state} · NPI {p.npi}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.adminEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.claimCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.totalBilled)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-900 font-medium">{fmt(p.totalCollected + p.patientCollected)}</span>
                      <span className="text-xs text-gray-400 ml-1">({p.collectionRate}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt(p.platformFeeEarned)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${p.denialRate >= 15 ? "text-red-600" : p.denialRate >= 8 ? "text-amber-600" : "text-green-600"}`}>
                        {p.denialRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.pendingAR)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.avgDaysToPayment != null ? `${p.avgDaysToPayment}d` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.stripeOnboarded ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.stripeOnboarded ? "Active" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {practices.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-gray-400">No practices yet.</div>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          Platform fee = {practices[0]?.platformFeePercent ?? 5}% of total collected per practice.
          Add your email to <code>PLATFORM_ADMIN_EMAILS</code> in Vercel to grant access.
        </p>
      </div>
    </div>
  )
}
