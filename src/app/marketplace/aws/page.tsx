"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type Step = "loading" | "activating" | "success" | "error"

function AwsMarketplaceContent() {
  const params = useSearchParams()
  const token = params.get("x-amzn-marketplace-token")

  const [step, setStep] = useState<Step>(token ? "loading" : "error")
  const [errorMsg, setErrorMsg] = useState("")
  const [info, setInfo] = useState<{ customerId: string; productCode: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMsg("No registration token found. Please return to AWS Marketplace and try again.")
      return
    }

    async function activate() {
      setStep("activating")
      try {
        const res = await fetch("/api/marketplace/aws/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationToken: token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Activation failed")
        setInfo({ customerId: data.customerId, productCode: data.productCode })
        setStep("success")
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Activation failed")
        setStep("error")
      }
    }

    activate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AWS Marketplace</h1>
          <p className="text-gray-500 mt-1">claima.io — AI Medical Billing</p>
        </div>

        {(step === "loading" || step === "activating") && (
          <div>
            <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">
              {step === "loading" ? "Validating your purchase..." : "Activating your subscription..."}
            </p>
          </div>
        )}

        {step === "success" && (
          <div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Subscription Active</h2>
            <p className="text-gray-600 mb-6">
              Your claima.io subscription through AWS Marketplace is now active. Set up your account to get started.
            </p>
            {info && (
              <div className="bg-gray-50 rounded-lg p-3 text-left mb-6 text-sm text-gray-500">
                <div>Customer ID: <span className="font-mono text-gray-700">{info.customerId}</span></div>
                <div>Product: <span className="font-mono text-gray-700">{info.productCode}</span></div>
              </div>
            )}
            <a
              href="/signup"
              className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Create Your Account
            </a>
            <p className="text-xs text-gray-400 mt-3">Already have an account? <a href="/login" className="text-orange-500 hover:underline">Sign in</a></p>
          </div>
        )}

        {step === "error" && (
          <div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Activation Failed</h2>
            <p className="text-red-600 text-sm mb-6">{errorMsg}</p>
            <p className="text-gray-500 text-sm">
              Please return to{" "}
              <a href="https://aws.amazon.com/marketplace" className="text-orange-500 hover:underline">
                AWS Marketplace
              </a>{" "}
              and try again, or contact{" "}
              <a href="mailto:support@claima.io" className="text-orange-500 hover:underline">
                support@claima.io
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AwsMarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <AwsMarketplaceContent />
    </Suspense>
  )
}
