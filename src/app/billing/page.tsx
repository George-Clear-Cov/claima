"use client"

import { useEffect, useState, useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import AppLayout from "@/components/AppLayout"

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

interface DBStatement {
  id: string
  patientId: string
  claimId: string
  totalCharge: string
  insurancePaid: string
  adjustments: string
  patientOwes: string
  patientPaid: string
  balanceDue: string
  statementStatus: string
  dueDate: string | null
  paidAt: string | null
  notes: string | null
  patient: { firstName: string; lastName: string }
  claim: {
    serviceDate: string
    lineItems: { cptCode: string; description: string | null; chargeAmount: string; units: number }[]
    provider: { firstName: string; lastName: string }
  }
}

interface EligibleClaim {
  id: string
  totalCharge: string
  serviceDate: string
  patient: { firstName: string; lastName: string }
  provider: { firstName: string; lastName: string }
  lineItems: { cptCode: string }[]
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  SENT:        { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  PARTIAL:     { bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-500" },
  PAID:        { bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" },
  WRITE_OFF:   { bg: "bg-gray-100",   text: "text-gray-500",    dot: "bg-gray-400" },
  COLLECTIONS: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}

// ─── Stripe Card Form ────────────────────────────────────────────────────────

function StripeCheckoutForm({ amount, onSuccess, onCancel }: { amount: number; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? "Card validation failed")
      setProcessing(false)
      return
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    })

    if (result.error) {
      setError(result.error.message ?? "Payment failed")
      setProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || !elements || processing}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-[0.99]"
        >
          {processing ? "Processing…" : `Pay $${amount.toFixed(2)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── ERA Modal ───────────────────────────────────────────────────────────────

function ERAModal({ onClose, onCreated }: { onClose: () => void; onCreated: (stmt: DBStatement) => void }) {
  const [claims, setClaims] = useState<EligibleClaim[]>([])
  const [loadingClaims, setLoadingClaims] = useState(true)
  const [selectedClaimId, setSelectedClaimId] = useState("")
  const [insurancePaid, setInsurancePaid] = useState("")
  const [adjustments, setAdjustments] = useState("0")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"manual" | "parse">("manual")
  const [eobText, setEobText] = useState("")
  const [parsing, setParsing] = useState(false)
  const [parseMsg, setParseMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((data: (EligibleClaim & { claimStatus: string; statement: { id: string } | null })[]) => {
        const eligible = Array.isArray(data)
          ? data.filter((c) => ["SUBMITTED", "ACCEPTED"].includes(c.claimStatus) && !c.statement)
          : []
        setClaims(eligible)
        if (eligible.length > 0) setSelectedClaimId(eligible[0].id)
      })
      .catch(() => setClaims([]))
      .finally(() => setLoadingClaims(false))
  }, [])

  const selectedClaim = claims.find((c) => c.id === selectedClaimId)
  const totalCharge = selectedClaim ? parseFloat(selectedClaim.totalCharge) : 0
  const ins = parseFloat(insurancePaid || "0")
  const adj = parseFloat(adjustments || "0")
  const patientOwes = Math.max(totalCharge - ins - adj, 0)

  async function handleParseEOB() {
    if (!eobText.trim()) return
    setParsing(true)
    setParseMsg(null)
    try {
      const res = await fetch("/api/era/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: eobText }),
      })
      const data = await res.json()
      if (!res.ok || !data.parsed) throw new Error(data.error ?? "Parse failed")
      if (data.insurancePaid > 0) setInsurancePaid(data.insurancePaid.toFixed(2))
      if (data.adjustments > 0) setAdjustments(data.adjustments.toFixed(2))
      if (data.notes) setNotes(data.notes)
      setParseMsg(`Extracted with ${data.confidence ?? "?"}% confidence. Review values below.`)
      setTab("manual")
    } catch (err) {
      setParseMsg(err instanceof Error ? err.message : "Could not parse EOB")
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClaimId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/claims/${selectedClaimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurancePaid: ins, adjustments: adj, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to post ERA")
      onCreated(data.statement)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post ERA")
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Post Insurance Payment</h2>
            <p className="text-gray-500 text-sm mt-0.5">Record ERA / EOB and generate patient statement</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 pb-0 flex gap-0.5 border-b border-gray-200">
          {(["manual", "parse"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors -mb-px ${
                tab === t
                  ? "bg-white border border-gray-200 border-b-white text-blue-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "manual" ? "Manual Entry" : "Parse from EOB"}
            </button>
          ))}
        </div>

        {loadingClaims ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading eligible claims…</div>
        ) : claims.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 font-medium mb-1">No eligible claims</p>
            <p className="text-gray-400 text-sm">Submit a claim first, then come back to post the insurance payment.</p>
          </div>
        ) : tab === "parse" ? (
          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">Paste your EOB or ERA text below. AI will extract the insurance payment, adjustments, and CARC codes — then auto-fill the form.</p>
            <textarea
              value={eobText}
              onChange={(e) => setEobText(e.target.value)}
              placeholder="Paste EOB / ERA text here…&#10;&#10;Example: Claim # 12345678. Billed: $200.00. Allowed: $160.00. Paid: $140.00. Adjustment CO-45: $20.00. Member responsibility: $40.00."
              rows={8}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all font-mono"
            />
            {parseMsg && (
              <div className={`text-xs rounded-lg px-3 py-2 border ${
                parseMsg.includes("confidence")
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}>{parseMsg}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleParseEOB}
                disabled={!eobText.trim() || parsing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Extracting…</>
                ) : "Extract with AI →"}
              </button>
              <button type="button" onClick={onClose} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Claim</label>
              <select
                value={selectedClaimId}
                onChange={(e) => { setSelectedClaimId(e.target.value); setInsurancePaid(""); setAdjustments("0") }}
                className={inputClass}
              >
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.patient.lastName}, {c.patient.firstName} — {new Date(c.serviceDate).toLocaleDateString()} — {c.lineItems.map((l) => l.cptCode).join(", ")} — ${parseFloat(c.totalCharge).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {selectedClaim && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
                <div className="flex justify-between text-gray-500 mb-1">
                  <span>Total Billed</span>
                  <span className="font-mono font-medium text-gray-900">${totalCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Provider</span>
                  <span className="text-gray-700">{selectedClaim.provider.firstName} {selectedClaim.provider.lastName}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Insurance Paid ($)</label>
                <input type="number" value={insurancePaid} onChange={(e) => setInsurancePaid(e.target.value)} step="0.01" min="0" max={totalCharge} required placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Contractual Adjustments ($)</label>
                <input type="number" value={adjustments} onChange={(e) => setAdjustments(e.target.value)} step="0.01" min="0" placeholder="0.00" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Aetna EOB dated 06/01/2026" className={inputClass} />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between text-sm">
              <span className="text-blue-700 font-medium">Patient Responsibility</span>
              <span className="font-mono font-bold text-blue-900">${patientOwes.toFixed(2)}</span>
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting || !selectedClaimId} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm">
                {submitting ? "Posting…" : "Post Payment & Generate Statement"}
              </button>
              <button type="button" onClick={onClose} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Outreach Modal ──────────────────────────────────────────────────────────

interface OutreachData {
  sms: string
  email: string
  portal: string
}

function OutreachModal({ stmt, onClose }: { stmt: DBStatement; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OutreachData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"sms" | "email" | "portal">("sms")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/statements/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statementId: stmt.id }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [stmt.id])

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const content = data ? (tab === "sms" ? data.sms : tab === "email" ? data.email : data.portal) : ""

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Draft Outreach Message</h2>
            <p className="text-gray-500 text-sm mt-0.5">{stmt.patient.firstName} {stmt.patient.lastName} · ${parseFloat(stmt.balanceDue).toFixed(2)} balance</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">✕</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Drafting messages…
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
          </div>
        ) : data ? (
          <div className="p-6 space-y-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {(["sms", "email", "portal"] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); setCopied(false) }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t === "sms" ? "SMS" : t === "email" ? "Email" : "Portal"}
                </button>
              ))}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[100px] max-h-[260px] overflow-y-auto">
              {content}
            </div>
            {tab === "sms" && (
              <div className="text-xs text-gray-400 text-right">{content.length} / 160 chars</div>
            )}
            <button onClick={() => copy(content)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Statement Modal ─────────────────────────────────────────────────────────

type PayMode = "idle" | "initiating" | "mock" | "stripe"

function StatementModal({ stmt, onClose, onPaid }: {
  stmt: DBStatement
  onClose: () => void
  onPaid: (id: string, amount: number) => void
}) {
  const [payMode, setPayMode] = useState<PayMode>("idle")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState(parseFloat(stmt.balanceDue).toFixed(2))
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  const balanceDue = parseFloat(stmt.balanceDue)
  const patientOwes = parseFloat(stmt.patientOwes)
  const insurancePaid = parseFloat(stmt.insurancePaid)
  const adjustments = parseFloat(stmt.adjustments)
  const balancePaid = parseFloat(stmt.patientPaid)
  const totalCharge = parseFloat(stmt.totalCharge)

  async function initiatePayment() {
    setPayMode("initiating")
    setPayError(null)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          statementId: stmt.id,
          patientName: `${stmt.patient.firstName} ${stmt.patient.lastName}`,
          claimId: stmt.claimId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Payment setup failed")

      if (data.mock || !data.clientSecret) {
        setPayMode("mock")
      } else {
        setClientSecret(data.clientSecret)
        setPayMode("stripe")
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment setup failed")
      setPayMode("idle")
    }
  }

  async function handleMockPay() {
    setProcessing(true)
    setPayError(null)
    const amount = parseFloat(payAmount || "0")
    try {
      const res = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", statementId: stmt.id, amount }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      setPaid(true)
      setPayMode("idle")
      onPaid(stmt.id, amount)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setProcessing(false)
    }
  }

  function handleStripeSuccess() {
    const amount = parseFloat(payAmount)
    setPaid(true)
    setPayMode("idle")
    setClientSecret(null)
    onPaid(stmt.id, amount)
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—"

  const stripeAppearance = {
    theme: "stripe" as const,
    variables: { colorPrimary: "#2563eb", borderRadius: "8px" },
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900">Patient Statement</h2>
              <p className="text-gray-500 text-sm mt-0.5">{stmt.claim.provider.firstName} {stmt.claim.provider.lastName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">✕</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Patient</div><div className="font-medium text-gray-900">{stmt.patient.firstName} {stmt.patient.lastName}</div></div>
            <div className="text-right"><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Due Date</div><div className="text-gray-700">{fmt(stmt.dueDate)}</div></div>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-400 flex gap-4">
          <span>Claim: <span className="font-mono text-gray-600">{stmt.claimId.slice(0, 8)}…</span></span>
          <span>Service: <span className="text-gray-600">{fmt(stmt.claim.serviceDate)}</span></span>
        </div>

        <div className="p-6">
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left pb-2.5">Service</th>
                <th className="text-right pb-2.5">Charge</th>
              </tr>
            </thead>
            <tbody>
              {stmt.claim.lineItems.map((line, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="font-mono text-xs text-gray-400">{line.cptCode}</div>
                    <div className="text-gray-800 mt-0.5">{line.description ?? line.cptCode}</div>
                  </td>
                  <td className="text-right py-3 font-mono text-gray-900">${(parseFloat(line.chargeAmount) * line.units).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border border-gray-200 rounded-xl p-4 space-y-2.5 text-sm bg-gray-50 mb-4">
            <div className="flex justify-between text-gray-500"><span>Total Charges</span><span className="font-mono">${totalCharge.toFixed(2)}</span></div>
            <div className="flex justify-between text-green-600"><span>Insurance Payment</span><span className="font-mono">−${insurancePaid.toFixed(2)}</span></div>
            {adjustments > 0 && <div className="flex justify-between text-gray-400"><span>Contractual Adjustments</span><span className="font-mono">−${adjustments.toFixed(2)}</span></div>}
            <div className="flex justify-between font-semibold border-t border-gray-200 pt-2.5">
              <span className="text-gray-700">Patient Responsibility</span>
              <span className="font-mono text-gray-900">${patientOwes.toFixed(2)}</span>
            </div>
            {balancePaid > 0 && <div className="flex justify-between text-green-600"><span>Previously Paid</span><span className="font-mono">−${balancePaid.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2.5">
              <span className="text-gray-900">Balance Due</span>
              <span className={`font-mono ${balanceDue === 0 ? "text-green-600" : "text-gray-900"}`}>${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment section */}
          {balanceDue > 0 && !paid && (
            <div>
              {payMode === "idle" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        step="0.01" min="0.01" max={balanceDue}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                      />
                    </div>
                    <button
                      onClick={initiatePayment}
                      disabled={!payAmount || parseFloat(payAmount) <= 0}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                    >
                      Pay →
                    </button>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {[balanceDue, balanceDue / 2, 50].filter((n, i, arr) => n > 0 && n <= balanceDue && arr.indexOf(n) === i).map((amt) => (
                      <button key={amt} onClick={() => setPayAmount(amt.toFixed(2))} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg transition-colors font-mono shadow-sm">${amt.toFixed(2)}</button>
                    ))}
                  </div>
                  {payError && <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{payError}</div>}
                </div>
              )}

              {payMode === "initiating" && (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Setting up payment…
                </div>
              )}

              {payMode === "mock" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-medium text-amber-800">Demo mode — no card required</div>
                  <p className="text-amber-700 text-xs">Add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">STRIPE_SECRET_KEY</code> to go live.</p>
                  <div className="flex gap-2">
                    <button onClick={handleMockPay} disabled={processing} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                      {processing ? "Recording…" : `Record $${parseFloat(payAmount).toFixed(2)} payment`}
                    </button>
                    <button onClick={() => { setPayMode("idle"); setPayError(null) }} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm transition-colors shadow-sm">Back</button>
                  </div>
                  {payError && <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{payError}</div>}
                </div>
              )}

              {payMode === "stripe" && clientSecret && stripePromise && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Pay ${parseFloat(payAmount).toFixed(2)} by card</span>
                    <button onClick={() => { setPayMode("idle"); setClientSecret(null) }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
                  </div>
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                    <StripeCheckoutForm
                      amount={parseFloat(payAmount)}
                      onSuccess={handleStripeSuccess}
                      onCancel={() => { setPayMode("idle"); setClientSecret(null) }}
                    />
                  </Elements>
                </div>
              )}
            </div>
          )}

          {paid && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-green-700 font-semibold">✓ Payment of ${parseFloat(payAmount).toFixed(2)} recorded</div>
              <div className="text-green-600 text-sm mt-1">Thank you, {stmt.patient.firstName}</div>
            </div>
          )}

          {stmt.statementStatus === "PAID" && !paid && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-green-700 text-sm font-medium">✓ Paid in full · {fmt(stmt.paidAt)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Send Statement Email Button ─────────────────────────────────────────────

function SendStatementButton({ statementId }: { statementId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle")

  async function handleSend() {
    setState("loading")
    try {
      const res = await fetch(`/api/statements/${statementId}/send-outreach`, { method: "POST" })
      if (!res.ok) { setState("error"); setTimeout(() => setState("idle"), 2500); return }
      setState("sent")
      setTimeout(() => setState("idle"), 3000)
    } catch {
      setState("error")
      setTimeout(() => setState("idle"), 2500)
    }
  }

  const label = state === "loading" ? "…" : state === "sent" ? "Sent ✓" : state === "error" ? "No email" : "Send Statement"
  const color = state === "sent" ? "text-green-600 hover:text-green-700 hover:bg-green-50" : state === "error" ? "text-red-500" : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"

  return (
    <button
      onClick={handleSend}
      disabled={state === "loading" || state === "sent"}
      className={`text-xs font-medium transition-colors px-2.5 py-1 rounded-md whitespace-nowrap disabled:opacity-50 ${color}`}
    >
      {label}
    </button>
  )
}

// ─── Send Payment Link Button ────────────────────────────────────────────────

function SendPaymentLinkButton({ statementId }: { statementId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "copied" | "error">("idle")

  async function handleSend() {
    setState("loading")
    try {
      const res = await fetch(`/api/statements/${statementId}/payment-link`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setState("error"); return }
      if (data.emailSent) {
        setState("sent")
      } else {
        // No patient email — copy link to clipboard
        await navigator.clipboard.writeText(data.url)
        setState("copied")
      }
      setTimeout(() => setState("idle"), 3000)
    } catch {
      setState("error")
      setTimeout(() => setState("idle"), 2000)
    }
  }

  const label = state === "loading" ? "…" : state === "sent" ? "Sent ✓" : state === "copied" ? "Copied ✓" : state === "error" ? "Error" : "Send Link"
  const color = state === "sent" || state === "copied" ? "text-green-600 hover:text-green-700 hover:bg-green-50" : state === "error" ? "text-red-600" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"

  return (
    <button
      onClick={handleSend}
      disabled={state === "loading"}
      className={`text-xs font-medium transition-colors px-2.5 py-1 rounded-md whitespace-nowrap ${color}`}
    >
      {label}
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [statements, setStatements] = useState<DBStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DBStatement | null>(null)
  const [showERA, setShowERA] = useState(false)
  const [outreachStmt, setOutreachStmt] = useState<DBStatement | null>(null)
  const [batchPosting, setBatchPosting] = useState(false)
  const [batchResult, setBatchResult] = useState<{
    processed: number; totalInsurancePaid: number; totalPatientStatements: number; message?: string
  } | null>(null)

  useEffect(() => {
    fetch("/api/statements")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setStatements(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePaid = useCallback((id: string, amount: number) => {
    setStatements((prev) => prev.map((s) => {
      if (s.id !== id) return s
      const newPaid = parseFloat(s.patientPaid) + amount
      const newBalance = Math.max(parseFloat(s.patientOwes) - newPaid, 0)
      return { ...s, patientPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), statementStatus: newBalance === 0 ? "PAID" : "PARTIAL" }
    }))
    setSelected((prev) => {
      if (!prev || prev.id !== id) return prev
      const newPaid = parseFloat(prev.patientPaid) + amount
      const newBalance = Math.max(parseFloat(prev.patientOwes) - newPaid, 0)
      return { ...prev, patientPaid: newPaid.toFixed(2), balanceDue: newBalance.toFixed(2), statementStatus: newBalance === 0 ? "PAID" : "PARTIAL" }
    })
  }, [])

  function handleERACreated(stmt: DBStatement) {
    setStatements((prev) => [stmt, ...prev])
    setShowERA(false)
  }

  async function handleBatchPost() {
    setBatchPosting(true)
    setBatchResult(null)
    try {
      const res = await fetch("/api/era/batch-post", { method: "POST" })
      const data = await res.json()
      setBatchResult(data)
      if (data.processed > 0) {
        // Refresh statements
        const refreshed = await fetch("/api/statements").then((r) => r.ok ? r.json() : [])
        if (Array.isArray(refreshed)) setStatements(refreshed)
      }
    } catch {}
    finally { setBatchPosting(false) }
  }

  const totalOutstanding = statements.filter((s) => !["PAID", "WRITE_OFF"].includes(s.statementStatus)).reduce((sum, s) => sum + parseFloat(s.balanceDue), 0)
  const totalCollected = statements.filter((s) => s.statementStatus === "PAID").reduce((sum, s) => sum + parseFloat(s.patientOwes), 0)

  const stats = [
    { label: "Open Statements", value: statements.filter((s) => !["PAID", "WRITE_OFF"].includes(s.statementStatus)).length.toString(), accent: "bg-gray-400", valueColor: "text-gray-900" },
    { label: "Pending", value: statements.filter((s) => s.statementStatus === "PENDING").length.toString(), accent: "bg-amber-500", valueColor: "text-amber-600" },
    { label: "Partial Pay", value: statements.filter((s) => s.statementStatus === "PARTIAL").length.toString(), accent: "bg-orange-500", valueColor: "text-orange-600" },
    { label: "Collected", value: `$${totalCollected.toFixed(0)}`, accent: "bg-green-500", valueColor: "text-green-600" },
  ]

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Patient Billing</h1>
            <p className="text-gray-500 text-sm mt-0.5">Statements & patient payments after insurance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-1">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Outstanding</div>
              <div className="text-2xl font-bold font-mono text-amber-600">${totalOutstanding.toFixed(2)}</div>
            </div>
            <button
              onClick={handleBatchPost}
              disabled={batchPosting}
              className="border border-blue-300 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 text-blue-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {batchPosting ? (
                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Processing ERAs…</>
              ) : "Auto-post ERAs →"}
            </button>
            <button onClick={() => setShowERA(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5">
              <span>+</span> Post Payment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} />
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
              <div className={`text-2xl font-bold font-mono ${stat.valueColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {batchResult && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm flex items-center justify-between border ${batchResult.processed > 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
            {batchResult.processed > 0 ? (
              <span>
                ✓ Auto-posted {batchResult.processed} ERA{batchResult.processed > 1 ? "s" : ""} —
                ${batchResult.totalInsurancePaid.toFixed(2)} insurance payments recorded,
                ${batchResult.totalPatientStatements.toFixed(2)} in patient statements generated
              </span>
            ) : (
              <span>{batchResult.message ?? "No eligible claims found. Claims must be 14+ days since submission."}</span>
            )}
            <button onClick={() => setBatchResult(null)} className="text-xs opacity-60 hover:opacity-100 ml-4">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading statements…
          </div>
        ) : statements.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">No statements yet</p>
            <p className="text-gray-400 text-sm mb-6">Submit a claim, then post the insurance payment to generate a patient statement.</p>
            <button onClick={() => setShowERA(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Post Insurance Payment →
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Charged</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ins. Paid</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3"></th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{stmt.patient.lastName}, {stmt.patient.firstName}</td>
                    <td className="px-5 py-3.5 text-gray-500">{new Date(stmt.claim.serviceDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-gray-500">{stmt.claim.provider.firstName} {stmt.claim.provider.lastName}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-gray-600">${parseFloat(stmt.totalCharge).toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-green-600">${parseFloat(stmt.insurancePaid).toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold">
                      <span className={parseFloat(stmt.balanceDue) === 0 ? "text-green-600" : "text-gray-900"}>${parseFloat(stmt.balanceDue).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={stmt.statementStatus} /></td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelected(stmt)} className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors px-2.5 py-1 rounded-md hover:bg-blue-50">View →</button>
                    </td>
                    <td className="px-5 py-3.5">
                      {parseFloat(stmt.balanceDue) > 0 && stmt.statementStatus !== "WRITE_OFF" && (
                        <div className="flex items-center gap-1">
                          <SendStatementButton statementId={stmt.id} />
                          <button onClick={() => setOutreachStmt(stmt)} className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors px-2.5 py-1 rounded-md hover:bg-purple-50 whitespace-nowrap">Draft →</button>
                          <SendPaymentLinkButton statementId={stmt.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <StatementModal stmt={selected} onClose={() => setSelected(null)} onPaid={handlePaid} />}
      {showERA && <ERAModal onClose={() => setShowERA(false)} onCreated={handleERACreated} />}
      {outreachStmt && <OutreachModal stmt={outreachStmt} onClose={() => setOutreachStmt(null)} />}
    </AppLayout>
  )
}
