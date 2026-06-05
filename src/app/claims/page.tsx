"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-700 text-gray-300",
  SUBMITTED: "bg-blue-900 text-blue-300",
  ACCEPTED: "bg-green-900 text-green-300",
  REJECTED: "bg-red-900 text-red-300",
  DENIED: "bg-orange-900 text-orange-300",
  PAID: "bg-emerald-900 text-emerald-300",
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
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-gray-500 text-sm hover:text-gray-300">
              ← MediBill
            </Link>
            <h1 className="text-2xl font-bold mt-1">Claims</h1>
          </div>
          <Link
            href="/claims/new"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Claim
          </Link>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading claims...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No claims yet</p>
            <Link
              href="/claims/new"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
            >
              Submit your first claim
            </Link>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Provider</th>
                  <th className="px-4 py-3 text-left">Service Date</th>
                  <th className="px-4 py-3 text-left">CPT Codes</th>
                  <th className="px-4 py-3 text-right">Charge</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {claim.patient.lastName}, {claim.patient.firstName}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {claim.provider.firstName} {claim.provider.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(claim.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {claim.lineItems.map((l) => l.cptCode).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${parseFloat(claim.totalCharge).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[claim.claimStatus] || "bg-gray-700 text-gray-300"}`}
                      >
                        {claim.claimStatus}
                      </span>
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
