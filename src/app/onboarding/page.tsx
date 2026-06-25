"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogoMark } from "@/components/Logo"

interface OnboardingSteps {
  practiceSetup: boolean
  stripeConnect: boolean
  payerEnrollment: boolean
  firstProvider: boolean
  firstPatient: boolean
  firstClaim: boolean
}

interface ConnectStatus {
  status: "not_started" | "onboarding_required" | "pending_capability" | "active" | "not_configured"
  readyToReceivePayments?: boolean
  accountId?: string
}

const STEP_CONFIG = [
  {
    key: "practiceSetup" as keyof OnboardingSteps,
    title: "Practice details",
    description: "Name, NPI, Tax ID, address",
    href: "/onboarding/setup",
    action: "Set up practice →",
  },
  {
    key: "stripeConnect" as keyof OnboardingSteps,
    title: "Connect Stripe",
    description: "Collect patient payments (5% platform fee)",
    href: null, // handled inline
    action: "Connect Stripe →",
  },
  {
    key: "payerEnrollment" as keyof OnboardingSteps,
    title: "Payer enrollment",
    description: "Select which payers you're enrolled with through Claim.MD",
    href: "/onboarding/payers",
    action: "Add payers →",
  },
  {
    key: "firstProvider" as keyof OnboardingSteps,
    title: "Add a provider",
    description: "At least one billing provider with NPI",
    href: "/settings?tab=providers",
    action: "Add provider →",
  },
  {
    key: "firstPatient" as keyof OnboardingSteps,
    title: "Add a patient",
    description: "Patient demographics and insurance info",
    href: "/settings?tab=patients",
    action: "Add patient →",
  },
  {
    key: "firstClaim" as keyof OnboardingSteps,
    title: "Submit your first claim",
    description: "837P claim — AI will scrub it before submission",
    href: "/claims/new",
    action: "Submit claim →",
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [steps, setSteps] = useState<OnboardingSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/onboarding/status").then((r) => r.json()),
      fetch("/api/connect").then((r) => r.json()),
    ])
      .then(([statusData, connectData]) => {
        setSteps(statusData.steps)
        setConnectStatus(connectData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleStripeConnect() {
    setConnectLoading(true)
    setConnectError(null)
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
      setConnectError(err instanceof Error ? err.message : "Something went wrong")
      setConnectLoading(false)
    }
  }

  const completedCount = steps ? Object.values(steps).filter(Boolean).length : 0
  const totalCount = 6
  const allComplete = completedCount === totalCount

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-10">
          <LogoMark size={32} />
          <span className="font-semibold text-lg tracking-tight">Claima</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Getting started</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Complete these steps to go live with your first client.
          </p>
          {!loading && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{completedCount} of {totalCount}</span>
            </div>
          )}
        </div>

        {allComplete && (
          <div className="mb-6 bg-green-900/30 border border-green-800 rounded-xl px-5 py-4 text-sm text-green-300">
            All setup steps complete. You&apos;re ready to onboard your first client.{" "}
            <Link href="/" className="underline hover:text-green-200">Go to dashboard →</Link>
          </div>
        )}

        <div className="space-y-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-20" />
              ))
            : STEP_CONFIG.map((step, index) => {
                const done = steps?.[step.key] ?? false
                const isStripe = step.key === "stripeConnect"

                return (
                  <div
                    key={step.key}
                    className={`bg-gray-900 border rounded-xl p-5 flex items-start gap-4 transition-colors ${
                      done ? "border-gray-800 opacity-75" : "border-gray-700"
                    }`}
                  >
                    {/* Step number / checkmark */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                        done
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-semibold ${done ? "text-gray-400 line-through" : "text-white"}`}>
                          {step.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>

                      {/* Stripe connect inline error */}
                      {isStripe && connectError && (
                        <p className="text-xs text-red-400 mt-2">{connectError}</p>
                      )}

                      {/* Stripe pending state */}
                      {isStripe && connectStatus?.status === "pending_capability" && !done && (
                        <p className="text-xs text-amber-400 mt-2">
                          Onboarding submitted — waiting for Stripe capability approval.
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    {!done && (
                      isStripe ? (
                        <button
                          onClick={handleStripeConnect}
                          disabled={connectLoading}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0 disabled:opacity-50"
                        >
                          {connectLoading ? "Redirecting…" : step.action}
                        </button>
                      ) : (
                        <Link
                          href={step.href!}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0"
                        >
                          {step.action}
                        </Link>
                      )
                    )}
                  </div>
                )
              })}
        </div>

        <div className="mt-8 flex gap-4 text-xs text-gray-600">
          <Link href="/" className="hover:text-gray-400">Skip for now →</Link>
          <Link href="/support" className="hover:text-gray-400">Need help?</Link>
        </div>
      </div>
    </div>
  )
}
