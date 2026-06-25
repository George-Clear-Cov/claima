"use client"

import { useEffect, useState, useCallback } from "react"
import AppLayout from "@/components/AppLayout"

interface Benchmarks {
  collectionRate: number
  denialRate: number
  daysToPayment: number
}

interface CarcCode {
  code: string
  count: number
  reason: string
  category: string
}

interface MonthlyPoint {
  month: string
  claims: number
  billed: number
  paid: number
  denied: number
}

interface PayerRow {
  payerId: string
  payerName: string
  totalClaims: number
  submittedClaims: number
  deniedClaims: number
  billed: number
  paid: number
  openAR: number
  adjustments: number
  adjustmentRate: number | null
  collectionRate: number
  denialRate: number
  avgDaysToPayment: number | null
  payerMix: number
  benchmarks: {
    collectionRateDelta: number
    denialRateDelta: number
    daysToPaymentDelta: number | null
  }
  topCarcCodes: CarcCode[]
  monthlyTrend: MonthlyPoint[]
}

interface Summary {
  totalBilled: number
  totalPaid: number
  totalOpenAR: number
  overallCollectionRate: number
  overallDenialRate: number
  avgDaysToPaymentOverall: number | null
  payerCount: number
}

interface ApiResponse {
  summary: Summary
  benchmarks: Benchmarks
  payers: PayerRow[]
  period: { from: string; to: string }
}

const $ = (n: number, dec = 0) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })

function DeltaBadge({ delta, invert = false, suffix = "pp" }: { delta: number; invert?: boolean; suffix?: string }) {
  const positive = invert ? delta < 0 : delta > 0
  const zero = Math.abs(delta) < 0.5
  if (zero) return <span className="text-xs text-gray-400">= Benchmark</span>
  return (
    <span className={`text-xs font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}{suffix} {positive ? "above" : "below"} avg
    </span>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min((value / Math.max(max, 1)) * 100, 100)}%` }} />
    </div>
  )
}

function CollectionBar({ rate, benchmark }: { rate: number; benchmark: number }) {
  const color = rate >= benchmark + 5 ? "bg-green-500" : rate >= benchmark - 5 ? "bg-amber-400" : "bg-red-500"
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`font-semibold ${rate >= benchmark ? "text-green-700" : "text-red-600"}`}>{rate}%</span>
        <span className="text-gray-400 text-xs">avg {benchmark}%</span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${rate}%` }} />
        <div className="absolute top-0 h-full border-l-2 border-gray-400 border-dashed" style={{ left: `${benchmark}%` }} />
      </div>
    </div>
  )
}

function DenialBar({ rate, benchmark }: { rate: number; benchmark: number }) {
  const color = rate <= benchmark - 5 ? "bg-green-500" : rate <= benchmark + 3 ? "bg-amber-400" : "bg-red-500"
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`font-semibold ${rate <= benchmark ? "text-green-700" : "text-red-600"}`}>{rate}%</span>
        <span className="text-gray-400 text-xs">avg {benchmark}%</span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(rate * 3, 100)}%` }} />
        <div className="absolute top-0 h-full border-l-2 border-gray-400 border-dashed" style={{ left: `${Math.min(benchmark * 3, 100)}%` }} />
      </div>
    </div>
  )
}

type SortKey = "billed" | "collectionRate" | "denialRate" | "avgDaysToPayment" | "openAR" | "payerMix"

export default function PayerIntelligencePage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PayerRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("billed")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [period, setPeriod] = useState("12m")

  const load = useCallback(async (p: string) => {
    setLoading(true)
    const now = new Date()
    let from: string
    if (p === "3m")  from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
    else if (p === "6m") from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10)
    else from = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10)

    const res = await fetch(`/api/analytics/payer-intel?from=${from}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(period) }, [load, period])

  // Keep selected panel in sync when data refreshes (e.g., period change)
  useEffect(() => {
    if (!selected || !data) return
    const refreshed = data.payers.find((p) => p.payerName === selected.payerName)
    if (refreshed) setSelected(refreshed)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sorted = [...(data?.payers ?? [])].sort((a, b) => {
    const av = a[sortKey] ?? -1
    const bv = b[sortKey] ?? -1
    const diff = (av as number) - (bv as number)
    return sortDir === "desc" ? -diff : diff
  })

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(k)}
      className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none px-3 py-2.5"
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  )

  const { summary, benchmarks } = data ?? {}
  const maxBilled = Math.max(...(data?.payers.map((p) => p.billed) ?? [1]))

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left panel — table */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
          <div className="px-6 pt-6 pb-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Payer Intelligence</h1>
                <p className="text-xs text-gray-500 mt-0.5">Collection rates, denial rates, and payment velocity — benchmarked against industry averages</p>
              </div>
              <div className="flex gap-1">
                {(["3m", "6m", "12m"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${period === p ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            {summary && benchmarks && (
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 mb-1">Total Billed</div>
                  <div className="text-xl font-bold text-gray-900">{$(summary.totalBilled)}</div>
                  <div className="text-xs text-gray-400 mt-1">{summary.payerCount} payers</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 mb-1">Total Collected</div>
                  <div className="text-xl font-bold text-gray-900">{$(summary.totalPaid)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    <span className={summary.overallCollectionRate >= benchmarks.collectionRate ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                      {summary.overallCollectionRate}%
                    </span>
                    {" "}collection rate
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 mb-1">Open AR</div>
                  <div className="text-xl font-bold text-gray-900">{$(summary.totalOpenAR)}</div>
                  <div className="text-xs text-gray-400 mt-1">Pending payment</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 mb-1">Denial Rate</div>
                  <div className={`text-xl font-bold ${summary.overallDenialRate <= benchmarks.denialRate ? "text-green-700" : "text-red-600"}`}>
                    {summary.overallDenialRate}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Industry avg {benchmarks.denialRate}%</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 mb-1">Avg Days to Pay</div>
                  <div className={`text-xl font-bold ${
                    summary.avgDaysToPaymentOverall === null ? "text-gray-400" :
                    summary.avgDaysToPaymentOverall <= benchmarks.daysToPayment ? "text-green-700" : "text-amber-600"}`}>
                    {summary.avgDaysToPaymentOverall !== null ? `${summary.avgDaysToPaymentOverall}d` : "—"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Industry avg {benchmarks.daysToPayment}d</div>
                </div>
              </div>
            )}

            {/* Payer table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-sm text-gray-400">Loading payer data…</div>
              ) : sorted.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">No claim data found for this period.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Payer</th>
                      <SortHeader k="payerMix" label="Mix" />
                      <SortHeader k="billed" label="Billed" />
                      <SortHeader k="collectionRate" label="Collection %" />
                      <SortHeader k="denialRate" label="Denial %" />
                      <SortHeader k="avgDaysToPayment" label="Days to Pay" />
                      <SortHeader k="openAR" label="Open AR" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sorted.map((p) => (
                      <tr
                        key={p.payerId || p.payerName}
                        onClick={() => setSelected(p)}
                        className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${selected?.payerName === p.payerName ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{p.payerName}</div>
                          <div className="text-xs text-gray-400">{p.totalClaims} claims · {p.deniedClaims} denied</div>
                          <MiniBar value={p.billed} max={maxBilled} color="bg-blue-300" />
                        </td>
                        <td className="text-right px-3 py-3">
                          <div className="text-sm font-semibold text-gray-700">{p.payerMix}%</div>
                          <div className="text-xs text-gray-400">of revenue</div>
                        </td>
                        <td className="text-right px-3 py-3">
                          <div className="text-sm font-semibold text-gray-900">{$(p.billed)}</div>
                          <div className="text-xs text-gray-400">{$(p.paid)} paid</div>
                        </td>
                        <td className="px-3 py-3 min-w-[120px]">
                          {benchmarks && <CollectionBar rate={p.collectionRate} benchmark={benchmarks.collectionRate} />}
                        </td>
                        <td className="px-3 py-3 min-w-[120px]">
                          {benchmarks && <DenialBar rate={p.denialRate} benchmark={benchmarks.denialRate} />}
                        </td>
                        <td className="text-right px-3 py-3">
                          {p.avgDaysToPayment !== null ? (
                            <>
                              <div className={`text-sm font-semibold ${p.avgDaysToPayment <= (benchmarks?.daysToPayment ?? 30) ? "text-green-600" : "text-amber-600"}`}>
                                {p.avgDaysToPayment}d
                              </div>
                              <div className="text-xs text-gray-400">avg</div>
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="text-right px-3 py-3">
                          {p.openAR > 0 ? (
                            <>
                              <div className="text-sm font-semibold text-amber-700">{$(p.openAR)}</div>
                              <div className="text-xs text-gray-400">outstanding</div>
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — payer drill-down */}
        <div className="w-[400px] shrink-0 border-l border-gray-200 overflow-y-auto bg-white">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-8 text-center">
              <div className="text-3xl">📊</div>
              <div className="text-sm">Click a payer to see denial trends, CARC codes, and monthly performance</div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Payer header */}
              <div>
                <h2 className="text-base font-semibold text-gray-900">{selected.payerName}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selected.totalClaims} claims · {selected.payerMix}% of revenue</p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Billed</div>
                  <div className="text-base font-bold text-gray-900">{$(selected.billed)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Collected</div>
                  <div className="text-base font-bold text-gray-900">{$(selected.paid)}</div>
                </div>
                <div className={`rounded-xl p-3 ${selected.collectionRate >= (benchmarks?.collectionRate ?? 85) ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="text-xs text-gray-400">Collection Rate</div>
                  <div className={`text-base font-bold ${selected.collectionRate >= (benchmarks?.collectionRate ?? 85) ? "text-green-700" : "text-red-600"}`}>
                    {selected.collectionRate}%
                  </div>
                  <DeltaBadge delta={selected.benchmarks.collectionRateDelta} />
                </div>
                <div className={`rounded-xl p-3 ${selected.denialRate <= (benchmarks?.denialRate ?? 10) ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="text-xs text-gray-400">Denial Rate</div>
                  <div className={`text-base font-bold ${selected.denialRate <= (benchmarks?.denialRate ?? 10) ? "text-green-700" : "text-red-600"}`}>
                    {selected.denialRate}%
                  </div>
                  <DeltaBadge delta={selected.benchmarks.denialRateDelta} />
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Avg Days to Pay</div>
                  <div className="text-base font-bold text-gray-900">
                    {selected.avgDaysToPayment !== null ? `${selected.avgDaysToPayment}d` : "—"}
                  </div>
                  {selected.benchmarks.daysToPaymentDelta !== null && (
                    <DeltaBadge delta={selected.benchmarks.daysToPaymentDelta} suffix="d" />
                  )}
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Open AR</div>
                  <div className="text-base font-bold text-amber-700">
                    {selected.openAR > 0 ? $(selected.openAR) : "None"}
                  </div>
                  {selected.adjustmentRate !== null && (
                    <div className="text-xs text-gray-400">{selected.adjustmentRate}% adj rate</div>
                  )}
                </div>
              </div>

              {/* Top CARC codes */}
              {selected.topCarcCodes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Denial Codes</h3>
                  <div className="space-y-2">
                    {selected.topCarcCodes.map((c) => (
                      <div key={c.code} className="bg-red-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-red-700 font-mono">CARC {c.code}</span>
                          <span className="text-xs text-red-600 font-semibold">{c.count}×</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-snug">{c.reason}</div>
                        {c.category && <div className="text-xs text-gray-400 mt-0.5">{c.category}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly trend */}
              {selected.monthlyTrend.length > 1 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Trend</h3>
                  <div className="space-y-2">
                    {selected.monthlyTrend.slice(-6).map((m) => {
                      const colRate = m.billed > 0 ? Math.round((m.paid / m.billed) * 100) : 0
                      const denRate = m.claims > 0 ? Math.round((m.denied / m.claims) * 100) : 0
                      return (
                        <div key={m.month} className="grid grid-cols-4 gap-2 text-xs items-center">
                          <div className="text-gray-500 font-medium">{m.month}</div>
                          <div className="text-right">
                            <div className="text-gray-700 font-medium">{$(m.billed)}</div>
                            <div className="text-gray-400">{m.claims} claims</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${colRate >= (benchmarks?.collectionRate ?? 85) ? "text-green-600" : "text-red-500"}`}>
                              {colRate}%
                            </div>
                            <div className="text-gray-400">collected</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${denRate <= (benchmarks?.denialRate ?? 10) ? "text-green-600" : "text-red-500"}`}>
                              {denRate}%
                            </div>
                            <div className="text-gray-400">denied</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No denial data */}
              {selected.topCarcCodes.length === 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <div className="text-sm font-medium text-green-700">No denials recorded</div>
                  <div className="text-xs text-green-600 mt-0.5">This payer has no denial history in the selected period.</div>
                </div>
              )}

              {/* Action insight */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-800 mb-1.5">📋 Insight</div>
                <div className="text-xs text-blue-700 leading-relaxed">
                  {selected.collectionRate < (benchmarks?.collectionRate ?? 85) && selected.denialRate > (benchmarks?.denialRate ?? 10)
                    ? `${selected.payerName} has both a below-average collection rate (${selected.collectionRate}%) and above-average denial rate (${selected.denialRate}%). Review your most common CARC codes above and ensure prior auth requirements are being met before submission.`
                    : selected.collectionRate < (benchmarks?.collectionRate ?? 85)
                    ? `${selected.payerName} collection rate (${selected.collectionRate}%) is below the ${benchmarks?.collectionRate}% industry average. Check for write-offs and patient balance patterns.`
                    : selected.denialRate > (benchmarks?.denialRate ?? 10)
                    ? `${selected.payerName} denial rate (${selected.denialRate}%) is above average. The top denial codes above are your fastest path to recovering revenue.`
                    : selected.avgDaysToPayment !== null && selected.avgDaysToPayment > (benchmarks?.daysToPayment ?? 30) + 15
                    ? `${selected.payerName} is paying slowly (avg ${selected.avgDaysToPayment} days). Consider following up on claims over 30 days old in the Claims page.`
                    : `${selected.payerName} is performing at or above industry benchmarks. Keep monitoring for changes in denial patterns.`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
