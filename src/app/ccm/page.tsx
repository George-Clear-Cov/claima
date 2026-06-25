"use client"

import { useEffect, useState, useCallback } from "react"
import AppLayout from "@/components/AppLayout"

interface EligiblePatient {
  id: string
  firstName: string
  lastName: string
  dob: string
  payerName: string
  isMedicare: boolean
  ccmEnrolled: boolean
  ccmEnrolledAt: string | null
  conditions: string[]
  eligibleConditionCount: number
  eligible: boolean
}

interface EnrolledPatient {
  id: string
  firstName: string
  lastName: string
  payerName: string
  isMedicare: boolean
  ccmEnrolledAt: string | null
  minutesThisMonth: number
  billable: boolean
  additionalUnit: boolean
}

interface DashboardStats {
  enrolledCount: number
  billableThisMonth: number
  estimatedRevenue: number
  monthLabel: string
}

interface TimeLogForm {
  patientId: string
  minutes: string
  description: string
}

const CCM_COLORS = {
  eligible: "bg-emerald-50 text-emerald-700",
  enrolled: "bg-blue-50 text-blue-700",
  billable: "bg-green-50 text-green-700",
  medicare: "bg-purple-50 text-purple-700",
}

function ConditionPill({ name }: { name: string }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{name}</span>
  )
}

function MinutesBar({ minutes }: { minutes: number }) {
  const pct = Math.min((minutes / 20) * 100, 100)
  const color = minutes >= 40 ? "bg-purple-500" : minutes >= 20 ? "bg-green-500" : "bg-blue-400"
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{minutes} min logged</span>
        <span className="font-medium">{minutes >= 20 ? "✓ Billable" : `${20 - minutes} min to bill`}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CcmPage() {
  const [tab, setTab] = useState<"eligible" | "enrolled">("eligible")
  const [eligible, setEligible] = useState<EligiblePatient[]>([])
  const [enrolled, setEnrolled] = useState<EnrolledPatient[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [logForm, setLogForm] = useState<TimeLogForm | null>(null)
  const [loggingTime, setLoggingTime] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(async () => {
    const [eligRes, dashRes] = await Promise.all([
      fetch("/api/ccm/eligible"),
      fetch("/api/ccm/dashboard"),
    ])
    if (eligRes.ok) {
      const data: EligiblePatient[] = await eligRes.json()
      setEligible(data)
    }
    if (dashRes.ok) {
      const data = await dashRes.json()
      setEnrolled(data.enrolled)
      setStats(data.stats)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const notEnrolled = eligible.filter((p) => p.eligible && !p.ccmEnrolled)
  const medicareNotEnrolled = notEnrolled.filter((p) => p.isMedicare)
  const filteredEligible = notEnrolled.filter((p) =>
    searchQuery === "" ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredEnrolled = enrolled.filter((p) =>
    searchQuery === "" ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  async function handleEnroll(patientId: string) {
    if (!confirm("Confirm patient has given verbal or written consent for CCM enrollment?")) return
    setEnrollingId(patientId)
    const res = await fetch("/api/ccm/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, consentObtained: true }),
    })
    if (res.ok) await loadData()
    setEnrollingId(null)
  }

  async function handleUnenroll(patientId: string, name: string) {
    if (!confirm(`Remove ${name} from CCM enrollment?`)) return
    await fetch(`/api/ccm/enroll?patientId=${patientId}`, { method: "DELETE" })
    await loadData()
  }

  async function handleLogTime(e: React.FormEvent) {
    e.preventDefault()
    if (!logForm) return
    setLoggingTime(true)
    const res = await fetch("/api/ccm/time-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: logForm.patientId,
        minutes: parseInt(logForm.minutes),
        description: logForm.description || undefined,
      }),
    })
    if (res.ok) {
      setLogForm(null)
      await loadData()
    }
    setLoggingTime(false)
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Chronic Care Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bill Medicare CPT 99490 (~$62/patient/month) for patients with 2+ chronic conditions receiving 20+ min of non-face-to-face care management monthly.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">CCM Eligible</div>
              <div className="text-2xl font-bold text-gray-900">{notEnrolled.length}</div>
              <div className="text-xs text-emerald-600 mt-0.5">Not yet enrolled</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Enrolled</div>
              <div className="text-2xl font-bold text-gray-900">{stats.enrolledCount}</div>
              <div className="text-xs text-blue-600 mt-0.5">Active CCM patients</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Billable This Month</div>
              <div className="text-2xl font-bold text-gray-900">{stats.billableThisMonth}</div>
              <div className="text-xs text-green-600 mt-0.5">20+ min logged</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Est. Revenue — {stats.monthLabel}</div>
              <div className="text-2xl font-bold text-gray-900">
                ${stats.estimatedRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-purple-600 mt-0.5">CPT 99490/99439</div>
            </div>
          </div>
        )}

        {/* Revenue opportunity callout — Medicare patients only (CPT 99490 is Medicare-covered) */}
        {medicareNotEnrolled.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-900">
                ${(medicareNotEnrolled.length * 62.43).toLocaleString("en-US", { maximumFractionDigits: 0 })}/month uncaptured Medicare revenue
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                {medicareNotEnrolled.length} Medicare patient{medicareNotEnrolled.length !== 1 ? "s" : ""} eligible for CCM but not enrolled — each worth ~$62/month (CPT 99490)
                {notEnrolled.length > medicareNotEnrolled.length && (
                  <span className="text-emerald-600"> · {notEnrolled.length - medicareNotEnrolled.length} non-Medicare eligible (verify payer coverage before enrolling)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setTab("eligible")}
              className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-800 transition-colors shrink-0"
            >
              View Eligible Patients →
            </button>
          </div>
        )}

        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            <button
              onClick={() => setTab("eligible")}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === "eligible" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Eligible Patients
              {notEnrolled.length > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === "eligible" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                  {notEnrolled.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("enrolled")}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === "enrolled" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Enrolled Patients
              {(stats?.enrolledCount ?? 0) > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === "enrolled" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                  {stats?.enrolledCount}
                </span>
              )}
            </button>
          </div>
          <input
            placeholder="Search patients…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-48"
          />
        </div>

        {/* Time log modal */}
        {logForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-xl border border-gray-200 p-6 w-96 shadow-xl">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Log CCM Time</h3>
              <form onSubmit={handleLogTime} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={logForm.minutes}
                    onChange={(e) => setLogForm((f) => f ? { ...f, minutes: e.target.value } : f)}
                    placeholder="e.g. 20"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">20+ min/month triggers CPT 99490 billing. 40+ min adds CPT 99439.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                  <textarea
                    value={logForm.description}
                    onChange={(e) => setLogForm((f) => f ? { ...f, description: e.target.value } : f)}
                    placeholder="e.g. Medication reconciliation call, reviewed labs with patient"
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loggingTime}
                    className="flex-1 text-sm bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loggingTime ? "Logging…" : "Log Time"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogForm(null)}
                    className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">Loading…</div>
        ) : tab === "eligible" ? (
          <div className="space-y-3">
            {filteredEligible.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-200">
                {searchQuery ? "No patients match your search." : "No unenrolled eligible patients found. All qualifying patients may already be enrolled."}
              </div>
            ) : (
              filteredEligible.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {p.lastName}, {p.firstName}
                        </span>
                        {p.isMedicare && (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">Medicare</span>
                        )}
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          {p.eligibleConditionCount} chronic conditions
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.payerName}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.conditions.map((c) => <ConditionPill key={c} name={c} />)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEnroll(p.id)}
                      disabled={enrollingId === p.id}
                      className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0 transition-colors"
                    >
                      {enrollingId === p.id ? "Enrolling…" : "Enroll in CCM"}
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Est. revenue: <strong className="text-gray-700">$62.43/month</strong> (CPT 99490)</span>
                    <span>DOB: {new Date(p.dob).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEnrolled.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-200">
                {searchQuery ? "No patients match your search." : "No patients enrolled in CCM yet. Enroll eligible patients from the Eligible Patients tab."}
              </div>
            ) : (
              filteredEnrolled.map((p) => (
                <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.billable ? "border-green-200" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {p.lastName}, {p.firstName}
                        </span>
                        {p.isMedicare && (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">Medicare</span>
                        )}
                        {p.billable && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {p.additionalUnit ? "Bill 99490 + 99439" : "Bill 99490"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.payerName} · Enrolled {p.ccmEnrolledAt ? new Date(p.ccmEnrolledAt).toLocaleDateString() : "—"}
                      </div>
                      <div className="mt-3">
                        <MinutesBar minutes={p.minutesThisMonth} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setLogForm({ patientId: p.id, minutes: "", description: "" })}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        + Log Time
                      </button>
                      {p.billable && (
                        <a
                          href={`/claims/new?patientId=${p.id}&cpt=${p.additionalUnit ? "99490,99439" : "99490"}`}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-center"
                        >
                          Generate Claim
                        </a>
                      )}
                      <button
                        onClick={() => handleUnenroll(p.id, `${p.firstName} ${p.lastName}`)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors text-center"
                      >
                        Unenroll
                      </button>
                    </div>
                  </div>
                  {p.billable && (
                    <div className="mt-3 pt-3 border-t border-green-100 text-xs text-green-700 font-medium">
                      Ready to bill: CPT 99490 (~$62){p.additionalUnit ? " + CPT 99439 (~$47)" : ""} = ~${p.additionalUnit ? "109" : "62"} this month
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
