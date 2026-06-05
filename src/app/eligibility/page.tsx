"use client"

import { useState } from "react"
import Link from "next/link"

interface CoverageDetail {
  inNetwork: boolean
  deductible: number
  deductibleMet: number
  outOfPocketMax: number
  outOfPocketMet: number
  copay: number
  coinsurance: number
  visitLimit: number | null
  visitsUsed: number | null
  priorAuthRequired: boolean
  planName: string
  groupNumber: string
  effectiveDate: string
  terminationDate: string | null
}

interface EligibilityResult {
  eligible: boolean
  coverageActive: boolean
  coverage: CoverageDetail | null
  checkedAt: string
  errors?: string[]
}

const COMMON_PAYERS = [
  { id: "00431", name: "Aetna" },
  { id: "00050", name: "BlueCross BlueShield" },
  { id: "87726", name: "United Healthcare" },
  { id: "00192", name: "Cigna" },
  { id: "77003", name: "Humana" },
  { id: "01260", name: "Magellan Health" },
  { id: "47198", name: "Optum" },
  { id: "BCBSIL", name: "BlueCross IL" },
]

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function EligibilityPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    memberId: "",
    payerId: "00431",
    npi: "1234567890",
  })
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<EligibilityResult | null>(null)

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setResult(null)

    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ eligible: false, coverageActive: false, coverage: null, checkedAt: new Date().toISOString(), errors: ["Network error"] })
    } finally {
      setChecking(false)
    }
  }

  const cov = result?.coverage

  const deductibleRemaining = cov ? Math.max(cov.deductible - cov.deductibleMet, 0) : 0
  const oopRemaining = cov ? Math.max(cov.outOfPocketMax - cov.outOfPocketMet, 0) : 0
  const visitsRemaining = cov?.visitLimit != null && cov?.visitsUsed != null
    ? cov.visitLimit - cov.visitsUsed
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-gray-500 text-sm hover:text-gray-300">← MediBill</Link>
          <h1 className="text-2xl font-bold mt-1">Eligibility Verification</h1>
          <p className="text-gray-500 text-sm mt-1">Check patient insurance coverage before the appointment</p>
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="col-span-2">
            <form onSubmit={handleCheck} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Patient & Insurance</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">First Name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    placeholder="Sarah"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                    placeholder="Johnson"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Member ID</label>
                <input
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  required
                  placeholder="W123456789"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Insurance Payer</label>
                <select
                  value={form.payerId}
                  onChange={(e) => setForm({ ...form, payerId: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {COMMON_PAYERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={checking}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {checking ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Checking...
                  </span>
                ) : "Check Eligibility →"}
              </button>
            </form>
          </div>

          {/* Right: Results */}
          <div className="col-span-3">
            {!result && !checking && (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                Enter patient details and click Check Eligibility
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`rounded-xl p-4 border ${
                  result.coverageActive
                    ? "bg-green-900/30 border-green-700"
                    : "bg-red-900/30 border-red-700"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${result.coverageActive ? "text-green-400" : "text-red-400"}`}>
                      {result.coverageActive ? "✓ Active Coverage" : "✗ Inactive / Not Eligible"}
                    </div>
                  </div>
                  {result.errors?.map((e, i) => (
                    <p key={i} className="text-red-300 text-sm mt-1">{e}</p>
                  ))}
                  {cov && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="text-gray-300">{cov.planName}</span>
                      <span className="text-gray-500">Group {cov.groupNumber}</span>
                      <span className={`font-medium ${cov.inNetwork ? "text-green-400" : "text-orange-400"}`}>
                        {cov.inNetwork ? "In-Network" : "Out-of-Network"}
                      </span>
                      {cov.priorAuthRequired && (
                        <span className="text-yellow-400 font-medium">⚠ Prior Auth Required</span>
                      )}
                    </div>
                  )}
                </div>

                {cov && (
                  <>
                    {/* Cost sharing */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-4">Cost Sharing</h3>
                      <div className="grid grid-cols-2 gap-5">

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Deductible</span>
                            <span className="font-mono text-xs text-gray-400">${cov.deductibleMet} / ${cov.deductible}</span>
                          </div>
                          <ProgressBar value={cov.deductibleMet} max={cov.deductible} color="bg-blue-500" />
                          <div className="text-xs text-gray-500 mt-1">
                            <span className={deductibleRemaining === 0 ? "text-green-400 font-medium" : "text-white font-medium"}>
                              ${deductibleRemaining} remaining
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Out-of-Pocket Max</span>
                            <span className="font-mono text-xs text-gray-400">${cov.outOfPocketMet} / ${cov.outOfPocketMax}</span>
                          </div>
                          <ProgressBar value={cov.outOfPocketMet} max={cov.outOfPocketMax} color="bg-purple-500" />
                          <div className="text-xs text-gray-500 mt-1">
                            <span className={oopRemaining === 0 ? "text-green-400 font-medium" : "text-white font-medium"}>
                              ${oopRemaining} remaining
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Copay</div>
                          <div className="text-xl font-bold font-mono">${cov.copay}</div>
                          <div className="text-xs text-gray-500">per visit</div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Coinsurance</div>
                          <div className="text-xl font-bold font-mono">{cov.coinsurance}%</div>
                          <div className="text-xs text-gray-500">after deductible</div>
                        </div>
                      </div>
                    </div>

                    {/* Visit limits */}
                    {cov.visitLimit != null && (
                      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-4">Mental Health Visit Limit</h3>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Annual visits</span>
                          <span className="font-mono text-xs text-gray-400">{cov.visitsUsed} / {cov.visitLimit} used</span>
                        </div>
                        <ProgressBar
                          value={cov.visitsUsed ?? 0}
                          max={cov.visitLimit}
                          color={(visitsRemaining ?? 0) <= 5 ? "bg-red-500" : "bg-green-500"}
                        />
                        <div className="text-xs mt-1">
                          {visitsRemaining === 0 ? (
                            <span className="text-red-400 font-medium">⚠ Visit limit exhausted — patient may be liable for full cost</span>
                          ) : (
                            <span className={`font-medium ${(visitsRemaining ?? 0) <= 5 ? "text-orange-400" : "text-green-400"}`}>
                              {visitsRemaining} visits remaining
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Prior auth alert */}
                    {cov.priorAuthRequired && (
                      <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
                        <div className="font-semibold text-yellow-300 text-sm">⚠ Prior Authorization Required</div>
                        <p className="text-yellow-200 text-xs mt-1">
                          This payer requires prior authorization for mental health services. Obtain authorization before the appointment to avoid denial (CARC-197).
                        </p>
                      </div>
                    )}

                    {/* Patient estimate */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Patient Responsibility Estimate</h3>
                      <div className="text-xs text-gray-400 space-y-1">
                        {deductibleRemaining > 0 ? (
                          <p>Patient owes <span className="text-white font-medium">${Math.min(deductibleRemaining, 200).toFixed(2)}</span> toward deductible on a typical $200 therapy session</p>
                        ) : (
                          <p>Deductible met — patient owes <span className="text-white font-medium">{cov.copay > 0 ? `$${cov.copay} copay` : `${cov.coinsurance}% coinsurance`}</span></p>
                        )}
                        <p className="text-gray-600">Effective {cov.effectiveDate}{cov.terminationDate ? ` — terminates ${cov.terminationDate}` : ""}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="text-xs text-gray-600 text-right">
                  Checked at {new Date(result.checkedAt).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
