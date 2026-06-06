"use client"

import { useEffect, useState } from "react"
import NavBar from "@/components/NavBar"

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
  HIGH:   { bg: "bg-red-950/60",    text: "text-red-300",    dot: "bg-red-500" },
  MEDIUM: { bg: "bg-yellow-950/60", text: "text-yellow-300", dot: "bg-yellow-500" },
  LOW:    { bg: "bg-gray-800",      text: "text-gray-400",   dot: "bg-gray-600" },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: "bg-gray-800",       text: "text-gray-400",    dot: "bg-gray-500" },
  IN_PROGRESS: { bg: "bg-blue-950/60",    text: "text-blue-300",    dot: "bg-blue-500" },
  SUBMITTED:   { bg: "bg-purple-950/60",  text: "text-purple-300",  dot: "bg-purple-500" },
  WON:         { bg: "bg-green-950/60",   text: "text-green-300",   dot: "bg-green-500" },
  LOST:        { bg: "bg-red-950/60",     text: "text-red-300",     dot: "bg-red-500" },
  WRITE_OFF:   { bg: "bg-gray-800",       text: "text-gray-500",    dot: "bg-gray-700" },
}

const CATEGORY_LABELS: Record<string, string> = {
  APPEAL:               "Appeal",
  RESUBMIT:             "Resubmit",
  PATIENT_RESPONSIBILITY: "Bill Patient",
  WRITE_OFF:            "Write Off",
  INFO_NEEDED:          "Info Needed",
}

function Badge({ label, config }: { label: string; config: { bg: string; text: string; dot: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {label}
    </span>
  )
}

const DEMO_DENIALS: Denial[] = [
  {
    id: "1",
    carcCode: "197",
    denialReason: "Precertification/authorization/notification absent",
    category: "APPEAL",
    priority: "HIGH",
    action: "Submit retroactive authorization request or appeal with medical necessity",
    appealable: true,
    appealStatus: "PENDING",
    appealLetter: null,
    appealedAt: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    claim: {
      id: "c1",
      totalCharge: "250.00",
      serviceDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      patient: { firstName: "Sarah", lastName: "Johnson", payerName: "Aetna" },
      provider: { firstName: "Dr. Emily", lastName: "Chen" },
      lineItems: [{ cptCode: "90837", chargeAmount: "250.00" }],
    },
  },
  {
    id: "2",
    carcCode: "50",
    denialReason: "Not deemed a medical necessity by the payer",
    category: "APPEAL",
    priority: "HIGH",
    action: "Submit appeal with clinical notes and medical necessity letter",
    appealable: true,
    appealStatus: "IN_PROGRESS",
    appealLetter: "Sample appeal letter...",
    appealedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    resolvedAt: null,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    claim: {
      id: "c2",
      totalCharge: "175.00",
      serviceDate: new Date(Date.now() - 14 * 86400000).toISOString(),
      patient: { firstName: "Marcus", lastName: "Rivera", payerName: "BlueCross" },
      provider: { firstName: "Dr. Emily", lastName: "Chen" },
      lineItems: [{ cptCode: "90834", chargeAmount: "175.00" }],
    },
  },
  {
    id: "3",
    carcCode: "11",
    denialReason: "Diagnosis inconsistent with procedure",
    category: "RESUBMIT",
    priority: "HIGH",
    action: "Review and correct diagnosis-procedure link, resubmit",
    appealable: false,
    appealStatus: "PENDING",
    appealLetter: null,
    appealedAt: null,
    resolvedAt: null,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    claim: {
      id: "c3",
      totalCharge: "320.00",
      serviceDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      patient: { firstName: "Amanda", lastName: "Torres", payerName: "United" },
      provider: { firstName: "Dr. Emily", lastName: "Chen" },
      lineItems: [{ cptCode: "90791", chargeAmount: "320.00" }],
    },
  },
  {
    id: "4",
    carcCode: "119",
    denialReason: "Benefit maximum for this period has been reached",
    category: "PATIENT_RESPONSIBILITY",
    priority: "MEDIUM",
    action: "Notify patient of benefit exhaustion; bill patient",
    appealable: true,
    appealStatus: "PENDING",
    appealLetter: null,
    appealedAt: null,
    resolvedAt: null,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    claim: {
      id: "c4",
      totalCharge: "150.00",
      serviceDate: new Date(Date.now() - 4 * 86400000).toISOString(),
      patient: { firstName: "David", lastName: "Kim", payerName: "Cigna" },
      provider: { firstName: "Dr. Emily", lastName: "Chen" },
      lineItems: [{ cptCode: "90832", chargeAmount: "150.00" }],
    },
  },
]

export default function DenialsPage() {
  const [denials, setDenials] = useState<Denial[]>(DEMO_DENIALS)
  const [selected, setSelected] = useState<Denial | null>(null)
  const [generatingAppeal, setGeneratingAppeal] = useState(false)
  const [appealLetter, setAppealLetter] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("ALL")

  useEffect(() => {
    fetch("/api/denials")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setDenials(data)
      })
      .catch(() => {})
  }, [])

  const filtered = filter === "ALL"
    ? denials
    : denials.filter((d) =>
        filter === "APPEALABLE" ? d.appealable && d.appealStatus === "PENDING"
        : filter === "RESUBMIT" ? d.category === "RESUBMIT"
        : d.priority === filter
      )

  const totalAtRisk = denials
    .filter((d) => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus))
    .reduce((sum, d) => sum + parseFloat(d.claim.totalCharge), 0)

  async function handleGenerateAppeal(denial: Denial) {
    setGeneratingAppeal(true)
    setAppealLetter(null)
    try {
      const res = await fetch(`/api/denials/${denial.id}/appeal`, { method: "POST" })
      const data = await res.json()
      if (data.letter) {
        setAppealLetter(data.letter)
        setDenials((prev) =>
          prev.map((d) => d.id === denial.id ? { ...d, appealStatus: "IN_PROGRESS", appealLetter: data.letter } : d)
        )
      }
    } catch {
      setAppealLetter("Error generating appeal letter. Please try again.")
    } finally {
      setGeneratingAppeal(false)
    }
  }

  async function handleUpdateStatus(denial: Denial, status: string) {
    try {
      await fetch(`/api/denials/${denial.id}/appeal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appealStatus: status }),
      })
      setDenials((prev) =>
        prev.map((d) => d.id === denial.id ? { ...d, appealStatus: status } : d)
      )
      if (selected?.id === denial.id) setSelected({ ...denial, appealStatus: status })
    } catch {}
  }

  const statCards = [
    { label: "Total Denials", value: denials.length, accent: "bg-white", valueColor: "text-white" },
    { label: "High Priority", value: denials.filter((d) => d.priority === "HIGH").length, accent: "bg-red-500", valueColor: "text-red-400" },
    { label: "Appealable", value: denials.filter((d) => d.appealable && d.appealStatus === "PENDING").length, accent: "bg-yellow-500", valueColor: "text-yellow-400" },
    { label: "In Progress", value: denials.filter((d) => d.appealStatus === "IN_PROGRESS").length, accent: "bg-blue-500", valueColor: "text-blue-400" },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Denial Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">CARC triage, AI appeals, and resolution tracking</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Revenue at risk</div>
            <div className="text-2xl font-bold font-mono text-red-400">
              ${totalAtRisk.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative overflow-hidden hover:border-gray-700 transition-colors">
              <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} />
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
              <div className={`text-3xl font-bold ${stat.valueColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Left: Denials list */}
          <div className="flex-1 min-w-0">
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                ["ALL", "All"],
                ["HIGH", "High Priority"],
                ["APPEALABLE", "Appealable"],
                ["RESUBMIT", "Resubmit"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter === val
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                      : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center text-gray-600 py-16 bg-gray-900/30 border border-gray-800 rounded-xl">
                  No denials match this filter
                </div>
              )}
              {filtered.map((denial) => (
                <div
                  key={denial.id}
                  onClick={() => { setSelected(denial); setAppealLetter(denial.appealLetter) }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selected?.id === denial.id
                      ? "border-blue-500/60 bg-blue-950/20"
                      : "border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-900/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge label={denial.priority} config={PRIORITY_CONFIG[denial.priority]} />
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">
                          CARC-{denial.carcCode}
                        </span>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[denial.category]}
                        </span>
                        <Badge
                          label={denial.appealStatus.replace("_", " ")}
                          config={STATUS_CONFIG[denial.appealStatus] ?? STATUS_CONFIG.PENDING}
                        />
                      </div>
                      <div className="font-medium text-sm text-gray-100">
                        {denial.claim.patient.lastName}, {denial.claim.patient.firstName}
                        <span className="text-gray-500 font-normal ml-2">· {denial.claim.patient.payerName}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-mono">
                        {denial.claim.lineItems.map((l) => l.cptCode).join(", ")} ·{" "}
                        {new Date(denial.claim.serviceDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1.5 line-clamp-1 leading-relaxed">{denial.denialReason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-gray-100">${parseFloat(denial.claim.totalCharge).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail panel */}
          {selected && (
            <div className="w-96 shrink-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-20">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-100">Denial Detail</h2>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors text-xs">✕</button>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Patient</div>
                    <div className="font-medium text-gray-100">{selected.claim.patient.firstName} {selected.claim.patient.lastName}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{selected.claim.patient.payerName}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Denial Reason</div>
                    <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-3">
                      <div className="font-mono text-red-400 text-xs mb-1">CARC-{selected.carcCode}</div>
                      <div className="text-red-200/80 text-xs leading-relaxed">{selected.denialReason}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Recommended Action</div>
                    <div className="text-gray-300 text-xs bg-gray-800/80 border border-gray-700/50 rounded-xl p-3 leading-relaxed">{selected.action}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3">
                      <div className="text-gray-500 mb-1">Amount</div>
                      <div className="font-mono font-bold text-gray-100">${parseFloat(selected.claim.totalCharge).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3">
                      <div className="text-gray-500 mb-1">CPT Code(s)</div>
                      <div className="font-mono text-gray-100">{selected.claim.lineItems.map((l) => l.cptCode).join(", ")}</div>
                    </div>
                  </div>
                </div>

                {/* Appeal actions */}
                {selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-800 space-y-3">
                    {!appealLetter ? (
                      <button
                        onClick={() => handleGenerateAppeal(selected)}
                        disabled={generatingAppeal}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-[0.99]"
                      >
                        {generatingAppeal ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating appeal…
                          </span>
                        ) : "Generate Appeal Letter (AI) →"}
                      </button>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Appeal Letter</div>
                        <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 text-xs text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {appealLetter}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigator.clipboard.writeText(appealLetter)}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 py-2 rounded-lg text-xs font-medium transition-colors"
                          >
                            Copy Letter
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(selected, "SUBMITTED")}
                            className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-medium transition-colors"
                          >
                            Mark Submitted ✓
                          </button>
                        </div>
                      </div>
                    )}

                    {selected.appealStatus !== "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(selected, "WON")}
                          className="flex-1 bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Won ✓
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selected, "LOST")}
                          className="flex-1 bg-red-950/60 hover:bg-red-950 border border-red-900/60 text-red-300 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Lost ✗
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selected, "WRITE_OFF")}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Write Off
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-800">
                    <div className="text-xs text-gray-500 bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 leading-relaxed">
                      This denial type is not typically appealable. Follow the recommended action above.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
