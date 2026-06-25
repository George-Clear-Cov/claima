"use client"

import { useState } from "react"
import AppLayout from "@/components/AppLayout"
import Link from "next/link"

interface AgentResult {
  runAt: string
  durationMs: number
  actions: {
    erasPosted: number
    erasAmount: number
    appealsGenerated: number
    appealsAmount: number
    timelyRisks: number
    timelyAmount: number
    agingClaims: number
    agingAmount: number
  }
  eraResults: { patient: string; payer: string; amount: number; patientOwes: number }[]
  appealResults: { patient: string; carcCode: string; action: string; letterGenerated: boolean }[]
  timelyRisks: { patient: string; payer: string; amount: number; daysOld: number }[]
  agingClaims: { patient: string; payer: string; amount: number; daysOld: number }[]
  narrative: string
  nextActions: string[]
  automatedValue: number
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; accent?: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AgentPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/agent/run", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Agent failed")
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setRunning(false)
    }
  }

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Autonomous Billing Agent</h1>
          <p className="text-gray-500 text-sm mt-0.5">One click to handle all routine billing tasks — ERA posting, appeal drafting, risk flagging</p>
        </div>

        {/* Run card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 mb-0.5">Full Billing Sweep</div>
              <div className="text-sm text-gray-500">Posts ERAs for mature claims · Drafts appeal letters · Flags timely filing risks · Identifies aging claims</div>
            </div>
            <button
              onClick={handleRun}
              disabled={running}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2 shrink-0"
            >
              {running ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Agent running…</>
              ) : "Run Sweep →"}
            </button>
          </div>

          {running && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="space-y-2.5">
                {["Scanning for ERA-ready claims", "Processing insurance payments", "Drafting appeal letters for pending denials", "Scanning for timely filing risks", "Generating summary report"].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-gray-500">
                    <svg className="animate-spin h-3.5 w-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {step}…
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">{error}</div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Narrative */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Agent Report</span>
                <span className="text-xs text-blue-400 ml-auto">{(result.durationMs / 1000).toFixed(1)}s · {new Date(result.runAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">{result.narrative}</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="ERAs Posted" value={String(result.actions.erasPosted)} sub={fmt(result.actions.erasAmount)} accent="bg-green-500" color="text-green-700" />
              <StatCard label="Appeals Drafted" value={String(result.actions.appealsGenerated)} sub={fmt(result.actions.appealsAmount)} accent="bg-blue-500" color="text-blue-700" />
              <StatCard label="Timely Risks" value={String(result.actions.timelyRisks)} sub={fmt(result.actions.timelyAmount)} accent={result.actions.timelyRisks > 0 ? "bg-red-500" : "bg-gray-300"} color={result.actions.timelyRisks > 0 ? "text-red-700" : "text-gray-600"} />
              <StatCard label="Aging Claims" value={String(result.actions.agingClaims)} sub={fmt(result.actions.agingAmount)} accent={result.actions.agingClaims > 0 ? "bg-amber-500" : "bg-gray-300"} color={result.actions.agingClaims > 0 ? "text-amber-700" : "text-gray-600"} />
            </div>

            {/* Next actions (human required) */}
            {result.nextActions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Needs Your Attention</h3>
                <ol className="space-y-2">
                  {result.nextActions.map((action, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ERA log */}
            {result.eraResults.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ERAs Posted ({result.eraResults.length})</h3>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-medium">Patient</th>
                    <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-medium">Payer</th>
                    <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-medium">Ins. Paid</th>
                    <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-medium">Pt. Owes</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.eraResults.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-900">{r.patient}</td>
                        <td className="px-5 py-2.5 text-gray-500">{r.payer}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-green-600">${r.amount.toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-gray-600">${r.patientOwes.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Timely filing risks */}
            {result.timelyRisks.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-red-200">
                  <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider">⚠ Timely Filing Risks ({result.timelyRisks.length})</h3>
                  <p className="text-xs text-red-600 mt-0.5">Claims 90+ days old — timely filing window may be closing. Follow up with payers immediately.</p>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-red-100">
                    {result.timelyRisks.map((r, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 font-medium text-red-900">{r.patient}</td>
                        <td className="px-5 py-2.5 text-red-700">{r.payer}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-red-700">${r.amount.toFixed(0)}</td>
                        <td className="px-5 py-2.5 text-right text-xs text-red-600 font-bold">{r.daysOld}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* All clear if nothing needed */}
            {result.actions.erasPosted === 0 && result.actions.appealsGenerated === 0 &&
              result.actions.timelyRisks === 0 && result.actions.agingClaims === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center text-green-800">
                <div className="text-lg font-bold mb-1">✓ All clear</div>
                <p className="text-sm text-green-700">No outstanding items found. Practice billing is up to date.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link href="/denials" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">Review drafted appeals →</Link>
              <Link href="/billing" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">View new statements →</Link>
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">Today's briefing →</Link>
            </div>
          </div>
        )}

        {/* Instructions when idle */}
        {!result && !running && !error && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">What the agent handles automatically</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "💳", title: "ERA Posting", desc: "Posts insurance payments for claims pending 14+ days using contracted rates" },
                { icon: "✉", title: "Appeal Letters", desc: "Drafts AI-generated appeal letters for all new PENDING denials" },
                { icon: "⏱", title: "Timely Filing", desc: "Flags claims approaching 90+ days at risk of losing the filing window" },
                { icon: "📊", title: "Aging Claims", desc: "Identifies claims 45-90 days old that need payer follow-up calls" },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
