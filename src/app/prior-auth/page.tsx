"use client"

import { useEffect, useState } from "react"
import AppLayout from "@/components/AppLayout"

interface PriorAuth {
  id: string
  patientId: string
  payerId: string
  payerName: string
  cptCodes: string[]
  authNumber: string | null
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "CANCELLED"
  requestedAt: string
  approvedAt: string | null
  expiresAt: string | null
  sessionsApproved: number | null
  sessionsUsed: number
  notes: string | null
  patient: { firstName: string; lastName: string }
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  payerId: string
  payerName: string
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:   { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500",  label: "Pending" },
  APPROVED:  { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  label: "Approved" },
  DENIED:    { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    label: "Denied" },
  EXPIRED:   { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400",   label: "Expired" },
  CANCELLED: { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400",   label: "Cancelled" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function ExpiryLabel({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-gray-400 text-xs">—</span>
  const days = daysUntil(expiresAt)!
  if (days < 0) return <span className="text-xs text-red-600 font-medium">Expired {Math.abs(days)}d ago</span>
  if (days <= 14) return <span className="text-xs text-amber-600 font-medium">Expires in {days}d</span>
  return <span className="text-xs text-gray-500">{new Date(expiresAt).toLocaleDateString()}</span>
}

const FILTERS = ["ALL", "PENDING", "APPROVED", "DENIED", "EXPIRING", "EXPIRED"]

export default function PriorAuthPage() {
  const [auths, setAuths] = useState<PriorAuth[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PriorAuth | null>(null)
  const [filter, setFilter] = useState("ALL")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // new PA form state
  const [form, setForm] = useState({
    patientId: "", payerId: "", payerName: "", cptCodes: "",
    authNumber: "", expiresAt: "", sessionsApproved: "", notes: "",
  })

  // update form state
  const [updateForm, setUpdateForm] = useState({
    authNumber: "", status: "", expiresAt: "", sessionsApproved: "", sessionsUsed: "", notes: "",
  })

  async function load() {
    const [authRes, patRes] = await Promise.all([
      fetch("/api/prior-auth"),
      fetch("/api/patients"),
    ])
    if (authRes.ok) setAuths(await authRes.json())
    if (patRes.ok) setPatients(await patRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selected) {
      setUpdateForm({
        authNumber: selected.authNumber ?? "",
        status: selected.status,
        expiresAt: selected.expiresAt ? selected.expiresAt.slice(0, 10) : "",
        sessionsApproved: selected.sessionsApproved?.toString() ?? "",
        sessionsUsed: selected.sessionsUsed.toString(),
        notes: selected.notes ?? "",
      })
    }
  }, [selected])

  const filtered = auths.filter((a) => {
    if (filter === "ALL") return true
    if (filter === "EXPIRING") {
      const d = daysUntil(a.expiresAt)
      return a.status === "APPROVED" && d !== null && d >= 0 && d <= 30
    }
    return a.status === filter
  })

  // stats
  const active = auths.filter((a) => a.status === "APPROVED")
  const expiringSoon = active.filter((a) => { const d = daysUntil(a.expiresAt); return d !== null && d >= 0 && d <= 30 })
  const sessionWarning = active.filter((a) => a.sessionsApproved && (a.sessionsUsed / a.sessionsApproved) >= 0.8)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const selectedPat = patients.find((p) => p.id === form.patientId)
    const res = await fetch("/api/prior-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: form.patientId,
        payerId: form.payerId || selectedPat?.payerId || "UNKNOWN",
        payerName: form.payerName || selectedPat?.payerName || "Unknown Payer",
        cptCodes: form.cptCodes.split(",").map((c) => c.trim()).filter(Boolean),
        authNumber: form.authNumber || undefined,
        expiresAt: form.expiresAt || undefined,
        sessionsApproved: form.sessionsApproved ? parseInt(form.sessionsApproved) : undefined,
        notes: form.notes || undefined,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ patientId: "", payerId: "", payerName: "", cptCodes: "", authNumber: "", expiresAt: "", sessionsApproved: "", notes: "" })
      await load()
    } else {
      const err = await res.json().catch(() => ({}))
      setSaveError(err.error ?? "Failed to create authorization")
    }
    setSaving(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setUpdating(true)
    setUpdateError(null)
    const res = await fetch(`/api/prior-auth/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authNumber: updateForm.authNumber || undefined,
        status: updateForm.status || undefined,
        expiresAt: updateForm.expiresAt || undefined,
        sessionsApproved: updateForm.sessionsApproved ? parseInt(updateForm.sessionsApproved) : undefined,
        sessionsUsed: updateForm.sessionsUsed ? parseInt(updateForm.sessionsUsed) : undefined,
        notes: updateForm.notes || undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAuths((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a))
      setSelected((prev) => prev ? { ...prev, ...updated } : null)
    } else {
      const err = await res.json().catch(() => ({}))
      setUpdateError(err.error ?? "Failed to save changes")
    }
    setUpdating(false)
  }

  function handlePatientSelect(patientId: string) {
    const p = patients.find((pt) => pt.id === patientId)
    setForm((f) => ({ ...f, patientId, payerId: p?.payerId ?? "", payerName: p?.payerName ?? "" }))
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left panel */}
        <div className="w-[420px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-base font-semibold text-gray-900">Prior Authorizations</h1>
                <p className="text-xs text-gray-500 mt-0.5">{auths.length} total authorization{auths.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                + New PA
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">{active.length}</div>
                <div className="text-xs text-green-600">Active</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">{expiringSoon.length}</div>
                <div className="text-xs text-amber-600">Expiring &lt;30d</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-700">{sessionWarning.length}</div>
                <div className="text-xs text-orange-600">Session &gt;80%</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {f === "EXPIRING" ? "Expiring" : f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* New PA Form */}
          {showForm && (
            <div className="border-b border-gray-200 bg-blue-50 px-5 py-4">
              <h3 className="text-xs font-semibold text-blue-900 mb-3">New Prior Authorization</h3>
              <form onSubmit={handleCreate} className="space-y-2">
                <select
                  required
                  value={form.patientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                >
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
                  ))}
                </select>
                <input
                  placeholder="CPT codes (comma-separated, e.g. 97110, 97530)"
                  value={form.cptCodes}
                  onChange={(e) => setForm((f) => ({ ...f, cptCodes: e.target.value }))}
                  required
                  className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Payer ID (auto-filled)"
                    value={form.payerId}
                    onChange={(e) => setForm((f) => ({ ...f, payerId: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5"
                  />
                  <input
                    placeholder="Auth number (if known)"
                    value={form.authNumber}
                    onChange={(e) => setForm((f) => ({ ...f, authNumber: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Expiry date</label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Sessions approved</label>
                    <input
                      type="number"
                      placeholder="e.g. 12"
                      value={form.sessionsApproved}
                      onChange={(e) => setForm((f) => ({ ...f, sessionsApproved: e.target.value }))}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5"
                    />
                  </div>
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 text-xs bg-blue-600 text-white py-1.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Create PA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
                {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
              </form>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                {filter === "ALL" ? "No prior authorizations yet. Click + New PA to add one." : `No ${filter.toLowerCase()} authorizations.`}
              </div>
            ) : (
              filtered.map((a) => {
                const days = daysUntil(a.expiresAt)
                const isExpiringSoon = days !== null && days >= 0 && days <= 14 && a.status === "APPROVED"
                const sessionPct = a.sessionsApproved ? a.sessionsUsed / a.sessionsApproved : null
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`w-full text-left px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selected?.id === a.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                    } ${isExpiringSoon ? "bg-amber-50/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {a.patient.lastName}, {a.patient.firstName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{a.payerName}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {a.cptCodes.map((c) => (
                            <span key={c} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{c}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge status={a.status} />
                        <ExpiryLabel expiresAt={a.expiresAt} />
                      </div>
                    </div>
                    {sessionPct !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                          <span>Sessions</span>
                          <span>{a.sessionsUsed}/{a.sessionsApproved}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${sessionPct >= 0.8 ? "bg-orange-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(sessionPct * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right detail panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a prior authorization to view details
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selected.patient.lastName}, {selected.patient.firstName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selected.payerName} · {selected.payerId}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Info grid */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Authorization Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">CPT Codes</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {selected.cptCodes.map((c) => (
                        <span key={c} className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Auth Number</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">
                      {selected.authNumber ?? <span className="text-gray-400 font-normal">Not yet received</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Requested</div>
                    <div className="text-sm text-gray-900 mt-1">{new Date(selected.requestedAt).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Approved</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selected.approvedAt ? new Date(selected.approvedAt).toLocaleDateString() : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Expires</div>
                    <div className="mt-1"><ExpiryLabel expiresAt={selected.expiresAt} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Sessions</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {selected.sessionsApproved
                        ? `${selected.sessionsUsed} used / ${selected.sessionsApproved} approved`
                        : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                </div>
                {selected.sessionsApproved && (
                  <div className="mt-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selected.sessionsUsed / selected.sessionsApproved >= 0.8 ? "bg-orange-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min((selected.sessionsUsed / selected.sessionsApproved) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {Math.round((selected.sessionsUsed / selected.sessionsApproved) * 100)}% of sessions used
                    </div>
                  </div>
                )}
                {selected.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">Notes</div>
                    <p className="text-sm text-gray-700">{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* Update form */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Update Authorization</h3>
                <form onSubmit={handleUpdate} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Auth Number</label>
                      <input
                        value={updateForm.authNumber}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, authNumber: e.target.value }))}
                        placeholder="e.g. PA2026001234"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Status</label>
                      <select
                        value={updateForm.status}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="DENIED">Denied</option>
                        <option value="EXPIRED">Expired</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                      <input
                        type="date"
                        value={updateForm.expiresAt}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, expiresAt: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Sessions Approved</label>
                      <input
                        type="number"
                        value={updateForm.sessionsApproved}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, sessionsApproved: e.target.value }))}
                        placeholder="e.g. 12"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Sessions Used</label>
                      <input
                        type="number"
                        value={updateForm.sessionsUsed}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, sessionsUsed: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                    <textarea
                      value={updateForm.notes}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full text-sm bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {updating ? "Saving…" : "Save Changes"}
                  </button>
                  {updateError && <p className="text-xs text-red-600 mt-2">{updateError}</p>}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
