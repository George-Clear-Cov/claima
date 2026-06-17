"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type Stripe from "stripe"

type Product = Stripe.Product & { default_price: Stripe.Price | null }

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/store/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleBuy(productId: string) {
    setBuying(productId)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create checkout")
      // Redirect to Stripe-hosted checkout
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setBuying(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
          <span className="font-semibold text-gray-900">Claima Services</span>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Back
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 mt-1 text-sm">Select a service to pay securely via Stripe.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-6" />
                <div className="h-8 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No services available yet.</p>
            <Link
              href="/billing"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Go to billing →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const price = product.default_price
              const amount = price?.unit_amount ? price.unit_amount / 100 : null
              const currency = price?.currency?.toUpperCase() ?? "USD"
              const isBuying = buying === product.id

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-between hover:shadow-sm transition-shadow"
                >
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                      {product.metadata?.practiceName ?? "Practice"}
                    </p>
                    <h2 className="text-base font-semibold text-gray-900">{product.name}</h2>
                    {product.description && (
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{product.description}</p>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="flex items-end gap-1 mb-4">
                      <span className="text-2xl font-bold text-gray-900">
                        {amount !== null ? `$${amount.toFixed(2)}` : "—"}
                      </span>
                      <span className="text-sm text-gray-400 mb-0.5">{currency}</span>
                    </div>

                    <button
                      onClick={() => handleBuy(product.id)}
                      disabled={!!buying}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {isBuying ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        "Pay with Stripe"
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
