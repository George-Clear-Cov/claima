"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get("session_id")

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Payment successful</h1>
        <p className="text-gray-500 text-sm mt-2">
          Your payment was processed securely through Stripe. You&apos;ll receive a confirmation email shortly.
        </p>
        {sessionId && (
          <p className="text-xs text-gray-400 mt-3 font-mono">
            Ref: {sessionId.slice(0, 24)}…
          </p>
        )}
        <Link
          href="/store"
          className="mt-6 inline-block w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Back to services
        </Link>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}
