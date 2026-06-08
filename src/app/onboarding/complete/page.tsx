"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"

function CompleteContent() {
  const [status, setStatus] = useState<"loading" | "active" | "pending">("loading")

  useEffect(() => {
    fetch("/api/connect")
      .then(r => r.json())
      .then(d => setStatus(d.status === "active" ? "active" : "pending"))
      .catch(() => setStatus("pending"))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        {status === "loading" && <div className="text-gray-500">Verifying account…</div>}

        {status === "active" && (
          <>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold">You&apos;re all set!</h1>
            <p className="text-gray-400 mt-2">Stripe Connect is active. Patient payments will flow directly to your bank account.</p>
            <Link href="/billing" className="mt-8 inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              Go to Patient Billing →
            </Link>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold">Almost there</h1>
            <p className="text-gray-400 mt-2">Stripe is still verifying your account. This usually takes a few minutes.</p>
            <Link href="/" className="mt-8 inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function CompletePage() {
  return (
    <Suspense>
      <CompleteContent />
    </Suspense>
  )
}
