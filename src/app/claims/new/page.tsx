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

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]

const emptyNewPatient = () => ({
  firstName: "", lastName: "", dob: "", gender: "U" as "M" | "F" | "U",
  memberId: "", groupNumber: "", payerId: "", payerName: "",
  addressLine1: "", city: "", state: "", zip: "",
})

const emptyLine = (): LineItem => ({
  cptCode: "",
  icd10Codes: [],
  modifier: "",
  units: 1,
  chargeAmount: "",
  description: "",
})

const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"

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

  interface ScrubIssue { severity: "error" | "warning" | "info"; message: string; fix: string }
  interface ScrubResult { score: number; verdict: "clean" | "caution" | "warning"; issues: ScrubIssue[]; summary: string }
  const [scrubResult, setScrubResult] = useState<ScrubResult | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [denialRisk, setDenialRisk] = useState<{ denialRate: number; sampleSize: number; topReasons: { reason: string; count: number }[]; riskLevel: string; message: string } | null>(null)

  // Inline new-patient form
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatient, setNewPatient] = useState(emptyNewPatient())
  const [savingPatient, setSavingPatient] = useState(false)
  const [patientSaveError, setPatientSaveError] = useState<string | null>(null)

  // NLP quick entry
  const [nlpText, setNlpText] = useState("")
  const [nlpParsing, setNlpParsing] = useState(false)
  const [nlpNote, setNlpNote] = useState<string | null>(null)

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

  function addLine() { setLines((prev) => [...prev, emptyLine()]) }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)) }

  function toggleIcd10(idx: number, code: string) {
    const line = lines[idx]
    const has = line.icd10Codes.includes(code)
    updateLine(idx, {
      icd10Codes: has
        ? line.icd10Codes.filter((c) => c !== code)
        : [...line.icd10Codes, code].slice(0, 4),
    })
  }

  async function handleNLPParse() {
    if (!nlpText.trim() || !ctx) return
    setNlpParsing(true)
    setNlpNote(null)
    try {
      const res = await fetch("/api/claims/parse-natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpText, patients: ctx.patients, providers: ctx.providers }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? "Parse failed")
      if (data.patientId) setPatientId(data.patientId)
      if (data.providerId) setProviderId(data.providerId)
      if (data.serviceDate) setServiceDate(data.serviceDate)
      if (data.cptCode || data.icd10Codes || data.chargeAmount) {
        setLines([{
          cptCode: data.cptCode ?? "",
          icd10Codes: data.icd10Codes ?? [],
          modifier: "",
          units: 1,
          chargeAmount: data.chargeAmount?.toString() ?? "",
          description: COMMON_CPT_CODES.find((c) => c.code === data.cptCode)?.description ?? "",
        }])
      }
      setNlpNote(data.explanation ?? `Filled from description (${data.confidence ?? "?"}% confidence)`)
    } catch (err) {
      setNlpNote(err instanceof Error ? err.message : "Could not parse description")
    } finally {
      setNlpParsing(false)
    }
  }

  async function handleSavePatient() {
    setSavingPatient(true)
    setPatientSaveError(null)
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPatient),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = Array.isArray(data.error)
          ? data.error.map((e: { message: string }) => e.message).join(", ")
          : (data.error ?? "Failed to save patient")
        throw new Error(msg)
      }
      setCtx(prev => prev ? { ...prev, patients: [...prev.patients, data] } : prev)
      setPatientId(data.id)
      setShowNewPatient(false)
      setNewPatient(emptyNewPatient())
    } catch (e) {
      setPatientSaveError(e instanceof Error ? e.message : "Failed to save patient")
    } finally {
      setSavingPatient(false)
    }
  }

  async function handleScrub() {
    if (!lines[0]?.cptCode || !lines[0]?.icd10Codes.length) return
    setScrubbing(true)
    setScrubResult(null)
    setDenialRisk(null)
    const selectedPatientData = ctx?.patients.find((p) => p.id === patientId)
    const payerName = selectedPatientData?.payerName ?? "Unknown"

    // Run scrub + denial risk in parallel
    await Promise.all([
      fetch("/api/claims/scrub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cptCode: lines[0].cptCode,
          icd10Codes: lines[0].icd10Codes,
          modifier: lines[0].modifier || undefined,
          payerName,
          charge: lines.reduce((s, l) => s + (parseFloat(l.chargeAmount) || 0) * l.units, 0),
          serviceDate,
        }),
      })
        .then(r => r.json())
        .then(setScrubResult)
        .catch(() => setScrubResult({ score: 0, verdict: "warning", issues: [{ severity: "error", message: "Scrub API unavailable", fix: "Check your connection and try again" }], summary: "Could not reach scrubber." })),

      fetch("/api/claims/denial-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerName, cptCode: lines[0].cptCode }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && d.sampleSize > 0) setDenialRisk(d) })
        .catch(() => {}),
    ])

    setScrubbing(false)
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <NavBar />
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Submit New Claim</h1>
          <p className="text-gray-500 text-sm mt-0.5">Mental health practice — 837P via Stedi clearinghouse</p>
        </div>

        {ctxLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading practice data…
          </div>
        ) : !ctx?.practice ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <p className="text-gray-500 font-medium mb-1">Unable to load practice data</p>
            <p className="text-gray-400 text-sm">Please check your connection and try refreshing the page.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* NLP Quick Entry */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">C</div>
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Quick Entry — describe the session</span>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={nlpText}
                  onChange={(e) => { setNlpText(e.target.value); setNlpNote(null) }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNLPParse() } }}
                  placeholder="e.g. &quot;Sarah had a 60-min session with Dr. Chen today, depression and anxiety&quot;"
                  rows={2}
                  className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleNLPParse}
                  disabled={!nlpText.trim() || nlpParsing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm self-stretch flex items-center gap-1.5 whitespace-nowrap"
                >
                  {nlpParsing ? (
                    <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Parsing…</>
                  ) : "Fill with AI →"}
                </button>
              </div>
              {nlpNote && (
                <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${nlpNote.includes("failed") || nlpNote.includes("error") || nlpNote.includes("Could not") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  {nlpNote}
                </div>
              )}
              <p className="text-xs text-blue-500 mt-2">AI fills patient, provider, CPT, diagnoses, and charge — review before submitting.</p>
            </div>

            {/* Visit Details */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-4">Visit Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Date</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Provider</label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    required
                    className={inputClass}
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

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">Patient</label>
                  <button
                    type="button"
                    onClick={() => { setShowNewPatient(v => !v); setPatientSaveError(null) }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {showNewPatient ? "Cancel" : "+ New patient"}
                  </button>
                </div>

                {!showNewPatient && (
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    {ctx.patients.length === 0 && (
                      <option value="">No patients yet — add one below</option>
                    )}
                    {ctx.patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.lastName}, {p.firstName} · {p.payerName} · {p.memberId}
                      </option>
                    ))}
                  </select>
                )}

                {showNewPatient && (
                  <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">New Patient</div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                        <input value={newPatient.firstName} onChange={e => setNewPatient(p => ({ ...p, firstName: e.target.value }))} placeholder="Sarah" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                        <input value={newPatient.lastName} onChange={e => setNewPatient(p => ({ ...p, lastName: e.target.value }))} placeholder="Johnson" className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
                        <input type="date" value={newPatient.dob} onChange={e => setNewPatient(p => ({ ...p, dob: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                        <select value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value as "M" | "F" | "U" }))} className={inputClass}>
                          <option value="U">Undisclosed</option>
                          <option value="F">Female</option>
                          <option value="M">Male</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Insurance Payer</label>
                      <select
                        value={newPatient.payerId}
                        onChange={e => {
                          const payer = COMMON_PAYERS.find(p => p.id === e.target.value)
                          setNewPatient(p => ({ ...p, payerId: e.target.value, payerName: payer?.name ?? "" }))
                        }}
                        className={inputClass}
                      >
                        <option value="">Select payer…</option>
                        {COMMON_PAYERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Member ID</label>
                        <input value={newPatient.memberId} onChange={e => setNewPatient(p => ({ ...p, memberId: e.target.value }))} placeholder="W123456789" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Group Number <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input value={newPatient.groupNumber} onChange={e => setNewPatient(p => ({ ...p, groupNumber: e.target.value }))} placeholder="GRP001" className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                      <input value={newPatient.addressLine1} onChange={e => setNewPatient(p => ({ ...p, addressLine1: e.target.value }))} placeholder="123 Main St" className={inputClass} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                        <input value={newPatient.city} onChange={e => setNewPatient(p => ({ ...p, city: e.target.value }))} placeholder="Chicago" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                        <select value={newPatient.state} onChange={e => setNewPatient(p => ({ ...p, state: e.target.value }))} className={inputClass}>
                          <option value="">—</option>
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ZIP</label>
                        <input value={newPatient.zip} onChange={e => setNewPatient(p => ({ ...p, zip: e.target.value }))} placeholder="60601" maxLength={10} className={inputClass} />
                      </div>
                    </div>

                    {patientSaveError && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{patientSaveError}</div>
                    )}

                    <button
                      type="button"
                      onClick={handleSavePatient}
                      disabled={savingPatient || !newPatient.firstName || !newPatient.lastName || !newPatient.dob || !newPatient.memberId || !newPatient.payerId || !newPatient.addressLine1 || !newPatient.city || !newPatient.state || !newPatient.zip}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      {savingPatient ? "Saving…" : "Save Patient & Select"}
                    </button>
                  </div>
                )}
              </div>

              {selectedPatient && !showNewPatient && (
                <div className="mt-3 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  DOB: {new Date(selectedPatient.dob).toLocaleDateString()} ·
                  Member ID: <span className="font-mono">{selectedPatient.memberId}</span> ·
                  Payer: {selectedPatient.payerName}
                </div>
              )}
            </div>

            {/* Service Lines */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Service Lines</h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
                >
                  + Add line
                </button>
              </div>

              <div className="space-y-5">
                {lines.map((line, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase font-medium">Line {idx + 1}</span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-red-500 hover:text-red-600 text-xs transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">CPT Code</label>
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
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                      >
                        <option value="">Select CPT code…</option>
                        {COMMON_CPT_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
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
                                  ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <span className="font-mono font-semibold">{c.code}</span>{" "}
                              {c.description}
                            </button>
                          )
                        })}
                      </div>
                      {line.icd10Codes.length === 0 && (
                        <p className="text-red-500 text-xs mt-1.5">Select at least one diagnosis code</p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Modifier</label>
                        <input
                          type="text"
                          value={line.modifier}
                          onChange={(e) => updateLine(idx, { modifier: e.target.value })}
                          placeholder="e.g. GT"
                          maxLength={2}
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Units</label>
                        <input
                          type="number"
                          value={line.units}
                          onChange={(e) => updateLine(idx, { units: parseInt(e.target.value) || 1 })}
                          min={1}
                          required
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Charge ($)</label>
                        <input
                          type="number"
                          value={line.chargeAmount}
                          onChange={(e) => updateLine(idx, { chargeAmount: e.target.value })}
                          placeholder="0.00"
                          step="0.01"
                          min="0.01"
                          required
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Scrub results */}
            {scrubResult && (
              <div className={`rounded-xl border p-4 shadow-sm ${
                scrubResult.verdict === "clean"
                  ? "bg-green-50 border-green-200"
                  : scrubResult.verdict === "caution"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      scrubResult.verdict === "clean" ? "bg-green-100 text-green-700" :
                      scrubResult.verdict === "caution" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}>
                      {scrubResult.score}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold uppercase tracking-wider ${
                        scrubResult.verdict === "clean" ? "text-green-700" :
                        scrubResult.verdict === "caution" ? "text-amber-700" : "text-red-700"
                      }`}>
                        {scrubResult.verdict === "clean" ? "✓ Clean" : scrubResult.verdict === "caution" ? "⚠ Review" : "✗ Issues Found"}
                      </div>
                      <div className={`text-sm mt-0.5 ${
                        scrubResult.verdict === "clean" ? "text-green-800" :
                        scrubResult.verdict === "caution" ? "text-amber-800" : "text-red-800"
                      }`}>{scrubResult.summary}</div>
                    </div>
                  </div>
                  <button onClick={() => setScrubResult(null)} className="text-gray-400 hover:text-gray-600 text-xs transition-colors">✕</button>
                </div>
                {scrubResult.issues.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {scrubResult.issues.map((issue, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2.5 text-xs ${
                        issue.severity === "error" ? "bg-red-100 border border-red-200" :
                        issue.severity === "warning" ? "bg-amber-100 border border-amber-200" : "bg-blue-50 border border-blue-200"
                      }`}>
                        <div className={`font-medium mb-0.5 ${
                          issue.severity === "error" ? "text-red-800" :
                          issue.severity === "warning" ? "text-amber-800" : "text-blue-800"
                        }`}>{issue.message}</div>
                        <div className="text-gray-600">Fix: {issue.fix}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Historical denial risk from your own data */}
            {denialRisk && denialRisk.riskLevel !== "low" && (
              <div className={`rounded-xl border p-4 ${denialRisk.riskLevel === "high" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${denialRisk.riskLevel === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {denialRisk.riskLevel === "high" ? "High denial risk" : "Moderate denial risk"}
                  </span>
                  <span className={`text-xs font-mono font-semibold ${denialRisk.riskLevel === "high" ? "text-red-700" : "text-amber-700"}`}>{denialRisk.denialRate}% denial rate</span>
                </div>
                <p className={`text-sm ${denialRisk.riskLevel === "high" ? "text-red-800" : "text-amber-800"}`}>{denialRisk.message}</p>
                {denialRisk.topReasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {denialRisk.topReasons.map((r, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded ${denialRisk.riskLevel === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.reason} ({r.count}×)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Total & Submit */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Total Charge</div>
                <div className="text-2xl font-bold font-mono text-gray-900">${totalCharge.toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScrub}
                  disabled={
                    scrubbing ||
                    submitting ||
                    !providerId ||
                    !patientId ||
                    lines.some((l) => !l.cptCode || l.icd10Codes.length === 0 || !l.chargeAmount)
                  }
                  className="border border-blue-300 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5"
                >
                  {scrubbing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Reviewing…
                    </>
                  ) : scrubResult ? "Re-check" : "Review with AI"}
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !providerId ||
                    !patientId ||
                    lines.some((l) => !l.cptCode || l.icd10Codes.length === 0 || !l.chargeAmount)
                  }
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-sm active:scale-[0.99]"
                >
                  {submitting ? "Submitting…" : "Submit Claim →"}
                </button>
              </div>
            </div>

            {result && (
              <div className={`rounded-xl p-4 text-sm ${
                result.status === "accepted"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {result.status === "accepted" ? (
                  <p className="font-medium">✓ Claim accepted by clearinghouse. Redirecting to claims…</p>
                ) : (
                  <div>
                    <p className="font-medium mb-1">Claim rejected</p>
                    {result.errors?.map((e, i) => (
                      <p key={i} className="text-sm opacity-80">{e}</p>
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
