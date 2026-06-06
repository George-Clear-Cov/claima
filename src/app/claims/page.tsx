"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import NavBar from "@/components/NavBar"

interface Claim {
  id: string
  claimStatus: string
  totalCharge: string
  submittedAt: string | null
  serviceDate: string
  patient: { firstName: string; lastName: string }
  provider: { firstName: string; lastName: string }
  lineItems: { cptCode: string }[]
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: "bg-gray-800",         text: "text-gray-400",    dot: "bg-gray-500" },
  SUBMITTED: { bg: "bg-blue-950/70",      text: "text-blue-300",    dot: "bg-blue-500" },
  ACCEPTED:  { bg: "bg-green-950/70",     text: "text-green-300",   dot: "bg-green-500" },
  REJECTED:  { bg: "bg-red-950/70",       text: "text-red-300",     dot: "bg-red-500" },
  DENIED:    { bg: "bg-orange-950/70",    text: "text-orange-300",  dot: "bg-orange-500" },
  PAID:      { bg: "bg-emerald-950/70",   text: "text-emerald-300", dot: "bg-emerald-500" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((data) => {
        setClaims(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Claims</h1>
            <p className="text-gray-500 text-sm mt-0.5">837P submissions and payer responses</p>
          </div>
          <Link
            href="/claims/new"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-1.5"
          >
            <span className="text-blue-200">+</span> New Claim
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-600">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading claims…
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/40 border border-gray-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium mb-1">No claims yet</p>
            <p className="text-gray-600 text-sm mb-6">Submit your first 837P claim to get started</p>
            <Link
              href="/claims/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Submit first claim →
            </Link>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPT Codes</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Charge</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-100">
                      {claim.patient.lastName}, {claim.patient.firstName}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {claim.provider.firstName} {claim.provider.lastName}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {new Date(claim.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">
                      {claim.lineItems.map((l) => l.cptCode).join(", ")}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium">
                      ${parseFloat(claim.totalCharge).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={claim.claimStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
