"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

type ConnectStatus = {
  status: "not_started" | "onboarding_required" | "pending_capability" | "active" | "not_configured"
  accountId?: string
  readyToReceivePayments?: boolean
  onboardingComplete?: boolean
  requirementsStatus?: string
  platformFeePercent?: number
  configured?: boolean
}

type NewProduct = { name: string; description: string; price: string }

export default function OnboardingPage() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product creation state
  const [product, setProduct] = useState<NewProduct>({ name: "", description: "", price: "" })
  const [productLoading, setProductLoading] = useState(false)
  const [productSuccess, setProductSuccess] = useState<string | null>(null)
  const [productError, setProductError] = useState<string | null>(null)

  // Fetch live Connect status from the V2 API on mount
  useEffect(() => {
    fetch("/api/connect")
      .then((r) => r.json())
      .then((data) => { setConnectStatus(data); setStatusLoading(false) })
      .catch(() => setStatusLoading(false))
  }, [])

  async function handleConnect() {
    setConnectLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      // Redirect to Stripe-hosted onboarding
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setConnectLoading(false)
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    setProductLoading(true)
    setProductError(null)
    setProductSuccess(null)
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          description: product.description || undefined,
          price: parseFloat(product.price),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setProductSuccess(`"${data.name}" created — visible in the storefront`)
      setProduct({ name: "", description: "", price: "" })
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setProductLoading(false)
    }
  }

  const isActive = connectStatus?.status === "active"
  const isPending = connectStatus?.status === "pending_capability"
  const needsOnboarding =
    !connectStatus ||
    connectStatus.status === "not_started" ||
    connectStatus.status === "onboarding_required"

  const statusLabel = statusLoading
    ? "Checking status…"
    : isActive
    ? "Active — ready to receive payments"
    : isPending
    ? "Onboarding complete — waiting for capability approval"
    : connectStatus?.status === "not_started"
    ? "Not started"
    : "Onboarding required"

  const statusColor = isActive
    ? "text-green-700 bg-green-50 border-green-200"
    : isPending
    ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-gray-600 bg-gray-50 border-gray-200"

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <Link href="/" className="text-gray-500 text-sm hover:text-gray-300">← Claima</Link>

        {/* ── Connect Onboarding Card ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold mb-6">C</div>
          <h1 className="text-2xl font-bold">Connect your practice to Stripe</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Claima collects patient payments on your behalf and routes funds directly to your
            bank account. Claima takes a <span className="text-white font-medium">5% platform fee</span> on patient
            collections only.
          </p>

          {/* Fee breakdown */}
          <div className="mt-6 space-y-3">
            {[
              ["Patient pays $75 copay", "$75.00"],
              ["Claima platform fee (5%)", "−$3.75"],
              ["You receive", "$71.25"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className={`font-mono ${value.startsWith("−") ? "text-red-400" : value === "$71.25" ? "text-green-400 font-bold" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Live status badge — always fetched from Stripe V2 API directly */}
          <div className={`mt-6 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${statusColor}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-green-500" : isPending ? "bg-amber-400" : "bg-gray-400"}`} />
            {statusLabel}
          </div>

          {connectStatus?.accountId && (
            <p className="mt-2 text-xs text-gray-600 font-mono">{connectStatus.accountId}</p>
          )}

          {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

          {/* Show connect button only if onboarding is needed */}
          {needsOnboarding && (
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {connectLoading ? "Redirecting to Stripe…" : "Onboard to collect payments →"}
            </button>
          )}

          {isActive && (
            <div className="mt-6 pt-6 border-t border-gray-800 space-y-3 text-xs text-gray-500">
              <div className="flex gap-2"><span>✓</span><span>Funds deposited to your bank in 2 business days</span></div>
              <div className="flex gap-2"><span>✓</span><span>Patients see your practice name on their card statement</span></div>
              <div className="flex gap-2"><span>✓</span><span>HIPAA-compliant — no PHI stored in Stripe</span></div>
            </div>
          )}

          <p className="text-center text-xs text-gray-600 mt-4">Powered by Stripe Connect</p>
        </div>

        {/* ── Create Product Card (only shown when active) ── */}
        {isActive && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-lg font-bold mb-1">Add a service</h2>
            <p className="text-gray-400 text-sm mb-6">
              Services appear in the{" "}
              <Link href="/store" className="text-blue-400 hover:text-blue-300">patient storefront</Link>{" "}
              for direct payment.
            </p>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Service name</label>
                <input
                  value={product.name}
                  onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Initial Consultation"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description <span className="text-gray-600">(optional)</span></label>
                <input
                  value={product.description}
                  onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. 60-minute individual therapy session"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    value={product.price}
                    onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value }))}
                    placeholder="75.00"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {productError && <p className="text-red-400 text-sm">{productError}</p>}
              {productSuccess && <p className="text-green-400 text-sm">{productSuccess}</p>}

              <button
                type="submit"
                disabled={productLoading}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {productLoading ? "Creating…" : "Create service"}
              </button>
            </form>
          </div>
        )}

        <div className="flex gap-4 text-xs text-gray-600">
          <Link href="/store" className="hover:text-gray-400">View storefront →</Link>
          <Link href="/billing" className="hover:text-gray-400">Patient billing →</Link>
        </div>
      </div>
    </div>
  )
}
