"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type Step = "loading" | "activating" | "success" | "error"

export default function AzureMarketplacePage() {
  const params = useSearchParams()
  const token = params.get("token")

  const [step, setStep] = useState<Step>(token ? "loading" : "error")
  const [errorMsg, setErrorMsg] = useState("")
  const [info, setInfo] = useState<{
    azureSubscriptionId: string
    planId: string
    purchaserEmail?: string
    beneficiaryEmail?: string
  } | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMsg("No marketplace token found. Please return to Microsoft AppSource and try again.")
      return
    }

    async function activate() {
      setStep("activating")
      try {
        const res = await fetch("/api/marketplace/azure/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketplaceToken: token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Activation failed")
        setInfo({
          azureSubscriptionId: data.azureSubscriptionId,
          planId: data.planId,
          purchaserEmail: data.purchaserEmail,
          beneficiaryEmail: data.beneficiaryEmail,
        })
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
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Microsoft AppSource</h1>
          <p className="text-gray-500 mt-1">claima.io — AI Medical Billing</p>
        </div>

        {(step === "loading" || step === "activating") && (
          <div>
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
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
              Your claima.io subscription through Microsoft AppSource is now active. Create your account to get started.
            </p>
            {info && (
              <div className="bg-gray-50 rounded-lg p-3 text-left mb-6 text-sm text-gray-500 space-y-1">
                {info.beneficiaryEmail && (
                  <div>User: <span className="font-medium text-gray-700">{info.beneficiaryEmail}</span></div>
                )}
                <div>Plan: <span className="font-medium text-gray-700">{info.planId}</span></div>
                <div className="truncate">Subscription: <span className="font-mono text-gray-700 text-xs">{info.azureSubscriptionId}</span></div>
              </div>
            )}
            <a
              href={info?.beneficiaryEmail ? `/signup?email=${encodeURIComponent(info.beneficiaryEmail)}` : "/signup"}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Create Your Account
            </a>
            <p className="text-xs text-gray-400 mt-3">Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a></p>
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
              <a href="https://appsource.microsoft.com" className="text-blue-600 hover:underline">
                Microsoft AppSource
              </a>{" "}
              and try again, or contact{" "}
              <a href="mailto:support@claima.io" className="text-blue-600 hover:underline">
                support@claima.io
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
