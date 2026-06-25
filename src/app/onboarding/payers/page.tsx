"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const COMMON_PAYERS = [
  { id: "MEDICARE", name: "Medicare" },
  { id: "MEDICAID", name: "Medicaid" },
  { id: "BCBS", name: "BlueCross BlueShield" },
  { id: "AETNA", name: "Aetna" },
  { id: "UHC", name: "United Healthcare" },
  { id: "CIGNA", name: "Cigna" },
  { id: "HUMANA", name: "Humana" },
  { id: "OPTUM", name: "Optum" },
  { id: "MAGELLAN", name: "Magellan Health" },
  { id: "TRICARE", name: "TRICARE" },
  { id: "CHAMPVA", name: "CHAMPVA" },
  { id: "BCBS_FEP", name: "BlueCross FEP (Federal)" },
]

interface PayerSelection {
  payerId: string
  payerName: string
  enrollmentStatus: "PENDING" | "ACTIVE"
  claimMdPayerId: string
}

interface ExistingEnrollment {
  payerId: string
  payerName: string
  enrollmentStatus: "PENDING" | "ACTIVE" | "INACTIVE"
  claimMdPayerId: string | null
}

export default function PayerEnrollmentPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Record<string, PayerSelection>>({})
  const [existing, setExisting] = useState<ExistingEnrollment[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/practices/payers")
      .then((r) => r.json())
      .then((data) => {
        const enrollments: ExistingEnrollment[] = data.enrollments ?? []
        setExisting(enrollments)
        const initial: Record<string, PayerSelection> = {}
        for (const e of enrollments) {
          if (e.enrollmentStatus !== "INACTIVE") {
            initial[e.payerId] = {
              payerId: e.payerId,
              payerName: e.payerName,
              enrollmentStatus: e.enrollmentStatus === "ACTIVE" ? "ACTIVE" : "PENDING",
              claimMdPayerId: e.claimMdPayerId ?? "",
            }
          }
        }
        setSelected(initial)
      })
      .catch(console.error)
  }, [])

  const filtered = COMMON_PAYERS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(payer: { id: string; name: string }) {
    setSelected((prev) => {
      if (prev[payer.id]) {
        const next = { ...prev }
        delete next[payer.id]
        return next
      }
      return {
        ...prev,
        [payer.id]: {
          payerId: payer.id,
          payerName: payer.name,
          enrollmentStatus: "PENDING",
          claimMdPayerId: "",
        },
      }
    })
  }

  function setStatus(payerId: string, status: "PENDING" | "ACTIVE") {
    setSelected((prev) => ({
      ...prev,
      [payerId]: { ...prev[payerId], enrollmentStatus: status },
    }))
  }

  function setClaimMdId(payerId: string, id: string) {
    setSelected((prev) => ({
      ...prev,
      [payerId]: { ...prev[payerId], claimMdPayerId: id },
    }))
  }

  async function handleSave() {
    const payers = Object.values(selected)
    if (payers.length === 0) {
      router.push("/onboarding")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/practices/payers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payers }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to save")
      }
      router.push("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = Object.keys(selected).length
  const _ = existing // suppress unused warning

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/onboarding" className="text-xs text-gray-500 hover:text-gray-300 mb-8 block">
          ← Back to setup
        </Link>

        <h1 className="text-2xl font-bold">Payer enrollment</h1>
        <p className="text-gray-400 mt-1 text-sm leading-relaxed">
          Select which payers your practice is enrolled with through Claim.MD. This determines which
          payers you can submit claims to electronically.
        </p>

        {/* Search */}
        <div className="mt-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payers…"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Payer list */}
        <div className="mt-4 space-y-2">
          {filtered.map((payer) => {
            const isSelected = Boolean(selected[payer.id])
            const sel = selected[payer.id]

            return (
              <div
                key={payer.id}
                className={`border rounded-xl transition-colors ${
                  isSelected ? "border-blue-600 bg-blue-950/30" : "border-gray-800 bg-gray-900"
                }`}
              >
                <button
                  onClick={() => toggle(payer)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{payer.name}</div>
                    <div className="text-xs text-gray-500">{payer.id}</div>
                  </div>
                </button>

                {/* Expanded options when selected */}
                {isSelected && sel && (
                  <div className="px-4 pb-4 pt-0 border-t border-blue-900/50 mt-0 space-y-3">
                    <div className="flex items-center gap-3 pt-3">
                      <span className="text-xs text-gray-400 w-24 shrink-0">Status</span>
                      <div className="flex gap-2">
                        {(["PENDING", "ACTIVE"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatus(payer.id, s)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              sel.enrollmentStatus === s
                                ? s === "ACTIVE"
                                  ? "bg-green-900/40 border-green-700 text-green-300"
                                  : "bg-amber-900/40 border-amber-700 text-amber-300"
                                : "border-gray-700 text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {s === "PENDING" ? "Pending enrollment" : "Active"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 shrink-0">Claim.MD ID</span>
                      <input
                        value={sel.claimMdPayerId}
                        onChange={(e) => setClaimMdId(payer.id, e.target.value)}
                        placeholder="Optional payer ID from Claim.MD"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <Link href="/onboarding" className="text-xs text-gray-500 hover:text-gray-300">
            Skip for now
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {saving
              ? "Saving…"
              : selectedCount > 0
              ? `Save ${selectedCount} payer${selectedCount === 1 ? "" : "s"} →`
              : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  )
}
