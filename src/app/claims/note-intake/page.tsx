"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/AppLayout"
import { COMMON_CPT_CODES, COMMON_ICD10_CODES } from "@/types/claim"

interface Patient { id: string; firstName: string; lastName: string; payerName: string; memberId: string }
interface Provider { id: string; firstName: string; lastName: string; npi: string }
interface Context { practice: { id: string; name: string } | null; providers: Provider[]; patients: Patient[] }

interface Extracted {
  patientId: string | null
  patientName: string | null
  providerId: string | null
  providerName: string | null
  serviceDate: string
  sessionDurationMinutes: number | null
  cptCode: string
  additionalCptCodes: string[]
  icd10Codes: string[]
  modifier: string
  chargeAmount: number
  telehealth: boolean
  clinicalSummary: string
  confidence: number
  flags: string[]
}

const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"

const EXAMPLE_NOTE = `Patient: Sarah Johnson
Date: today
Provider: Dr. Emily Chen

S: Sarah presents reporting persistent low mood, fatigue, and difficulty concentrating over the past two weeks. Sleep is disrupted — waking at 3am. Denies suicidal ideation.

O: Alert, cooperative. Affect flat but reactive. Speech normal rate/volume.

A: Major depressive disorder, moderate recurrence. GAD contributing to sleep disruption.

P: Continued CBT, 60-minute session. Discussed sleep hygiene. Follow up in two weeks.`

export default function NoteIntakePage() {
  const router = useRouter()
  const [ctx, setCtx] = useState<Context | null>(null)
  const [note, setNote] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [error, setError] = useState<string | null>(null)

  // editable overrides
  const [patientId, setPatientId] = useState("")
  const [providerId, setProviderId] = useState("")
  const [serviceDate, setServiceDate] = useState("")
  const [cptCode, setCptCode] = useState("")
  const [icd10Codes, setIcd10Codes] = useState<string[]>([])
  const [modifier, setModifier] = useState("")
  const [chargeAmount, setChargeAmount] = useState("")

  const [placeOfService, setPlaceOfService] = useState("11")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/context").then((r) => r.json()).then((d) => setCtx(d)).catch(() => {})
  }, [])

  async function handleExtract() {
    if (!note.trim()) return
    setExtracting(true)
    setExtracted(null)
    setError(null)
    try {
      const res = await fetch("/api/claims/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note,
          patients: ctx?.patients ?? [],
          providers: ctx?.providers ?? [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Extraction failed")
      setExtracted(data)
      setPatientId(data.patientId ?? "")
      setProviderId(data.providerId ?? "")
      setServiceDate(data.serviceDate ?? new Date().toISOString().slice(0, 10))
      setCptCode(data.cptCode ?? "99213")
      setIcd10Codes(data.icd10Codes ?? [])
      setModifier(data.modifier ?? "")
      setChargeAmount(String(data.chargeAmount ?? ""))
      setPlaceOfService(data.telehealth ? "10" : "11")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract")
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit() {
    if (!ctx?.practice || !patientId || !providerId || !cptCode || icd10Codes.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceId: ctx.practice.id,
          providerId,
          patientId,
          serviceDate,
          placeOfService,
          lineItems: [{
            cptCode,
            icd10Codes,
            modifier: modifier || undefined,
            units: 1,
            chargeAmount: parseFloat(chargeAmount) || 200,
            description: extracted?.clinicalSummary || undefined,
          }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      router.push("/claims")
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  function removeIcd(code: string) {
    setIcd10Codes((prev) => prev.filter((c) => c !== code))
  }
  function addIcd(code: string) {
    if (code && !icd10Codes.includes(code)) setIcd10Codes((prev) => [...prev, code])
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-8">
          <div className="text-xs text-gray-400 mb-1">
            <span className="hover:text-gray-600 cursor-pointer" onClick={() => router.push("/claims")}>Claims</span>
            <span className="mx-1.5">›</span>
            <span>From Session Note</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Note → Claim</h1>
          <p className="text-gray-500 text-sm mt-0.5">Paste a session note — AI extracts CPT codes, diagnoses, and creates a draft claim</p>
        </div>

        <div className={`grid gap-6 ${extracted ? "grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
          {/* Left: Note input */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Note</h2>
                {!note && (
                  <button onClick={() => setNote(EXAMPLE_NOTE)} className="text-xs text-blue-600 hover:text-blue-700">
                    Try example →
                  </button>
                )}
              </div>
              <textarea
                value={note}
                onChange={(e) => { setNote(e.target.value); setExtracted(null) }}
                placeholder={"Paste SOAP note, progress note, or any session documentation here…\n\nWorks with any format — structured or free text."}
                rows={16}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all font-mono leading-relaxed"
              />
              {error && (
                <div className="mt-3 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">{error}</div>
              )}
              <button
                onClick={handleExtract}
                disabled={!note.trim() || extracting}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {extracting ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Extracting billing data…</>
                ) : "Extract with AI →"}
              </button>
            </div>
          </div>

          {/* Right: Extracted + editable claim */}
          {extracted && (
            <div className="space-y-4">
              {/* Confidence + flags */}
              <div className={`rounded-xl border p-4 ${extracted.confidence >= 80 ? "bg-green-50 border-green-200" : extracted.confidence >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-sm font-semibold ${extracted.confidence >= 80 ? "text-green-800" : extracted.confidence >= 60 ? "text-amber-800" : "text-red-800"}`}>
                    {extracted.confidence >= 80 ? "✓ High confidence extraction" : extracted.confidence >= 60 ? "Review extracted fields" : "Low confidence — verify all fields"}
                  </div>
                  <span className={`text-xs font-mono font-bold ${extracted.confidence >= 80 ? "text-green-700" : extracted.confidence >= 60 ? "text-amber-700" : "text-red-700"}`}>{extracted.confidence}%</span>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${extracted.confidence >= 80 ? "bg-green-500" : extracted.confidence >= 60 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${extracted.confidence}%` }} />
                </div>
                {extracted.flags.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {extracted.flags.map((f, i) => (
                      <li key={i} className={`text-xs ${extracted.confidence >= 80 ? "text-green-700" : "text-amber-700"}`}>⚠ {f}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Extracted Claim Data</h2>

                {/* Patient */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Patient</label>
                  {ctx?.patients?.length ? (
                    <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
                      <option value="">— select patient —</option>
                      {ctx.patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.payerName}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      {extracted.patientName ?? "No match — add patient first"}
                    </div>
                  )}
                </div>

                {/* Provider */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Provider</label>
                  {ctx?.providers?.length ? (
                    <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputClass}>
                      <option value="">— select provider —</option>
                      {ctx.providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      {extracted.providerName ?? "No match"}
                    </div>
                  )}
                </div>

                {/* Date + CPT */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Date</label>
                    <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">CPT Code</label>
                    <select value={cptCode} onChange={(e) => setCptCode(e.target.value)} className={inputClass}>
                      {COMMON_CPT_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.code} — {c.description}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ICD-10 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Diagnosis Codes (ICD-10)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {icd10Codes.map((code) => (
                      <span key={code} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-xs font-mono">
                        {code}
                        <button onClick={() => removeIcd(code)} className="hover:text-blue-900 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                  <select onChange={(e) => { addIcd(e.target.value); e.target.value = "" }} defaultValue="" className={inputClass}>
                    <option value="">+ Add diagnosis code</option>
                    {COMMON_ICD10_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.description}</option>
                    ))}
                  </select>
                </div>

                {/* Charge + modifier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Charge ($)</label>
                    <input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} step="0.01" min="0" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Modifier</label>
                    <input value={modifier} onChange={(e) => setModifier(e.target.value)} placeholder="e.g. 95" className={inputClass} />
                    {extracted.telehealth && !modifier && (
                      <button onClick={() => setModifier("95")} className="mt-1 text-xs text-blue-600 hover:underline">Add telehealth modifier 95</button>
                    )}
                  </div>
                </div>

                {/* Place of Service */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Place of Service</label>
                  <select value={placeOfService} onChange={(e) => setPlaceOfService(e.target.value)} className={inputClass}>
                    <option value="11">11 — Office</option>
                    <option value="10">10 — Telehealth (Patient Home)</option>
                    <option value="02">02 — Telehealth (Provider Site)</option>
                    <option value="22">22 — On-Campus Outpatient Hospital</option>
                    <option value="19">19 — Off-Campus Outpatient Hospital</option>
                    <option value="49">49 — Independent Clinic</option>
                    <option value="12">12 — Home</option>
                  </select>
                  {extracted.telehealth && placeOfService === "10" && (
                    <p className="mt-1 text-xs text-blue-600">Auto-set to 10 (telehealth detected)</p>
                  )}
                </div>

                {extracted.clinicalSummary && (
                  <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="font-medium">Note:</span> {extracted.clinicalSummary}
                  </div>
                )}

                {submitError && (
                  <div className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">{submitError}</div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !patientId || !providerId || !cptCode || icd10Codes.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm"
                >
                  {submitting ? "Submitting claim…" : "Submit Claim →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
