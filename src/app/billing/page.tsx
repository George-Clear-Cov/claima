"use client"

import { useEffect, useState, useCallback } from "react"
import NavBar from "@/components/NavBar"

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
    practice?: { name: string }
  }
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: "bg-yellow-950/60",  text: "text-yellow-300",  dot: "bg-yellow-500" },
  SENT:        { bg: "bg-blue-950/60",    text: "text-blue-300",    dot: "bg-blue-500" },
  PARTIAL:     { bg: "bg-orange-950/60",  text: "text-orange-300",  dot: "bg-orange-500" },
  PAID:        { bg: "bg-green-950/60",   text: "text-green-300",   dot: "bg-green-500" },
  WRITE_OFF:   { bg: "bg-gray-800",       text: "text-gray-400",    dot: "bg-gray-600" },
  COLLECTIONS: { bg: "bg-red-950/60",     text: "text-red-300",     dot: "bg-red-500" },
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

function StatementModal({ stmt, onClose, onPaid }: {
  stmt: DBStatement
  onClose: () => void
  onPaid: (id: string, amount: number) => void
}) {
  const [paying, setPaying] = useState(false)
  const [payAmount, setPayAmount] = useState(parseFloat(stmt.balanceDue).toFixed(2))
  const [paid, setPaid] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const balanceDue = parseFloat(stmt.balanceDue)
  const patientOwes = parseFloat(stmt.patientOwes)
  const insurancePaid = parseFloat(stmt.insurancePaid)
  const adjustments = parseFloat(stmt.adjustments)
  const balancePaid = parseFloat(stmt.patientPaid)
  const totalCharge = parseFloat(stmt.totalCharge)

  async function handlePay() {
    setProcessing(true)
    setPayError(null)
    const amount = parseFloat(payAmount || "0")
    try {
      const payRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          statementId: stmt.id,
          patientName: `${stmt.patient.firstName} ${stmt.patient.lastName}`,
          claimId: stmt.claimId,
        }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error ?? "Payment failed")

      if (!payData.clientSecret || payData.mock) {
        const stmtRes = await fetch("/api/statements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pay", statementId: stmt.id, amount }),
        })
        if (!stmtRes.ok) {
          const d = await stmtRes.json()
          throw new Error(d.error ?? "Failed to record payment")
        }
      }

      setPaid(true)
      setPaying(false)
      onPaid(stmt.id, amount)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setProcessing(false)
    }
  }

  const formattedDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—"

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Patient Statement</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                {stmt.claim.provider.firstName} {stmt.claim.provider.lastName}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors text-sm">✕</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Patient</div>
              <div className="font-medium text-gray-100">{stmt.patient.firstName} {stmt.patient.lastName}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Due Date</div>
              <div className="text-gray-200">{formattedDate(stmt.dueDate)}</div>
            </div>
          </div>
        </div>

        {/* Claim info */}
        <div className="px-6 py-2.5 bg-gray-800/40 border-b border-gray-800 text-xs text-gray-500 flex gap-4">
          <span>Claim: <span className="font-mono text-gray-400">{stmt.claimId.slice(0, 8)}…</span></span>
          <span>Service: <span className="text-gray-400">{formattedDate(stmt.claim.serviceDate)}</span></span>
        </div>

        {/* Service lines */}
        <div className="p-6">
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="text-left pb-2.5">Service</th>
                <th className="text-right pb-2.5">Charge</th>
              </tr>
            </thead>
            <tbody>
              {stmt.claim.lineItems.map((line, i) => (
                <tr key={i} className="border-b border-gray-800/40">
                  <td className="py-3">
                    <div className="font-mono text-xs text-gray-500">{line.cptCode}</div>
                    <div className="text-gray-200 mt-0.5">{line.description ?? line.cptCode}</div>
                  </td>
                  <td className="text-right py-3 font-mono text-gray-200">
                    ${(parseFloat(line.chargeAmount) * line.units).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border border-gray-800 rounded-xl p-4 space-y-2.5 text-sm bg-gray-900/50">
            <div className="flex justify-between text-gray-400">
              <span>Total Charges</span>
              <span className="font-mono">${totalCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>Insurance Payment</span>
              <span className="font-mono">−${insurancePaid.toFixed(2)}</span>
            </div>
            {adjustments > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Contractual Adjustments</span>
                <span className="font-mono">−${adjustments.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-gray-700 pt-2.5">
              <span className="text-gray-200">Patient Responsibility</span>
              <span className="font-mono text-gray-100">${patientOwes.toFixed(2)}</span>
            </div>
            {balancePaid > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Previously Paid</span>
                <span className="font-mono">−${balancePaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2.5">
              <span>Balance Due</span>
              <span className={`font-mono ${balanceDue === 0 ? "text-green-400" : "text-white"}`}>
                ${balanceDue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment section */}
          {balanceDue > 0 && !paid && (
            <div className="mt-4">
              {!paying ? (
                <button
                  onClick={() => setPaying(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-[0.99]"
                >
                  Make Payment
                </button>
              ) : (
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-medium text-gray-200">Enter payment amount</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        step="0.01"
                        min="0.01"
                        max={balanceDue}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      />
                    </div>
                    <button
                      onClick={handlePay}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {processing ? "Processing…" : `Pay $${parseFloat(payAmount || "0").toFixed(2)}`}
                    </button>
                    <button
                      onClick={() => setPaying(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {payError && <div className="text-red-400 text-xs bg-red-950/40 border border-red-800/40 rounded-lg p-2">{payError}</div>}
                  <div className="flex gap-2 text-xs">
                    {[balanceDue, balanceDue / 2, 50].filter((n) => n > 0 && n <= balanceDue).map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setPayAmount(amt.toFixed(2))}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2.5 py-1 rounded-lg transition-colors font-mono"
                      >
                        ${amt.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {paid && (
            <div className="mt-4 bg-green-950/40 border border-green-800/60 rounded-xl p-4 text-center">
              <div className="text-green-400 font-semibold">✓ Payment of ${parseFloat(payAmount).toFixed(2)} recorded</div>
              <div className="text-green-300/60 text-sm mt-1">Thank you, {stmt.patient.firstName}</div>
            </div>
          )}

          {stmt.statementStatus === "PAID" && !paid && (
            <div className="mt-4 bg-green-950/30 border border-green-800/40 rounded-xl p-3 text-center text-green-400 text-sm font-medium">
              ✓ Paid in full · {formattedDate(stmt.paidAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const [statements, setStatements] = useState<DBStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DBStatement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/statements")
      if (res.ok) {
        const data = await res.json()
        setStatements(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handlePaid(id: string, amount: number) {
    setStatements((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const newPaid = parseFloat(s.patientPaid) + amount
        const newBalance = Math.max(parseFloat(s.patientOwes) - newPaid, 0)
        return {
          ...s,
          patientPaid: newPaid.toFixed(2),
          balanceDue: newBalance.toFixed(2),
          statementStatus: newBalance === 0 ? "PAID" : "PARTIAL",
        }
      })
    )
    if (selected?.id === id) {
      setSelected((prev) => {
        if (!prev) return null
        const newPaid = parseFloat(prev.patientPaid) + amount
        const newBalance = Math.max(parseFloat(prev.patientOwes) - newPaid, 0)
        return {
          ...prev,
          patientPaid: newPaid.toFixed(2),
          balanceDue: newBalance.toFixed(2),
          statementStatus: newBalance === 0 ? "PAID" : "PARTIAL",
        }
      })
    }
  }

  const totalOutstanding = statements
    .filter((s) => s.statementStatus !== "PAID" && s.statementStatus !== "WRITE_OFF")
    .reduce((sum, s) => sum + parseFloat(s.balanceDue), 0)

  const totalCollected = statements
    .filter((s) => s.statementStatus === "PAID")
    .reduce((sum, s) => sum + parseFloat(s.patientOwes), 0)

  const stats = [
    { label: "Open Statements", value: statements.filter((s) => !["PAID", "WRITE_OFF"].includes(s.statementStatus)).length.toString(), accent: "bg-white", valueColor: "text-white" },
    { label: "Pending", value: statements.filter((s) => s.statementStatus === "PENDING").length.toString(), accent: "bg-yellow-500", valueColor: "text-yellow-400" },
    { label: "Partial Pay", value: statements.filter((s) => s.statementStatus === "PARTIAL").length.toString(), accent: "bg-orange-500", valueColor: "text-orange-400" },
    { label: "Collected", value: `$${totalCollected.toFixed(0)}`, accent: "bg-green-500", valueColor: "text-green-400" },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Patient Billing</h1>
            <p className="text-gray-500 text-sm mt-0.5">Statements & patient payments after insurance</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Outstanding</div>
            <div className="text-2xl font-bold font-mono text-amber-400">${totalOutstanding.toFixed(2)}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative overflow-hidden hover:border-gray-700 transition-colors">
              <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} />
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
              <div className={`text-2xl font-bold font-mono ${stat.valueColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-600">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading statements…
          </div>
        ) : statements.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/40 border border-gray-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium mb-1">No statements yet</p>
            <p className="text-gray-600 text-sm">Statements are created after a claim is adjudicated and insurance posts payment (ERA).</p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Charged</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ins. Paid</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {statements.map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-100">
                      {stmt.patient.lastName}, {stmt.patient.firstName}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {new Date(stmt.claim.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {stmt.claim.provider.firstName} {stmt.claim.provider.lastName}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-gray-300">
                      ${parseFloat(stmt.totalCharge).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-green-400">
                      ${parseFloat(stmt.insurancePaid).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold">
                      <span className={parseFloat(stmt.balanceDue) === 0 ? "text-green-400" : "text-white"}>
                        ${parseFloat(stmt.balanceDue).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={stmt.statementStatus} />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setSelected(stmt)}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors px-2.5 py-1 rounded-md hover:bg-blue-950/30"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <StatementModal
          stmt={selected}
          onClose={() => setSelected(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  )
}
