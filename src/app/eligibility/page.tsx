"use client"

import { useState, useEffect } from "react"
import NavBar from "@/components/NavBar"
import { COMMON_CPT_CODES } from "@/types/claim"

interface CoverageDetail {
  inNetwork: boolean; deductible: number; deductibleMet: number; outOfPocketMax: number; outOfPocketMet: number
  copay: number; coinsurance: number; visitLimit: number | null; visitsUsed: number | null
  priorAuthRequired: boolean; planName: string; groupNumber: string; effectiveDate: string; terminationDate: string | null
}

interface EligibilityResult {
  eligible: boolean; coverageActive: boolean; coverage: CoverageDetail | null; checkedAt: string; errors?: string[]
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  payerName: string
  payerId: string
  memberId: string
}

interface AuthResult {
  authRequired: boolean | null
  confidence: "high" | "medium" | "low"
  summary: string
  steps: string[]
  deadline: string | null
  sessionWarning: string | null
  parityCoverage: string | null
  payerPhone: string | null
  portalUrl: string | null
  typicalTurnaround: string | null
  urgentOption: string | null
}

const AUTH_CONFIDENCE_CONFIG = {
  high:   { text: "text-green-700", bg: "bg-green-50 border-green-200", label: "High confidence" },
  medium: { text: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Medium confidence" },
  low:    { text: "text-gray-600",  bg: "bg-gray-50 border-gray-200",   label: "Verify directly" },
}

const COMMON_PAYERS = [
  { id: "00431", name: "Aetna" }, { id: "00050", name: "BlueCross BlueShield" },
  { id: "87726", name: "United Healthcare" }, { id: "00192", name: "Cigna" },
  { id: "77003", name: "Humana" }, { id: "01260", name: "Magellan Health" },
  { id: "47198", name: "Optum" }, { id: "BCBSIL", name: "BlueCross IL" },
]

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
      <div className={`h-1.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function EligibilityPage() {
  const [tab, setTab] = useState<"eligibility" | "prior-auth">("eligibility")

  // Eligibility state
  const [providers, setProviders] = useState<{ id: string; firstName: string; lastName: string; npi: string }[]>([])
  const [form, setForm] = useState({ firstName: "", lastName: "", dob: "", memberId: "", payerId: "00431", patientId: "", npi: "" })
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [interpretation, setInterpretation] = useState<{ summary: string; actions: string[]; sessionNote: string; patientOwesEstimate: number } | null>(null)
  const [interpreting, setInterpreting] = useState(false)

  // Prior Auth state
  const [patients, setPatients] = useState<Patient[]>([])
  const [authPatientId, setAuthPatientId] = useState("")
  const [authCptCode, setAuthCptCode] = useState("90837")
  const [authDate, setAuthDate] = useState(new Date().toISOString().slice(0, 10))
  const [authLoading, setAuthLoading] = useState(false)
  const [authResult, setAuthResult] = useState<AuthResult | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/context").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.patients) {
        setPatients(d.patients)
        if (d.patients.length > 0) setAuthPatientId(d.patients[0].id)
      }
      if (d?.providers) {
        setProviders(d.providers)
        if (d.providers.length > 0) setForm(f => ({ ...f, npi: d.providers[0].npi }))
      }
    }).catch(() => {})
  }, [])

  const selectedPatient = patients.find(p => p.id === authPatientId)

  async function handleAuthCheck() {
    if (!selectedPatient || !authCptCode || !authDate) return
    setAuthLoading(true)
    setAuthResult(null)
    setAuthError(null)
    try {
      const res = await fetch("/api/auth-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: authPatientId, payerName: selectedPatient.payerName, payerId: selectedPatient.payerId, cptCode: authCptCode, serviceDate: authDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Check failed")
      setAuthResult(data)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed")
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setResult(null)
    setInterpretation(null)
    try {
      const res = await fetch("/api/eligibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, patientId: form.patientId || undefined }) })
      const data = await res.json()
      setResult(data)
      if (data.coverage) {
        setInterpreting(true)
        const payerName = COMMON_PAYERS.find(p => p.id === form.payerId)?.name ?? form.payerId
        fetch("/api/eligibility/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientName: `${form.firstName} ${form.lastName}`, payerName, coverage: data.coverage }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setInterpretation(d) })
          .catch(() => {})
          .finally(() => setInterpreting(false))
      }
    } catch {
      setResult({ eligible: false, coverageActive: false, coverage: null, checkedAt: new Date().toISOString(), errors: ["Network error"] })
    } finally {
      setChecking(false)
    }
  }

  const cov = result?.coverage
  const deductibleRemaining = cov ? Math.max(cov.deductible - cov.deductibleMet, 0) : 0
  const oopRemaining = cov ? Math.max(cov.outOfPocketMax - cov.outOfPocketMet, 0) : 0
  const visitsRemaining = cov?.visitLimit != null && cov?.visitsUsed != null ? cov.visitLimit - cov.visitsUsed : null

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <NavBar />
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Eligibility & Prior Auth</h1>
          <p className="text-gray-500 text-sm mt-1">Verify coverage and check authorization requirements before the appointment</p>
        </div>

        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-fit mb-6">
          {(["eligibility", "prior-auth"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "eligibility" ? "Eligibility Check" : "Prior Auth Check"}
            </button>
          ))}
        </div>

        {tab === "eligibility" && <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2">
            <form onSubmit={handleCheck} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h2 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Patient & Insurance</h2>
              {patients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Auto-fill from patient</label>
                  <select
                    className={inputClass}
                    onChange={e => {
                      const p = patients.find(p => p.id === e.target.value)
                      if (p) setForm(f => ({ ...f, firstName: p.firstName, lastName: p.lastName, memberId: p.memberId, payerId: p.payerId || f.payerId, patientId: p.id }))
                    }}
                  >
                    <option value="">— select patient —</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.payerName}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required placeholder="Sarah" className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required placeholder="Johnson" className={inputClass} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Date of Birth</label><input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Member ID</label><input value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} required placeholder="W123456789" className={inputClass} /></div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Insurance Payer</label>
                <select value={form.payerId} onChange={(e) => setForm({ ...form, payerId: e.target.value })} className={inputClass}>
                  {COMMON_PAYERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {providers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Rendering Provider</label>
                  <select value={form.npi} onChange={e => setForm({ ...form, npi: e.target.value })} className={inputClass}>
                    {providers.map(p => <option key={p.id} value={p.npi}>{p.firstName} {p.lastName} · NPI {p.npi}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" disabled={checking || !form.npi} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.99]">
                {checking ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Checking…</span> : "Check Eligibility →"}
              </button>
            </form>
          </div>

          <div className="col-span-3">
            {!result && !checking && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-gray-400 text-sm">Enter patient details and click Check Eligibility</p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* AI interpretation */}
                {(interpreting || interpretation) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
                      <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">AI Summary</span>
                      {interpreting && <svg className="animate-spin h-3.5 w-3.5 text-blue-500 ml-auto" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    </div>
                    {interpretation && (
                      <>
                        <p className="text-sm text-blue-900 leading-relaxed mb-3">{interpretation.summary}</p>
                        {interpretation.actions.length > 0 && (
                          <ul className="space-y-1 mb-3">
                            {interpretation.actions.map((a, i) => (
                              <li key={i} className="text-xs text-blue-800 flex gap-1.5"><span className="text-blue-500 shrink-0">→</span>{a}</li>
                            ))}
                          </ul>
                        )}
                        {interpretation.sessionNote && (
                          <div className="bg-white/60 rounded-lg px-3 py-2 text-xs text-blue-700">
                            <span className="font-medium">Chart note: </span>{interpretation.sessionNote}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className={`rounded-xl p-4 border ${result.coverageActive ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${result.coverageActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{result.coverageActive ? "✓" : "✗"}</div>
                    <div className={`text-lg font-bold ${result.coverageActive ? "text-green-800" : "text-red-800"}`}>{result.coverageActive ? "Active Coverage" : "Inactive / Not Eligible"}</div>
                  </div>
                  {result.errors?.map((e, i) => <p key={i} className="text-red-600 text-sm mt-1.5">{e}</p>)}
                  {cov && (
                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                      <span className="text-gray-700 font-medium">{cov.planName}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">Group {cov.groupNumber}</span>
                      <span className="text-gray-400">·</span>
                      <span className={`font-medium ${cov.inNetwork ? "text-green-700" : "text-orange-700"}`}>{cov.inNetwork ? "In-Network" : "Out-of-Network"}</span>
                      {cov.priorAuthRequired && <span className="text-amber-700 font-medium">· ⚠ Prior Auth Required</span>}
                    </div>
                  )}
                </div>

                {cov && (
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-4">Cost Sharing</h3>
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Deductible</span><span className="font-mono text-gray-400">${cov.deductibleMet} / ${cov.deductible}</span></div>
                          <ProgressBar value={cov.deductibleMet} max={cov.deductible} color="bg-blue-500" />
                          <div className="text-xs mt-1.5"><span className={deductibleRemaining === 0 ? "text-green-600 font-medium" : "text-gray-900 font-medium"}>${deductibleRemaining} remaining</span></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Out-of-Pocket Max</span><span className="font-mono text-gray-400">${cov.outOfPocketMet} / ${cov.outOfPocketMax}</span></div>
                          <ProgressBar value={cov.outOfPocketMet} max={cov.outOfPocketMax} color="bg-purple-500" />
                          <div className="text-xs mt-1.5"><span className={oopRemaining === 0 ? "text-green-600 font-medium" : "text-gray-900 font-medium"}>${oopRemaining} remaining</span></div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3"><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Copay</div><div className="text-xl font-bold font-mono text-gray-900">${cov.copay}</div><div className="text-xs text-gray-400 mt-0.5">per visit</div></div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3"><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Coinsurance</div><div className="text-xl font-bold font-mono text-gray-900">{cov.coinsurance}%</div><div className="text-xs text-gray-400 mt-0.5">after deductible</div></div>
                      </div>
                    </div>

                    {cov.visitLimit != null && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-4">Mental Health Visit Limit</h3>
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Annual visits</span><span className="font-mono text-gray-400">{cov.visitsUsed} / {cov.visitLimit} used</span></div>
                        <ProgressBar value={cov.visitsUsed ?? 0} max={cov.visitLimit} color={(visitsRemaining ?? 0) <= 5 ? "bg-red-500" : "bg-green-500"} />
                        <div className="text-xs mt-1.5">{visitsRemaining === 0 ? <span className="text-red-600 font-medium">⚠ Visit limit exhausted — patient may be liable for full cost</span> : <span className={`font-medium ${(visitsRemaining ?? 0) <= 5 ? "text-orange-600" : "text-green-600"}`}>{visitsRemaining} visits remaining</span>}</div>
                      </div>
                    )}

                    {cov.priorAuthRequired && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="font-semibold text-amber-800 text-sm mb-1">⚠ Prior Authorization Required</div>
                        <p className="text-amber-700 text-xs leading-relaxed">This payer requires prior authorization for mental health services. Obtain authorization before the appointment to avoid denial (CARC-197).</p>
                      </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <h3 className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-3">Patient Responsibility Estimate</h3>
                      <div className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
                        {deductibleRemaining > 0 ? <p>Patient owes <span className="text-gray-900 font-medium">${Math.min(deductibleRemaining, 200).toFixed(2)}</span> toward deductible on a typical $200 therapy session</p> : <p>Deductible met — patient owes <span className="text-gray-900 font-medium">{cov.copay > 0 ? `$${cov.copay} copay` : `${cov.coinsurance}% coinsurance`}</span></p>}
                        <p className="text-gray-400">Effective {cov.effectiveDate}{cov.terminationDate ? ` · terminates ${cov.terminationDate}` : ""}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="text-xs text-gray-400 text-right">Checked at {new Date(result.checkedAt).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>}

        {tab === "prior-auth" && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Upcoming Session</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Patient</label>
                  {patients.length === 0 ? (
                    <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">No patients found — add patients in Settings first</div>
                  ) : (
                    <select value={authPatientId} onChange={e => { setAuthPatientId(e.target.value); setAuthResult(null) }} className={inputClass}>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.payerName}</option>
                      ))}
                    </select>
                  )}
                  {selectedPatient && (
                    <div className="mt-2 text-xs text-gray-400 font-mono">Member ID: {selectedPatient.memberId}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">CPT Code</label>
                    <select value={authCptCode} onChange={e => { setAuthCptCode(e.target.value); setAuthResult(null) }} className={inputClass}>
                      {COMMON_CPT_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.description}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Date</label>
                    <input type="date" value={authDate} onChange={e => { setAuthDate(e.target.value); setAuthResult(null) }} className={inputClass} />
                  </div>
                </div>

                <button
                  onClick={handleAuthCheck}
                  disabled={authLoading || !authPatientId || !authCptCode || patients.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {authLoading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Checking requirements…</>
                  ) : "Check Prior Auth Requirements →"}
                </button>
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">{authError}</div>
            )}

            {authResult && (
              <div className="space-y-4">
                <div className={`rounded-xl border p-5 ${
                  authResult.authRequired === true ? "bg-amber-50 border-amber-200" :
                  authResult.authRequired === false ? "bg-green-50 border-green-200" :
                  "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-lg font-bold mb-1 ${
                        authResult.authRequired === true ? "text-amber-800" :
                        authResult.authRequired === false ? "text-green-800" : "text-gray-700"
                      }`}>
                        {authResult.authRequired === true ? "⚠ Prior Auth Required" :
                         authResult.authRequired === false ? "✓ No Auth Required" :
                         "Cannot Determine — Verify Directly"}
                      </div>
                      <p className={`text-sm leading-relaxed ${
                        authResult.authRequired === true ? "text-amber-700" :
                        authResult.authRequired === false ? "text-green-700" : "text-gray-600"
                      }`}>{authResult.summary}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border shrink-0 ${AUTH_CONFIDENCE_CONFIG[authResult.confidence].bg} ${AUTH_CONFIDENCE_CONFIG[authResult.confidence].text}`}>
                      {AUTH_CONFIDENCE_CONFIG[authResult.confidence].label}
                    </span>
                  </div>
                </div>

                {authResult.sessionWarning && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    ⚠ {authResult.sessionWarning}
                  </div>
                )}

                {authResult.steps.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Steps to Take</h3>
                    <ol className="space-y-2">
                      {authResult.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {authResult.deadline && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-400 mb-1">Submit Auth By</div>
                      <div className="text-sm text-gray-800 font-medium">{authResult.deadline}</div>
                    </div>
                  )}
                  {authResult.typicalTurnaround && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-400 mb-1">Typical Turnaround</div>
                      <div className="text-sm text-gray-800 font-medium">{authResult.typicalTurnaround}</div>
                    </div>
                  )}
                  {authResult.payerPhone && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-400 mb-1">Payer Auth Phone</div>
                      <a href={`tel:${authResult.payerPhone.replace(/\D/g, "")}`} className="text-sm text-blue-600 font-mono font-medium hover:underline">{authResult.payerPhone}</a>
                    </div>
                  )}
                  {authResult.urgentOption && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-400 mb-1">Urgent / Same-Day</div>
                      <div className="text-sm text-gray-700">{authResult.urgentOption}</div>
                    </div>
                  )}
                </div>

                {authResult.parityCoverage && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                    <span className="font-semibold">MHPAEA:</span> {authResult.parityCoverage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
