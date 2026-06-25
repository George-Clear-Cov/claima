"use client"

import { useEffect, useState } from "react"
import AppLayout from "@/components/AppLayout"

interface ROIResult {
  winProbability: number
  expectedValue: number
  effortHours: number
  netROI: number
  recommendation: "APPEAL" | "RESUBMIT" | "WRITE_OFF" | "BILL_PATIENT"
  rationale: string
  keyFactors: string[]
  deadline: string | null
  historicalContext: string
}

interface Denial {
  id: string
  carcCode: string
  denialReason: string
  category: string
  priority: string
  action: string
  appealable: boolean
  appealStatus: string
  appealLetter: string | null
  appealedAt: string | null
  resolvedAt: string | null
  createdAt: string
  claim: {
    id: string
    totalCharge: string
    serviceDate: string
    patient: { firstName: string; lastName: string; payerName: string }
    provider: { firstName: string; lastName: string }
    lineItems: { cptCode: string; chargeAmount: string }[]
  }
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  HIGH:   { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  MEDIUM: { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  LOW:    { bg: "bg-gray-100",  text: "text-gray-600",   dot: "bg-gray-400" },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400" },
  IN_PROGRESS: { bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500" },
  SUBMITTED:   { bg: "bg-purple-50",   text: "text-purple-700",  dot: "bg-purple-500" },
  WON:         { bg: "bg-green-50",    text: "text-green-700",   dot: "bg-green-500" },
  LOST:        { bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500" },
  WRITE_OFF:   { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-400" },
}

const CATEGORY_LABELS: Record<string, string> = {
  APPEAL: "Appeal", RESUBMIT: "Resubmit",
  PATIENT_RESPONSIBILITY: "Bill Patient", WRITE_OFF: "Write Off", INFO_NEEDED: "Info Needed",
}

function Badge({ label, config }: { label: string; config: { bg: string; text: string; dot: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {label}
    </span>
  )
}

export default function DenialsPage() {
  const [denials, setDenials] = useState<Denial[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Denial | null>(null)
  const [generatingAppeal, setGeneratingAppeal] = useState(false)
  const [appealLetter, setAppealLetter] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("ALL")
  const [autoProcessing, setAutoProcessing] = useState(false)
  const [autoResult, setAutoResult] = useState<{ processed: number; total: number } | null>(null)
  const [roi, setRoi] = useState<ROIResult | null>(null)
  const [roiLoading, setRoiLoading] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/denials").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setDenials(data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = filter === "ALL" ? denials
    : denials.filter((d) =>
        filter === "APPEALABLE" ? d.appealable && d.appealStatus === "PENDING"
        : filter === "RESUBMIT" ? d.category === "RESUBMIT"
        : d.priority === filter)

  const totalAtRisk = denials
    .filter((d) => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus))
    .reduce((sum, d) => sum + parseFloat(d.claim.totalCharge), 0)

  useEffect(() => {
    if (!selected) { setRoi(null); return }
    setRoi(null)
    setRoiLoading(true)
    fetch("/api/denials/roi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        denialId: selected.id,
        carcCode: selected.carcCode,
        denialReason: selected.denialReason,
        claimAmount: parseFloat(selected.claim.totalCharge),
        payerName: selected.claim.patient.payerName,
        cptCode: selected.claim.lineItems[0]?.cptCode ?? "",
        appealable: selected.appealable,
        category: selected.category,
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (!data.error) setRoi(data) })
      .catch(() => {})
      .finally(() => setRoiLoading(false))
  }, [selected?.id])

  async function handleGenerateAppeal(denial: Denial) {
    setGeneratingAppeal(true)
    setAppealLetter(null)
    try {
      const res = await fetch(`/api/denials/${denial.id}/appeal`, { method: "POST" })
      const data = await res.json()
      if (data.letter) {
        setAppealLetter(data.letter)
        setDenials((prev) => prev.map((d) => d.id === denial.id ? { ...d, appealStatus: "IN_PROGRESS", appealLetter: data.letter } : d))
      }
    } catch { setAppealLetter("Error generating appeal letter.") }
    finally { setGeneratingAppeal(false) }
  }

  async function handleAutoProcess() {
    setAutoProcessing(true)
    setAutoResult(null)
    try {
      const res = await fetch("/api/denials/auto-process", { method: "POST" })
      const data = await res.json()
      setAutoResult({ processed: data.processed ?? 0, total: data.total ?? 0 })
      // Refresh denials list to show AI-drafted letters
      const refreshed = await fetch("/api/denials").then((r) => r.json())
      if (Array.isArray(refreshed) && refreshed.length > 0) setDenials(refreshed)
    } catch {}
    finally { setAutoProcessing(false) }
  }

  async function handleResubmit(denial: Denial) {
    setResubmitting(true)
    try {
      const res = await fetch(`/api/denials/${denial.id}/resubmit`, { method: "POST" })
      const data = await res.json()
      if (data.claimId) {
        window.location.href = `/claims?resubmit=${data.claimId}`
      }
    } catch {}
    finally { setResubmitting(false) }
  }

  async function handleUpdateStatus(denial: Denial, status: string) {
    try {
      await fetch(`/api/denials/${denial.id}/appeal`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appealStatus: status }) })
      setDenials((prev) => prev.map((d) => d.id === denial.id ? { ...d, appealStatus: status } : d))
      if (selected?.id === denial.id) setSelected({ ...denial, appealStatus: status })
    } catch {}
  }

  const statCards = [
    { label: "Total Denials", value: denials.length, accent: "bg-gray-400", valueColor: "text-gray-900" },
    { label: "High Priority", value: denials.filter((d) => d.priority === "HIGH").length, accent: "bg-red-500", valueColor: "text-red-600" },
    { label: "Appealable", value: denials.filter((d) => d.appealable && d.appealStatus === "PENDING").length, accent: "bg-amber-500", valueColor: "text-amber-600" },
    { label: "In Progress", value: denials.filter((d) => d.appealStatus === "IN_PROGRESS").length, accent: "bg-blue-500", valueColor: "text-blue-600" },
  ]

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Denial Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">CARC triage, AI appeals, and resolution tracking</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Revenue at risk</div>
              <div className="text-2xl font-bold font-mono text-red-600">${totalAtRisk.toFixed(2)}</div>
            </div>
            <button
              onClick={handleAutoProcess}
              disabled={autoProcessing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
              {autoProcessing ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Processing…</>
              ) : "Auto-process all →"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">{stat.label}</div>
              <div className={`text-3xl font-bold ${stat.valueColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {autoResult && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm flex items-center justify-between border ${autoResult.processed > 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
            <span>
              {autoResult.processed > 0
                ? `✓ AI drafted ${autoResult.processed} appeal letter${autoResult.processed > 1 ? "s" : ""} — review and mark submitted when ready`
                : "No pending denials without appeal letters found"}
            </span>
            <button onClick={() => setAutoResult(null)} className="text-xs opacity-60 hover:opacity-100 ml-4">✕</button>
          </div>
        )}

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4 flex-wrap">
              {[["ALL", "All"], ["HIGH", "High Priority"], ["APPEALABLE", "Appealable"], ["RESUBMIT", "Resubmit"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === val ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 shadow-sm"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Loading denials…
                </div>
              ) : denials.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <p className="text-gray-700 font-medium mb-1">No denials yet</p>
                  <p className="text-gray-400 text-sm mt-1">Denials appear here when you record a payer rejection from the Claims page.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-16 bg-white border border-gray-200 rounded-xl shadow-sm">No denials match this filter</div>
              ) : null}
              {!loading && filtered.map((denial) => (
                <div key={denial.id} onClick={() => { setSelected(denial); setAppealLetter(denial.appealLetter) }}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition-all shadow-sm ${selected?.id === denial.id ? "border-blue-400 ring-1 ring-blue-400/20" : "border-gray-200 hover:border-gray-300 hover:shadow-md"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge label={denial.priority} config={PRIORITY_CONFIG[denial.priority?.toUpperCase()] ?? PRIORITY_CONFIG.LOW} />
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">CARC-{denial.carcCode}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[denial.category]}</span>
                        <Badge label={denial.appealStatus.replace("_", " ")} config={STATUS_CONFIG[denial.appealStatus] ?? STATUS_CONFIG.PENDING} />
                        {denial.appealLetter && denial.appealStatus === "IN_PROGRESS" && (
                          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-medium">AI drafted</span>
                        )}
                      </div>
                      <div className="font-medium text-sm text-gray-900">{denial.claim.patient.lastName}, {denial.claim.patient.firstName}
                        <span className="text-gray-400 font-normal ml-2">· {denial.claim.patient.payerName}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 font-mono">{denial.claim.lineItems.map((l) => l.cptCode).join(", ")} · {new Date(denial.claim.serviceDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500 mt-1.5 line-clamp-1">{denial.denialReason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-gray-900">${parseFloat(denial.claim.totalCharge).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div className="w-96 shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-20 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">Denial Detail</h2>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-xs">✕</button>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Patient</div>
                    <div className="font-medium text-gray-900">{selected.claim.patient.firstName} {selected.claim.patient.lastName}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{selected.claim.patient.payerName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Denial Reason</div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="font-mono text-red-600 text-xs mb-1">CARC-{selected.carcCode}</div>
                      <div className="text-red-700 text-xs leading-relaxed">{selected.denialReason}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Recommended Action</div>
                    <div className="text-gray-700 text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 leading-relaxed">{selected.action}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">Amount</div>
                      <div className="font-mono font-bold text-gray-900">${parseFloat(selected.claim.totalCharge).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">CPT Code(s)</div>
                      <div className="font-mono text-gray-900">{selected.claim.lineItems.map((l) => l.cptCode).join(", ")}</div>
                    </div>
                  </div>

                  {/* ROI Analysis */}
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Appeal ROI</div>
                    {roiLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Analyzing…
                      </div>
                    ) : roi ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Win Probability</span>
                            <span className={`font-bold ${roi.winProbability >= 50 ? "text-green-600" : roi.winProbability >= 30 ? "text-amber-600" : "text-red-600"}`}>{roi.winProbability}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${roi.winProbability >= 50 ? "bg-green-500" : roi.winProbability >= 30 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${roi.winProbability}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-400 mb-0.5">Expected Value</div>
                            <div className="font-mono font-bold text-gray-800">${roi.expectedValue.toFixed(0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-0.5">Net ROI</div>
                            <div className={`font-mono font-bold ${roi.netROI >= 0 ? "text-green-600" : "text-red-600"}`}>${roi.netROI.toFixed(0)}</div>
                          </div>
                        </div>
                        <div className={`text-xs px-2.5 py-1.5 rounded-lg font-medium text-center ${
                          roi.recommendation === "APPEAL" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          roi.recommendation === "RESUBMIT" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          roi.recommendation === "BILL_PATIENT" ? "bg-green-50 text-green-700 border border-green-200" :
                          "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}>
                          Recommended: {roi.recommendation.replace("_", " ")}
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">{roi.rationale}</div>
                        {roi.historicalContext && (
                          <div className="text-xs text-gray-400 italic border-t border-gray-200 pt-2">{roi.historicalContext}</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-200 space-y-3">
                    <button
                      onClick={() => handleResubmit(selected)}
                      disabled={resubmitting}
                      className="w-full bg-white hover:bg-amber-50 border border-amber-300 text-amber-700 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
                    >
                      {resubmitting ? "Creating draft…" : "Resubmit Corrected Claim →"}
                    </button>
                    {!appealLetter ? (
                      <button onClick={() => handleGenerateAppeal(selected)} disabled={generatingAppeal}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-[0.99]">
                        {generatingAppeal ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Generating appeal…
                          </span>
                        ) : "Generate Appeal Letter (AI) →"}
                      </button>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Appeal Letter</div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">{appealLetter}</div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => navigator.clipboard.writeText(appealLetter)}
                            className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm">Copy Letter</button>
                          <button onClick={() => handleUpdateStatus(selected, "SUBMITTED")}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-medium transition-colors shadow-sm">Mark Submitted ✓</button>
                        </div>
                      </div>
                    )}
                    {selected.appealStatus !== "PENDING" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateStatus(selected, "WON")} className="flex-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 py-1.5 rounded-lg text-xs font-medium transition-colors">Won ✓</button>
                        <button onClick={() => handleUpdateStatus(selected, "LOST")} className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 py-1.5 rounded-lg text-xs font-medium transition-colors">Lost ✗</button>
                        <button onClick={() => handleUpdateStatus(selected, "WRITE_OFF")} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-1.5 rounded-lg text-xs font-medium transition-colors">Write Off</button>
                      </div>
                    )}
                  </div>
                )}

                {!selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-200 space-y-2">
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3 leading-relaxed">This denial type is not typically appealable. Follow the recommended action above.</div>
                    {selected.category === "RESUBMIT" && (
                      <button
                        onClick={() => handleResubmit(selected)}
                        disabled={resubmitting}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
                      >
                        {resubmitting ? "Creating draft…" : "Resubmit Corrected Claim →"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
