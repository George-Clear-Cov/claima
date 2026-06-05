"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

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

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-900 text-red-300 border-red-700",
  MEDIUM: "bg-yellow-900 text-yellow-300 border-yellow-700",
  LOW: "bg-gray-800 text-gray-400 border-gray-700",
}

const CATEGORY_LABELS: Record<string, string> = {
  APPEAL: "Appeal",
  RESUBMIT: "Resubmit",
  PATIENT_RESPONSIBILITY: "Bill Patient",
  WRITE_OFF: "Write Off",
  INFO_NEEDED: "Info Needed",
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-800 text-gray-300",
  IN_PROGRESS: "bg-blue-900 text-blue-300",
  SUBMITTED: "bg-purple-900 text-purple-300",
  WON: "bg-green-900 text-green-300",
  LOST: "bg-red-900 text-red-300",
  WRITE_OFF: "bg-gray-700 text-gray-400",
}

// Demo denials for preview (no DB needed)
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
      lineItems: [
        { cptCode: "90791", chargeAmount: "320.00" },
      ],
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-gray-500 text-sm hover:text-gray-300">← MediBill</Link>
            <h1 className="text-2xl font-bold mt-1">Denial Management</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Revenue at risk</div>
            <div className="text-2xl font-bold font-mono text-red-400">
              ${totalAtRisk.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Denials", value: denials.length, color: "text-white" },
            { label: "High Priority", value: denials.filter((d) => d.priority === "HIGH").length, color: "text-red-400" },
            { label: "Appealable", value: denials.filter((d) => d.appealable && d.appealStatus === "PENDING").length, color: "text-yellow-400" },
            { label: "In Progress", value: denials.filter((d) => d.appealStatus === "IN_PROGRESS").length, color: "text-blue-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
              <div className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === val
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center text-gray-500 py-12">No denials found</div>
              )}
              {filtered.map((denial) => (
                <div
                  key={denial.id}
                  onClick={() => { setSelected(denial); setAppealLetter(denial.appealLetter) }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selected?.id === denial.id
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-gray-800 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_STYLES[denial.priority]}`}>
                          {denial.priority}
                        </span>
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                          CARC-{denial.carcCode}
                        </span>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                          {CATEGORY_LABELS[denial.category]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[denial.appealStatus]}`}>
                          {denial.appealStatus.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-1.5 font-medium text-sm">
                        {denial.claim.patient.lastName}, {denial.claim.patient.firstName}
                        <span className="text-gray-400 font-normal ml-2">· {denial.claim.patient.payerName}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {denial.claim.lineItems.map((l) => l.cptCode).join(", ")} ·{" "}
                        {new Date(denial.claim.serviceDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">{denial.denialReason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold">${parseFloat(denial.claim.totalCharge).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail panel */}
          {selected && (
            <div className="w-96 shrink-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Denial Detail</h2>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Patient</div>
                    <div className="font-medium">{selected.claim.patient.firstName} {selected.claim.patient.lastName}</div>
                    <div className="text-gray-400">{selected.claim.patient.payerName}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Denial Reason</div>
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                      <div className="font-mono text-red-300 text-xs mb-1">CARC-{selected.carcCode}</div>
                      <div className="text-red-200 text-xs">{selected.denialReason}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recommended Action</div>
                    <div className="text-gray-300 text-xs bg-gray-800 rounded-lg p-3">{selected.action}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">Amount</div>
                      <div className="font-mono font-bold">${parseFloat(selected.claim.totalCharge).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">CPT Code(s)</div>
                      <div className="font-mono">{selected.claim.lineItems.map((l) => l.cptCode).join(", ")}</div>
                    </div>
                  </div>
                </div>

                {/* Appeal actions */}
                {selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-700 space-y-3">
                    {!appealLetter ? (
                      <button
                        onClick={() => handleGenerateAppeal(selected)}
                        disabled={generatingAppeal}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {generatingAppeal ? "Generating appeal letter..." : "Generate Appeal Letter (AI)"}
                      </button>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Appeal Letter</div>
                        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {appealLetter}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigator.clipboard.writeText(appealLetter)}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-xs font-medium transition-colors"
                          >
                            Copy Letter
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(selected, "SUBMITTED")}
                            className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-medium transition-colors"
                          >
                            Mark Submitted
                          </button>
                        </div>
                      </div>
                    )}

                    {selected.appealStatus !== "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(selected, "WON")}
                          className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-200 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Won ✓
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selected, "LOST")}
                          className="flex-1 bg-red-900 hover:bg-red-800 text-red-300 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Lost ✗
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selected, "WRITE_OFF")}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Write Off
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!selected.appealable && (
                  <div className="mt-5 pt-5 border-t border-gray-700">
                    <div className="text-xs text-gray-500 bg-gray-800 rounded-lg p-3">
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
