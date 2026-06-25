"use client"

import { useEffect, useState, use } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { LogoMark } from "@/components/Logo"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

interface StatementData {
  statementId: string
  practiceName: string
  patientFirstName: string
  balanceDue: number
  totalCharge: number
  insurancePaid: number
  adjustments: number
  serviceDate: string
  dueDate: string | null
  alreadyPaid: boolean
}

function PaymentForm({ token, amount }: { token: string; amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitErr } = await elements.submit()
    if (submitErr) {
      setError(submitErr.message ?? "Something went wrong")
      setLoading(false)
      return
    }

    const res = await fetch(`/api/pay/${token}`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Failed to initialize payment")
      setLoading(false)
      return
    }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      clientSecret: data.clientSecret,
      confirmParams: { return_url: `${window.location.origin}/pay/${token}?success=1` },
      redirect: "if_required",
    })

    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed")
      setLoading(false)
    } else {
      setSucceeded(true)
    }
  }

  if (succeeded) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-lg font-bold text-gray-900 mb-1">Payment received</div>
        <div className="text-sm text-gray-500">Thank you — your payment of <strong>${amount.toFixed(2)}</strong> has been processed.</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm"
      >
        {loading ? "Processing…" : `Pay $${amount.toFixed(2)} securely`}
      </button>
      <p className="text-center text-xs text-gray-400">Secured by Stripe · Your card is never stored by us</p>
    </form>
  )
}

function PaymentWrapper({ token, statement }: { token: string; statement: StatementData }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/pay/${token}`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret)
        else setInitError(data.error ?? "Failed to initialize payment")
      })
      .catch(() => setInitError("Network error — please try again"))
  }, [token])

  if (initError) {
    return <div className="text-sm text-red-600 text-center py-4">{initError}</div>
  }

  if (!clientSecret) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <PaymentForm token={token} amount={statement.balanceDue} />
    </Elements>
  )
}

export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    // Check for ?success=1 redirect from Stripe
    if (new URLSearchParams(window.location.search).get("success") === "1") {
      setPaid(true)
    }
    fetch(`/api/pay/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setStatement(data)
        if (data.alreadyPaid) setPaid(true)
      })
      .catch(() => setError("Failed to load payment details"))
  }, [token])

  const serviceDate = statement?.serviceDate
    ? new Date(statement.serviceDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <LogoMark size={36} />
          <div>
            <div className="text-lg font-semibold tracking-tight text-gray-900">Claima</div>
            <div className="text-xs text-gray-400 -mt-0.5">Secure patient billing</div>
          </div>
        </div>

        {error ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="text-sm text-gray-500 mb-4">{error}</div>
            <p className="text-xs text-gray-400">This link may have expired. Contact your provider for a new one.</p>
          </div>
        ) : !statement ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ) : paid ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-lg font-bold text-gray-900 mb-1">All paid up</div>
            <div className="text-sm text-gray-500">Your balance with {statement.practiceName} has been paid. Thank you!</div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="mb-6">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{statement.practiceName}</div>
              <div className="text-3xl font-bold text-gray-900">${statement.balanceDue.toFixed(2)}</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Hi {statement.patientFirstName} — your balance after insurance
                {serviceDate ? ` for your visit on ${serviceDate}` : ""}.
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 space-y-1.5 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Billed</span>
                <span className="font-medium text-gray-700">${statement.totalCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Insurance paid</span>
                <span className="font-medium text-gray-700">−${statement.insurancePaid.toFixed(2)}</span>
              </div>
              {statement.adjustments > 0 && (
                <div className="flex justify-between">
                  <span>Adjustments</span>
                  <span className="font-medium text-gray-700">−${statement.adjustments.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-gray-900 font-semibold text-sm">
                <span>Your balance</span>
                <span>${statement.balanceDue.toFixed(2)}</span>
              </div>
            </div>

            <PaymentWrapper token={token} statement={statement} />
          </div>
        )}
      </div>
    </div>
  )
}
