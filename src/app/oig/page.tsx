"use client"

import { useEffect, useState, useCallback } from "react"
import AppLayout from "@/components/AppLayout"

interface OigCheck {
  id: string
  checkedAt: string
  status: "CLEAR" | "EXCLUDED" | "ERROR"
  matchFound: boolean
  matchDetails: OigMatch[] | null
  error: string | null
}

interface OigMatch {
  lastName: string
  firstName: string
  npi: string
  exclusionType: string
  exclusionDate: string
  specialty: string
  state: string
}

interface ProviderRow {
  id: string
  firstName: string
  lastName: string
  npi: string
  taxonomy: string
  oigChecks: OigCheck[]
}

const STATUS_CONFIG = {
  CLEAR:    { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  label: "Clear" },
  EXCLUDED: { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-600",    label: "EXCLUDED" },
  ERROR:    { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400",   label: "Check failed" },
}

function StatusBadge({ status }: { status: "CLEAR" | "EXCLUDED" | "ERROR" }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function OigPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkAllProgress, setCheckAllProgress] = useState<{ done: number; total: number } | null>(null)
  const [selected, setSelected] = useState<ProviderRow | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/oig/checks")
    if (res.ok) {
      const data: ProviderRow[] = await res.json()
      setProviders(data)
      // Keep selected panel fresh after reload
      setSelected((prev) => prev ? (data.find((p) => p.id === prev.id) ?? prev) : null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function checkProvider(providerId: string) {
    setCheckingId(providerId)
    await fetch("/api/oig/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
    })
    await load()
    setCheckingId(null)
  }

  async function checkAll() {
    setCheckingAll(true)
    setCheckAllProgress({ done: 0, total: providers.length })
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i]
      setCheckingId(p.id)
      await fetch("/api/oig/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: p.id }),
      })
      setCheckAllProgress({ done: i + 1, total: providers.length })
    }
    setCheckingId(null)
    setCheckAllProgress(null)
    await load()
    setCheckingAll(false)
  }

  const lastCheck = (p: ProviderRow) => p.oigChecks[0] ?? null
  const notChecked  = providers.filter((p) => !lastCheck(p))
  const excluded    = providers.filter((p) => lastCheck(p)?.status === "EXCLUDED")
  const clear       = providers.filter((p) => lastCheck(p)?.status === "CLEAR")
  const errors      = providers.filter((p) => lastCheck(p)?.status === "ERROR")
  const stale       = providers.filter((p) => {
    const lc = lastCheck(p)
    return lc && lc.status === "CLEAR" && daysSince(lc.checkedAt) > 30
  })

  const selectedCheck = selected ? lastCheck(selected) : null

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left panel */}
        <div className="w-[420px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-base font-semibold text-gray-900">OIG Exclusion Checker</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  HHS OIG LEIE — verify providers are not excluded from Medicare/Medicaid billing
                </p>
              </div>
              <button
                onClick={checkAll}
                disabled={checkingAll || providers.length === 0}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0 transition-colors"
              >
                {checkAllProgress ? `${checkAllProgress.done}/${checkAllProgress.total}` : checkingAll ? "Checking…" : "Check All"}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">{clear.length}</div>
                <div className="text-xs text-green-600">Clear</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-700">{excluded.length}</div>
                <div className="text-xs text-red-600">Excluded</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">{stale.length}</div>
                <div className="text-xs text-amber-600">&gt;30d old</div>
              </div>
              <div className="text-center p-2 bg-gray-100 rounded-lg">
                <div className="text-lg font-bold text-gray-600">{notChecked.length}</div>
                <div className="text-xs text-gray-500">Not checked</div>
              </div>
            </div>

            {excluded.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs font-semibold text-red-800">⚠️ Action Required</div>
                <div className="text-xs text-red-700 mt-0.5">
                  {excluded.length} provider{excluded.length !== 1 ? "s" : ""} matched on OIG LEIE. Do not bill Medicare/Medicaid until resolved. Consult your compliance officer immediately.
                </div>
              </div>
            )}
          </div>

          {/* Provider list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-400">Loading…</div>
            ) : providers.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No providers found. Add providers in Settings.</div>
            ) : (
              providers.map((p) => {
                const lc = lastCheck(p)
                const isChecking = checkingId === p.id
                const isStale = lc && lc.status === "CLEAR" && daysSince(lc.checkedAt) > 30
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selected?.id === p.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                    } ${lc?.status === "EXCLUDED" ? "bg-red-50/40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {lc?.status === "EXCLUDED" && (
                            <span className="text-red-600 text-sm font-bold">!</span>
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">
                            Dr. {p.lastName}, {p.firstName}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">NPI {p.npi}</div>
                        {lc ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${isStale ? "text-amber-600" : "text-gray-400"}`}>
                              {isStale ? "⚠ " : ""}Checked {daysSince(lc.checkedAt)}d ago
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-1">Never checked</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {lc ? <StatusBadge status={lc.status} /> : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not checked</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); checkProvider(p.id) }}
                          disabled={isChecking || checkingAll}
                          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium"
                        >
                          {isChecking ? "Checking…" : lc ? "Re-check" : "Check now"}
                        </button>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right detail panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <div className="text-4xl">🔍</div>
              <div className="text-sm">Select a provider to view OIG check details</div>
              <div className="text-xs text-gray-300 max-w-xs text-center">
                Checks run against the HHS Office of Inspector General List of Excluded Individuals/Entities (LEIE), updated monthly.
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-8 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Dr. {selected.lastName}, {selected.firstName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">NPI {selected.npi}</p>
                </div>
                <button
                  onClick={() => checkProvider(selected.id)}
                  disabled={checkingId === selected.id || checkingAll}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {checkingId === selected.id ? "Checking…" : "Run Check"}
                </button>
              </div>

              {/* Status card */}
              {selectedCheck ? (
                <>
                  <div className={`rounded-xl border p-5 ${
                    selectedCheck.status === "EXCLUDED" ? "bg-red-50 border-red-200" :
                    selectedCheck.status === "ERROR"    ? "bg-gray-50 border-gray-200" :
                                                          "bg-green-50 border-green-200"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <StatusBadge status={selectedCheck.status} />
                      <span className="text-xs text-gray-500">
                        Checked {new Date(selectedCheck.checkedAt).toLocaleString()}
                      </span>
                    </div>

                    {selectedCheck.status === "CLEAR" && (
                      <p className="text-sm text-green-800">
                        No match found in the OIG LEIE for Dr. {selected.lastName}, {selected.firstName} (NPI {selected.npi}). This provider is clear to bill Medicare and Medicaid.
                      </p>
                    )}

                    {selectedCheck.status === "EXCLUDED" && (
                      <div>
                        <p className="text-sm font-semibold text-red-800 mb-2">
                          Match found on OIG LEIE — this provider appears on the exclusion list.
                        </p>
                        <p className="text-sm text-red-700 mb-3">
                          Immediately suspend Medicare/Medicaid billing for this provider and consult your compliance officer. Billing with an excluded individual is a federal violation and can result in civil monetary penalties of $10,000+ per item and program exclusion of your practice.
                        </p>
                        <a
                          href={`https://exclusions.oig.hhs.gov/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-red-700 underline"
                        >
                          Verify at exclusions.oig.hhs.gov →
                        </a>
                      </div>
                    )}

                    {selectedCheck.status === "ERROR" && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          The OIG check could not be completed automatically.
                        </p>
                        {selectedCheck.error && (
                          <p className="text-xs text-gray-500 font-mono bg-gray-100 px-3 py-2 rounded">
                            {selectedCheck.error}
                          </p>
                        )}
                        <a
                          href={`https://exclusions.oig.hhs.gov/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline mt-2 block"
                        >
                          Check manually at exclusions.oig.hhs.gov →
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Match details */}
                  {selectedCheck.matchDetails && selectedCheck.matchDetails.length > 0 && (
                    <div className="bg-white rounded-xl border border-red-200 p-5">
                      <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-4">
                        LEIE Match Details ({selectedCheck.matchDetails.length} record{selectedCheck.matchDetails.length !== 1 ? "s" : ""})
                      </h3>
                      {selectedCheck.matchDetails.map((m, i) => (
                        <div key={i} className={`${i > 0 ? "mt-4 pt-4 border-t border-gray-100" : ""}`}>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-gray-400">Name</div>
                              <div className="font-medium text-gray-900">{m.lastName}, {m.firstName}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">NPI on Record</div>
                              <div className="font-medium text-gray-900">{m.npi || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Exclusion Type</div>
                              <div className="text-gray-900">{m.exclusionType || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Exclusion Date</div>
                              <div className="text-gray-900">{m.exclusionDate || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Specialty</div>
                              <div className="text-gray-900">{m.specialty || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">State</div>
                              <div className="text-gray-900">{m.state || "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="text-3xl mb-3">🔍</div>
                  <p className="text-sm text-gray-600 mb-1">No OIG check on record for this provider.</p>
                  <p className="text-xs text-gray-400 mb-4">
                    CMS requires practices to screen providers against the LEIE before hire and monthly thereafter.
                  </p>
                  <button
                    onClick={() => checkProvider(selected.id)}
                    disabled={checkingId === selected.id}
                    className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {checkingId === selected.id ? "Checking…" : "Run OIG Check Now"}
                  </button>
                </div>
              )}

              {/* Info box */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">About OIG Exclusion Checks</h3>
                <div className="space-y-2 text-xs text-gray-600">
                  <p>The <strong>LEIE</strong> (List of Excluded Individuals/Entities) is maintained by the HHS Office of Inspector General. Excluded individuals cannot bill Medicare, Medicaid, or any other federal healthcare program.</p>
                  <p><strong>CMS guidance:</strong> Screen all providers before hire, and at least monthly thereafter. Keep records of each check.</p>
                  <p><strong>Penalty:</strong> Civil Monetary Penalties up to $10,000 per item billed by an excluded individual, plus treble damages and exclusion of the practice.</p>
                  <p className="text-gray-400">Data sourced from: exclusions.oig.hhs.gov (updated monthly by HHS)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
