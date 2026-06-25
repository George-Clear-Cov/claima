"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AppLayout from "@/components/AppLayout"

interface Claim {
  id: string
  claimStatus: string
  totalCharge: string
  submittedAt: string | null
  serviceDate: string
  patient: { firstName: string; lastName: string }
  provider: { firstName: string; lastName: string }
  lineItems: { cptCode: string }[]
  statement: { id: string } | null
}

interface ClaimRisk {
  claimId: string
  risk: "high" | "medium" | "low"
  reason: string
  action: string
  daysPending: number
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400" },
  SUBMITTED: { bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500" },
  ACCEPTED:  { bg: "bg-green-50",    text: "text-green-700",   dot: "bg-green-500" },
  REJECTED:  { bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500" },
  DENIED:    { bg: "bg-orange-50",   text: "text-orange-700",  dot: "bg-orange-500" },
  PAID:      { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
}

const RISK_CONFIG = {
  high:   { bg: "bg-red-50",   text: "text-red-700",   dot: "bg-red-500",   label: "High risk" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400", label: "Watch" },
  low:    { bg: "bg-gray-100", text: "text-gray-500",  dot: "bg-gray-300",  label: "On track" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}

function RiskBadge({ risk }: { risk: ClaimRisk }) {
  const cfg = RISK_CONFIG[risk.risk]
  return (
    <span
      title={`${risk.reason}\n→ ${risk.action}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

interface CallScript {
  providerLine: string
  bestTimeToCall: string
  infoToHaveReady: string[]
  script: string
  documentationNote: string
}

function CallScriptModal({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const [script, setScript] = useState<CallScript | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/claims/${claimId}/call-script`, { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setScript(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [claimId])

  function copyScript() {
    if (!script) return
    navigator.clipboard.writeText(script.script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">Payer Follow-up Call Script</h2>
            <p className="text-xs text-gray-500 mt-0.5">AI-generated verbatim script for provider services</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light px-1">×</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Generating script…
          </div>
        )}

        {script && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Provider Line</div>
                <div className="text-sm text-blue-900 font-medium">{script.providerLine}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Best Time to Call</div>
                <div className="text-sm text-amber-900">{script.bestTimeToCall}</div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Have Ready Before Calling</div>
              <ul className="space-y-1">
                {script.infoToHaveReady.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-400 shrink-0">•</span>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Call Script</div>
                <button onClick={copyScript} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  {copied ? "✓ Copied" : "Copy script"}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-72">{script.script}</pre>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">After Call — Document in Notes</div>
              <div className="text-sm text-green-800 font-mono">{script.documentationNote}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const COMMON_CARCS = [
  { code: "197", reason: "Precertification/authorization/notification absent" },
  { code: "50",  reason: "Not deemed a medical necessity by the payer" },
  { code: "11",  reason: "Diagnosis inconsistent with procedure" },
  { code: "4",   reason: "Service inconsistent with patient's age" },
  { code: "16",  reason: "Claim lacks required information or has submission errors" },
  { code: "119", reason: "Benefit maximum for this period has been reached" },
  { code: "29",  reason: "Time limit for filing has expired" },
  { code: "45",  reason: "Charges exceed contracted/legislated fee arrangement" },
  { code: "97",  reason: "Payment included in allowance for another service/procedure" },
  { code: "22",  reason: "This care may be covered by another payer (COB)" },
]

function MarkDeniedModal({ claimId, onClose, onDenied }: {
  claimId: string
  onClose: () => void
  onDenied: (claimId: string) => void
}) {
  const [carcCode, setCarcCode] = useState("197")
  const [denialReason, setDenialReason] = useState("Precertification/authorization/notification absent")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/denials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, carcCode, denialReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to record denial")
      onDenied(claimId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record denial")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">Record Payer Denial</h2>
            <p className="text-xs text-gray-500 mt-0.5">Updates claim status and opens a denial for appeal tracking</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light px-1">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">CARC Code</label>
            <select
              value={carcCode}
              onChange={e => {
                const match = COMMON_CARCS.find(c => c.code === e.target.value)
                setCarcCode(e.target.value)
                if (match) setDenialReason(match.reason)
                else setDenialReason("")
              }}
              className={inputClass}
            >
              {COMMON_CARCS.map(c => (
                <option key={c.code} value={c.code}>CARC-{c.code} — {c.reason}</option>
              ))}
              <option value="other">Other (enter manually below)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Denial Reason</label>
            <input
              value={denialReason}
              onChange={e => setDenialReason(e.target.value)}
              required
              placeholder="Payer's stated denial reason"
              className={inputClass}
            />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting || !carcCode || !denialReason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm">
              {submitting ? "Recording…" : "Record Denial →"}
            </button>
            <button type="button" onClick={onClose}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [riskMap, setRiskMap] = useState<Record<string, ClaimRisk>>({})
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [callScriptClaimId, setCallScriptClaimId] = useState<string | null>(null)
  const [denyingClaimId, setDenyingClaimId] = useState<string | null>(null)

  function handleDenied(claimId: string) {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, claimStatus: "DENIED" } : c))
    setDenyingClaimId(null)
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/claims").then((r) => r.json()),
      fetch("/api/context").then((r) => r.json()),
    ]).then(([claimsData, ctx]) => {
      const list = Array.isArray(claimsData) ? claimsData : []
      setClaims(list)
      setPracticeId(ctx?.practice?.id ?? null)
      setLoading(false)

      // Score pending claims for denial risk
      const pendingIds = list
        .filter((c: Claim) => ["SUBMITTED", "ACCEPTED"].includes(c.claimStatus))
        .map((c: Claim) => c.id)

      if (pendingIds.length > 0 && ctx?.practice?.id) {
        fetch("/api/claims/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimIds: pendingIds, practiceId: ctx.practice.id }),
        })
          .then((r) => r.json())
          .then((risks: ClaimRisk[]) => {
            const map: Record<string, ClaimRisk> = {}
            for (const r of risks) map[r.claimId] = r
            setRiskMap(map)
          })
          .catch(() => {})
      }
    }).catch(() => setLoading(false))
  }, [])

  const highRiskCount = Object.values(riskMap).filter((r) => r.risk === "high").length

  return (
    <>
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Claims</h1>
            <p className="text-gray-500 text-sm mt-0.5">837P submissions and payer responses</p>
          </div>
          <div className="flex items-center gap-3">
            {highRiskCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {highRiskCount} high-risk claim{highRiskCount > 1 ? "s" : ""} — hover for details
              </div>
            )}
            <Link
              href="/claims/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>+</span> New Claim
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading claims…
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">No claims yet</p>
            <p className="text-gray-400 text-sm mb-6">Submit your first 837P claim to get started</p>
            <Link href="/claims/new" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Submit first claim →
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPT</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Charge</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Risk</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((claim) => {
                  const canPostERA = ["SUBMITTED", "ACCEPTED"].includes(claim.claimStatus) && !claim.statement
                  const hasStatement = !!claim.statement
                  const risk = riskMap[claim.id]
                  return (
                    <tr key={claim.id} className={`hover:bg-gray-50 transition-colors ${risk?.risk === "high" ? "bg-red-50/30" : ""}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{claim.patient.lastName}, {claim.patient.firstName}</td>
                      <td className="px-5 py-3.5 text-gray-500">{claim.provider.firstName} {claim.provider.lastName}</td>
                      <td className="px-5 py-3.5 text-gray-500">{new Date(claim.serviceDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{claim.lineItems.map((l) => l.cptCode).join(", ")}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-gray-900">${parseFloat(claim.totalCharge).toFixed(2)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={claim.claimStatus} /></td>
                      <td className="px-5 py-3.5">
                        {risk ? <RiskBadge risk={risk} /> : null}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(canPostERA || hasStatement) && (
                            <Link href="/billing" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors px-2.5 py-1 rounded-md hover:bg-blue-50 whitespace-nowrap">
                              View in Billing →
                            </Link>
                          )}
                          {risk && (risk.risk === "high" || risk.daysPending >= 21) && ["SUBMITTED", "ACCEPTED"].includes(claim.claimStatus) && (
                            <button
                              onClick={() => setCallScriptClaimId(claim.id)}
                              className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors px-2.5 py-1 rounded-md hover:bg-purple-50 whitespace-nowrap"
                            >
                              Call Script
                            </button>
                          )}
                          {claim.claimStatus === "DENIED" && (
                            <Link href="/denials" className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors px-2.5 py-1 rounded-md hover:bg-orange-50 whitespace-nowrap">
                              View Denial →
                            </Link>
                          )}
                          {["SUBMITTED", "ACCEPTED"].includes(claim.claimStatus) && (
                            <button
                              onClick={() => setDenyingClaimId(claim.id)}
                              className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors px-2.5 py-1 rounded-md hover:bg-red-50 whitespace-nowrap"
                            >
                              Record Denial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
    {callScriptClaimId && (
      <CallScriptModal claimId={callScriptClaimId} onClose={() => setCallScriptClaimId(null)} />
    )}
    {denyingClaimId && (
      <MarkDeniedModal claimId={denyingClaimId} onClose={() => setDenyingClaimId(null)} onDenied={handleDenied} />
    )}
  </>
  )
}
