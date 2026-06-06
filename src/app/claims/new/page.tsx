"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { COMMON_CPT_CODES, COMMON_ICD10_CODES } from "@/types/claim"
import NavBar from "@/components/NavBar"

interface LineItem {
  cptCode: string
  icd10Codes: string[]
  modifier: string
  units: number
  chargeAmount: string
  description: string
}

interface Provider {
  id: string
  firstName: string
  lastName: string
  npi: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  memberId: string
  payerName: string
}

interface Context {
  practice: { id: string; name: string } | null
  providers: Provider[]
  patients: Patient[]
}

const emptyLine = (): LineItem => ({
  cptCode: "",
  icd10Codes: [],
  modifier: "",
  units: 1,
  chargeAmount: "",
  description: "",
})

export default function NewClaimPage() {
  const router = useRouter()

  const [ctx, setCtx] = useState<Context | null>(null)
  const [ctxLoading, setCtxLoading] = useState(true)

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [providerId, setProviderId] = useState("")
  const [patientId, setPatientId] = useState("")
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ status: string; errors?: string[] } | null>(null)

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then((data: Context) => {
        setCtx(data)
        if (data.providers.length > 0) setProviderId(data.providers[0].id)
        if (data.patients.length > 0) setPatientId(data.patients[0].id)
      })
      .catch(() => {})
      .finally(() => setCtxLoading(false))
  }, [])

  const totalCharge = lines.reduce(
    (sum, l) => sum + (parseFloat(l.chargeAmount) || 0) * l.units,
    0
  )

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleIcd10(idx: number, code: string) {
    const line = lines[idx]
    const has = line.icd10Codes.includes(code)
    updateLine(idx, {
      icd10Codes: has
        ? line.icd10Codes.filter((c) => c !== code)
        : [...line.icd10Codes, code].slice(0, 4),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ctx?.practice?.id || !providerId || !patientId) return
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceId: ctx.practice.id,
          providerId,
          patientId,
          serviceDate,
          lineItems: lines.map((l) => ({
            cptCode: l.cptCode,
            icd10Codes: l.icd10Codes,
            modifier: l.modifier || undefined,
            units: l.units,
            chargeAmount: parseFloat(l.chargeAmount),
            description: l.description || undefined,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({ status: "error", errors: [JSON.stringify(data.error)] })
      } else {
        setResult({ status: data.stediStatus, errors: data.errors })
        if (data.stediStatus === "accepted") {
          setTimeout(() => router.push("/claims"), 1500)
        }
      }
    } catch {
      setResult({ status: "error", errors: ["Network error"] })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPatient = ctx?.patients.find((p) => p.id === patientId)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Submit New Claim</h1>
          <p className="text-gray-500 text-sm mt-1">
            Mental health practice — 837P via Stedi clearinghouse
          </p>
        </div>

        {ctxLoading ? (
          <div className="text-gray-500 text-center py-20">Loading practice data…</div>
        ) : !ctx?.practice ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-2">Practice data unavailable</p>
            <p className="text-gray-600 text-sm">Ensure the database is connected.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Visit Details */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Visit Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Service Date</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Provider</label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {ctx.providers.length === 0 && (
                      <option value="">No providers — add one in Settings</option>
                    )}
                    {ctx.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} · NPI {p.npi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Patient selector */}
              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-1">Patient</label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {ctx.patients.length === 0 && (
                    <option value="">No patients — add one in Settings</option>
                  )}
                  {ctx.patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName} · {p.payerName} · {p.memberId}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPatient && (
                <div className="mt-3 text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
                  DOB: {new Date(selectedPatient.dob).toLocaleDateString()} ·
                  Member ID: {selectedPatient.memberId} ·
                  Payer: {selectedPatient.payerName}
                </div>
              )}
            </div>

            {/* Service Lines */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Service Lines</h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  + Add line
                </button>
              </div>

              <div className="space-y-6">
                {lines.map((line, idx) => (
                  <div key={idx} className="border border-gray-700 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase font-medium">Line {idx + 1}</span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-red-500 hover:text-red-400 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* CPT Code */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">CPT Code</label>
                      <select
                        value={line.cptCode}
                        onChange={(e) => {
                          const found = COMMON_CPT_CODES.find((c) => c.code === e.target.value)
                          updateLine(idx, {
                            cptCode: e.target.value,
                            description: found?.description || line.description,
                          })
                        }}
                        required
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select CPT code…</option>
                        {COMMON_CPT_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ICD-10 Codes */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Diagnosis Codes (ICD-10) — select up to 4
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {COMMON_ICD10_CODES.map((c) => {
                          const sel = line.icd10Codes.includes(c.code)
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => toggleIcd10(idx, c.code)}
                              className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                                sel
                                  ? "border-blue-500 bg-blue-900/40 text-blue-300"
                                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                              }`}
                            >
                              <span className="font-mono font-bold">{c.code}</span>{" "}
                              {c.description}
                            </button>
                          )
                        })}
                      </div>
                      {line.icd10Codes.length === 0 && (
                        <p className="text-red-500 text-xs mt-1">Select at least one diagnosis code</p>
                      )}
                    </div>

                    {/* Modifier, Units, Charge */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Modifier</label>
                        <input
                          type="text"
                          value={line.modifier}
                          onChange={(e) => updateLine(idx, { modifier: e.target.value })}
                          placeholder="e.g. GT"
                          maxLength={2}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Units</label>
                        <input
                          type="number"
                          value={line.units}
                          onChange={(e) => updateLine(idx, { units: parseInt(e.target.value) || 1 })}
                          min={1}
                          required
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Charge ($)</label>
                        <input
                          type="number"
                          value={line.chargeAmount}
                          onChange={(e) => updateLine(idx, { chargeAmount: e.target.value })}
                          placeholder="0.00"
                          step="0.01"
                          min="0.01"
                          required
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total & Submit */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Total Charge</div>
                <div className="text-2xl font-bold font-mono">${totalCharge.toFixed(2)}</div>
              </div>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !providerId ||
                  !patientId ||
                  lines.some((l) => !l.cptCode || l.icd10Codes.length === 0 || !l.chargeAmount)
                }
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Claim →"}
              </button>
            </div>

            {/* Result banner */}
            {result && (
              <div
                className={`rounded-xl p-4 text-sm ${
                  result.status === "accepted"
                    ? "bg-green-900/50 border border-green-700 text-green-300"
                    : "bg-red-900/50 border border-red-700 text-red-300"
                }`}
              >
                {result.status === "accepted" ? (
                  <p>✓ Claim accepted by clearinghouse. Redirecting…</p>
                ) : (
                  <div>
                    <p className="font-medium">Claim rejected</p>
                    {result.errors?.map((e, i) => (
                      <p key={i} className="mt-1 opacity-80">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
