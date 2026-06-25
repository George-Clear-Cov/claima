"use client"

import { useEffect, useState, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from "recharts"
import AppLayout from "@/components/AppLayout"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Insight {
  title: string
  detail: string
  severity: "critical" | "warning" | "opportunity" | "info"
  action: string
}

interface CptStat {
  code: string
  total: number
  denied: number
  denialRate: number
}

interface IntelligenceData {
  insights: Insight[]
  cptStats: CptStat[]
}

const SEVERITY_CONFIG = {
  critical:    { bg: "bg-red-50",   border: "border-red-200",   text: "text-red-800",   badge: "bg-red-100 text-red-700",    icon: "⚠" },
  warning:     { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-700", icon: "!" },
  opportunity: { bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-800",  badge: "bg-blue-100 text-blue-700",  icon: "↑" },
  info:        { bg: "bg-gray-50",  border: "border-gray-200",  text: "text-gray-700",  badge: "bg-gray-100 text-gray-600",  icon: "i" },
}

interface Summary {
  totalBilled: number
  insurancePaid: number
  patientCollected: number
  totalCollected: number
  collectionRate: number
  openDenials: number
  denialRate: number
  avgDaysToPayment: number | null
}

interface AnalyticsData {
  summary: Summary
  monthlyRevenue: { month: string; billed: number; insurancePaid: number; patientCollected: number }[]
  monthlyDenialRate: { month: string; denialRate: number; denied: number; total: number }[]
  claimsByStatus: { status: string; count: number; amount: number }[]
  arAging: { bucket: string; count: number; amount: number }[]
  byPayer: { payerName: string; claimCount: number; billed: number; collected: number; collectionRate: number }[]
  byProvider: { name: string; claimCount: number; billed: number; collected: number; collectionRate: number }[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RANGES = [
  { label: "This month", months: 0 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
  { label: "All time", months: 999 },
]

const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981",
  SUBMITTED: "#3b82f6",
  ACCEPTED: "#6366f1",
  DRAFT: "#9ca3af",
  DENIED: "#f97316",
  REJECTED: "#ef4444",
}

const AGING_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"]

// Status donut tooltip
function StatusTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { status: string; count: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <div className="font-semibold text-gray-700 mb-0.5">{d.status}</div>
      <div className="text-gray-500">{d.count} claims · {fmt(payload[0].value)}</div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtK(n: number) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n) }

function KPI({ label, value, sub, color = "text-gray-900" }: { label: string; value: string; sub: string; color?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">{children}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// Custom tooltip for revenue chart
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-medium text-gray-900">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}


// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [rangeIdx, setRangeIdx] = useState(2) // default: 6 months
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null)

  useEffect(() => {
    fetch("/api/intelligence")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIntelligence({ insights: d.insights ?? [], cptStats: d.cptStats ?? [] }) })
      .catch(() => {})
  }, [])

  const load = useCallback(async (months: number) => {
    setLoading(true)
    try {
      const now = new Date()
      const to = now.toISOString().split("T")[0]
      let from: string
      if (months === 0) {
        // this month
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
      } else if (months === 999) {
        from = "2020-01-01"
      } else {
        const f = new Date(now)
        f.setMonth(f.getMonth() - months)
        f.setDate(1)
        from = f.toISOString().split("T")[0]
      }

      const res = await fetch(`/api/analytics?from=${from}&to=${to}`)
      if (res.ok) setData(await res.json())
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(RANGES[rangeIdx].months) }, [load, rangeIdx])

  const s = data?.summary

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-gray-500 text-sm mt-0.5">Revenue cycle performance</p>
          </div>
          <div className="flex gap-0.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  i === rangeIdx ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Calculating…
          </div>
        ) : !data ? (
          <div className="text-center py-24 text-gray-400">No data available. Submit some claims to see analytics.</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-4 mb-10">
              <KPI label="Total Billed" value={fmtK(s!.totalBilled)} sub="gross charges" accent="bg-gray-300" />
              <KPI label="Total Collected" value={fmtK(s!.totalCollected)} sub={`${s!.collectionRate}% collection rate`} color="text-green-600" accent="bg-green-500" />
              <KPI label="Outstanding" value={fmtK(s!.totalBilled - s!.totalCollected)} sub="uncollected" color="text-amber-600" accent="bg-amber-500" />
              <KPI label="Denial Rate" value={`${s!.denialRate}%`} sub={`${s!.openDenials} open denials`} color={s!.denialRate > 10 ? "text-red-600" : "text-gray-900"} accent={s!.denialRate > 10 ? "bg-red-500" : "bg-gray-300"} />
            </div>

            <div className="grid grid-cols-4 gap-4 mb-10">
              <KPI label="Insurance Paid" value={fmtK(s!.insurancePaid)} sub="ERA payments" color="text-blue-600" accent="bg-blue-500" />
              <KPI label="Patient Collected" value={fmtK(s!.patientCollected)} sub="copays & balances" color="text-purple-600" accent="bg-purple-500" />
              <KPI label="Clean Claim Rate" value={`${data.claimsByStatus.find((c) => c.status === "DENIED") ? Math.round((1 - (data.claimsByStatus.find((c) => c.status === "DENIED")!.count / (data.claimsByStatus.reduce((s, c) => s + c.count, 0) || 1))) * 100) : 100}%`} sub="first-pass acceptance" color="text-indigo-600" accent="bg-indigo-500" />
              <KPI label="Avg Days to Pay" value={s!.avgDaysToPayment != null ? `${s!.avgDaysToPayment}d` : "—"} sub="service → ERA" accent="bg-gray-300" />
            </div>

            {/* AI Insights */}
            {intelligence && intelligence.insights.length > 0 && (
              <>
                <SectionLabel>
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">C</span>
                    AI Insights
                  </span>
                </SectionLabel>
                <div className="space-y-3 mb-10">
                  {intelligence.insights.map((insight, i) => {
                    const cfg = SEVERITY_CONFIG[insight.severity]
                    return (
                      <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-start gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm mb-1 ${cfg.text}`}>{insight.title}</div>
                            <div className={`text-sm leading-relaxed mb-2 ${cfg.text} opacity-90`}>{insight.detail}</div>
                            <div className={`text-xs font-medium ${cfg.text} opacity-75`}>→ {insight.action}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* CPT Code Risk */}
            {intelligence && intelligence.cptStats.length > 0 && (
              <>
                <SectionLabel>CPT Code Denial Risk</SectionLabel>
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-10">
                  <div className="space-y-3">
                    {intelligence.cptStats.map((c) => (
                      <div key={c.code} className="flex items-center gap-4">
                        <span className="font-mono text-sm text-gray-700 w-16 shrink-0">{c.code}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${c.denialRate > 20 ? "bg-red-500" : c.denialRate > 10 ? "bg-amber-400" : "bg-green-400"}`}
                            style={{ width: `${Math.min(c.denialRate, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-semibold w-10 text-right ${c.denialRate > 20 ? "text-red-600" : c.denialRate > 10 ? "text-amber-600" : "text-green-600"}`}>
                          {c.denialRate}%
                        </span>
                        <span className="text-xs text-gray-400 w-20 text-right">{c.denied}/{c.total} denied</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Revenue trend */}
            <SectionLabel>Monthly Revenue</SectionLabel>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
              {data.monthlyRevenue.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No claims in this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barSize={18} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#f9fafb" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Bar dataKey="billed" name="Billed" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="insurancePaid" name="Insurance Paid" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="patientCollected" name="Patient Paid" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Denial rate trend */}
            {data.monthlyDenialRate.length > 1 && (
              <div className="mb-6">
                <SectionLabel>Denial Rate Trend</SectionLabel>
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.monthlyDenialRate} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={36} domain={[0, "auto"]} />
                      <ReferenceLine y={10} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1} label={{ value: "10% target", position: "right", fontSize: 10, fill: "#f97316" }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = data.monthlyDenialRate.find(m => m.month === label)
                          return (
                            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
                              <div className="font-semibold text-gray-700 mb-1">{label}</div>
                              <div className="text-gray-500">{payload[0].value}% denial rate · {d?.denied}/{d?.total} claims</div>
                            </div>
                          )
                        }}
                        cursor={{ stroke: "#e5e7eb" }}
                      />
                      <Line type="monotone" dataKey="denialRate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} name="Denial Rate %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Status breakdown + AR Aging side by side */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Claim status donut */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-4">Claim Status</div>
                {data.claimsByStatus.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No claims</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie
                          data={data.claimsByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={72}
                          dataKey="amount"
                          paddingAngle={2}
                        >
                          {data.claimsByStatus.map((s) => (
                            <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#9ca3af"} />
                          ))}
                        </Pie>
                        <Tooltip content={<StatusTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {data.claimsByStatus.map((s) => (
                        <div key={s.status} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#9ca3af" }} />
                            <span className="text-gray-600">{s.status}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-gray-700">{s.count}</span>
                            <span className="text-gray-400 ml-1">· {fmt(s.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AR Aging */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-4">AR Aging (Outstanding)</div>
                {data.arAging.every((b) => b.amount === 0) ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No outstanding balances</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.arAging} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const b = data.arAging.find((a) => a.bucket === label)
                          return (
                            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
                              <div className="font-semibold text-gray-700 mb-1">{label}</div>
                              <div className="text-gray-500">{b?.count ?? 0} statements · {fmt(payload[0].value as number)}</div>
                            </div>
                          )
                        }}
                        cursor={{ fill: "#f9fafb" }}
                      />
                      <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
                        {data.arAging.map((_, i) => (
                          <Cell key={i} fill={AGING_COLORS[i] ?? "#9ca3af"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* By payer */}
            {data.byPayer.length > 0 && (
              <div className="mb-6">
                <SectionLabel>By Payer</SectionLabel>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Claims</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Billed</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Rate</th>
                        <th className="px-5 py-3 w-32"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.byPayer.map((p) => (
                        <tr key={p.payerName} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900">{p.payerName}</td>
                          <td className="px-5 py-3.5 text-right text-gray-500 font-mono text-xs">{p.claimCount}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-gray-600">{fmt(p.billed)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-green-600">{fmt(p.collected)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-mono font-medium text-sm ${p.collectionRate >= 80 ? "text-green-600" : p.collectionRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {p.collectionRate}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${p.collectionRate >= 80 ? "bg-green-500" : p.collectionRate >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${p.collectionRate}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* By provider */}
            {data.byProvider.length > 0 && (
              <div>
                <SectionLabel>By Provider</SectionLabel>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Claims</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Billed</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Rate</th>
                        <th className="px-5 py-3 w-32"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.byProvider.map((p) => (
                        <tr key={p.name} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900">{p.name}</td>
                          <td className="px-5 py-3.5 text-right text-gray-500 font-mono text-xs">{p.claimCount}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-gray-600">{fmt(p.billed)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-green-600">{fmt(p.collected)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-mono font-medium text-sm ${p.collectionRate >= 80 ? "text-green-600" : p.collectionRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {p.collectionRate}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${p.collectionRate >= 80 ? "bg-green-500" : p.collectionRate >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${p.collectionRate}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
