"use client"

import { useState } from "react"
import Link from "next/link"

interface BaaGateProps {
  baaAccepted: boolean
}

export default function BaaGate({ baaAccepted }: BaaGateProps) {
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(baaAccepted)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (accepted) return null

  async function handleAccept() {
    if (!checked) {
      setError("Please check the box to confirm you accept the BAA.")
      return
    }
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/accept-baa", { method: "POST" })
      if (!res.ok) throw new Error("Failed to record acceptance")
      setAccepted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">Business Associate Agreement Required</h2>
        <p className="text-sm text-gray-600 mb-4">
          HIPAA requires a signed Business Associate Agreement before Claima can process protected health information (PHI) on your behalf. Please review and accept the BAA to continue.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-xs text-gray-600 leading-relaxed">
          <p className="font-medium text-gray-800 mb-1">Key commitments in our BAA:</p>
          <ul className="space-y-1 list-disc list-outside ml-4">
            <li>We encrypt all PHI in transit (TLS) and at rest</li>
            <li>We maintain audit logs of all PHI access</li>
            <li>We notify you within 30 days of any breach</li>
            <li>We return or destroy your PHI upon termination</li>
            <li>Our subprocessors (Supabase, Vercel, Stripe) maintain HIPAA-compatible safeguards</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => { setChecked(e.target.checked); setError(null) }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            I have read and accept the{" "}
            <Link href="/baa" target="_blank" className="text-blue-600 hover:underline font-medium">
              Business Associate Agreement
            </Link>
            {" "}and represent that I am authorized to bind my organization.
          </span>
        </label>

        {error && (
          <p className="text-red-600 text-xs mb-4">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
        >
          {accepting ? "Recording acceptance…" : "Accept BAA and Continue"}
        </button>

        <p className="text-xs text-gray-400 mt-3 text-center">
          Your acceptance is timestamped and stored for compliance records.
        </p>
      </div>
    </div>
  )
}
