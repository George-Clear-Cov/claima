"use client"

import { useEffect, useState, useCallback } from "react"
import AppLayout from "@/components/AppLayout"

interface ProviderCredential {
  id: string
  providerId: string
  payerId: string
  payerName: string
  status: CredentialStatus
  applicationDate: string | null
  approvedDate: string | null
  expiryDate: string | null
  notes: string | null
  updatedAt: string
}

interface Provider {
  id: string
  firstName: string
  lastName: string
  npi: string
  taxonomy: string
  deaNumber: string | null
  deaExpiry: string | null
  stateLicense: string | null
  stateLicenseState: string | null
  stateLicenseExpiry: string | null
  boardCertExpiry: string | null
  malpracticeCarrier: string | null
  malpracticeExpiry: string | null
  caqhProviderId: string | null
  caqhLastUpdated: string | null
  payerCredentials: ProviderCredential[]
}

type CredentialStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "DENIED" | "EXPIRED" | "RE_CREDENTIALING"

const CRED_STATUS_CONFIG: Record<CredentialStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:          { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400",   label: "Pending" },
  IN_REVIEW:        { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500",   label: "In Review" },
  APPROVED:         { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500",  label: "Approved" },
  DENIED:           { bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-500",    label: "Denied" },
  EXPIRED:          { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "Expired" },
  RE_CREDENTIALING: { bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500", label: "Re-cred" },
}

function CredBadge({ status }: { status: CredentialStatus }) {
  const cfg = CRED_STATUS_CONFIG[status]
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

type ExpiryHealth = "ok" | "warning" | "urgent" | "expired" | "missing"

function getExpiryHealth(dateStr: string | null): ExpiryHealth {
  if (!dateStr) return "missing"
  const days = daysUntil(dateStr)!
  if (days < 0) return "expired"
  if (days <= 30) return "urgent"
  if (days <= 90) return "warning"
  return "ok"
}

function providerHealth(p: Provider): ExpiryHealth {
  const dates = [p.deaExpiry, p.stateLicenseExpiry, p.boardCertExpiry, p.malpracticeExpiry]
  const healths = dates.map(getExpiryHealth)
  if (healths.includes("expired")) return "expired"
  if (healths.includes("urgent")) return "urgent"
  if (healths.includes("warning")) return "warning"
  if (healths.includes("missing")) return "missing"
  return "ok"
}

const HEALTH_DOT: Record<ExpiryHealth, string> = {
  ok:      "bg-green-500",
  warning: "bg-amber-400",
  urgent:  "bg-orange-500",
  expired: "bg-red-500",
  missing: "bg-gray-300",
}

function ExpiryCell({ label, dateStr }: { label: string; dateStr: string | null }) {
  const health = getExpiryHealth(dateStr)
  const days = dateStr ? daysUntil(dateStr) : null
  const colorMap: Record<ExpiryHealth, string> = {
    ok:      "text-gray-700",
    warning: "text-amber-600",
    urgent:  "text-orange-600",
    expired: "text-red-600",
    missing: "text-gray-400",
  }
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${colorMap[health]}`}>
        {!dateStr ? "—" : health === "expired"
          ? `Expired ${Math.abs(days!)}d ago`
          : health === "ok"
          ? new Date(dateStr).toLocaleDateString()
          : `${days}d (${new Date(dateStr).toLocaleDateString()})`}
      </div>
    </div>
  )
}

const COMMON_PAYERS = [
  { id: "00001", name: "Medicare" },
  { id: "00002", name: "Medicaid" },
  { id: "60054", name: "Aetna" },
  { id: "00086", name: "BlueCross BlueShield" },
  { id: "87726", name: "United Healthcare" },
  { id: "62308", name: "Cigna" },
  { id: "61101", name: "Humana" },
  { id: "UMR01", name: "UMR" },
  { id: "37137", name: "Optum" },
  { id: "39167", name: "Magellan Health" },
]

export default function CredentialingPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selected, setSelected] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [addingPayer, setAddingPayer] = useState(false)
  const [payerError, setPayerError] = useState<string | null>(null)
  const [healthFilter, setHealthFilter] = useState<"all" | "issues">("all")

  // License edit form
  const [licenseForm, setLicenseForm] = useState({
    deaNumber: "", deaExpiry: "",
    stateLicense: "", stateLicenseState: "", stateLicenseExpiry: "",
    boardCertExpiry: "", malpracticeCarrier: "", malpracticeExpiry: "",
    caqhProviderId: "",
  })

  // Add payer form
  const [payerForm, setPayerForm] = useState({
    payerId: "", payerName: "", status: "PENDING" as CredentialStatus,
    applicationDate: "", approvedDate: "", expiryDate: "", notes: "",
  })
  const [showPayerForm, setShowPayerForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/credentialing")
    if (res.ok) {
      const data: Provider[] = await res.json()
      setProviders(data)
      if (selected) {
        const refreshed = data.find((p) => p.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
    }
    setLoading(false)
  }, [selected])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) {
      setLicenseForm({
        deaNumber:          selected.deaNumber ?? "",
        deaExpiry:          selected.deaExpiry ? selected.deaExpiry.slice(0, 10) : "",
        stateLicense:       selected.stateLicense ?? "",
        stateLicenseState:  selected.stateLicenseState ?? "",
        stateLicenseExpiry: selected.stateLicenseExpiry ? selected.stateLicenseExpiry.slice(0, 10) : "",
        boardCertExpiry:    selected.boardCertExpiry ? selected.boardCertExpiry.slice(0, 10) : "",
        malpracticeCarrier: selected.malpracticeCarrier ?? "",
        malpracticeExpiry:  selected.malpracticeExpiry ? selected.malpracticeExpiry.slice(0, 10) : "",
        caqhProviderId:     selected.caqhProviderId ?? "",
      })
    }
  }, [selected])

  async function handleSaveLicense(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    setSaveError(null)
    const toVal = (s: string) => s.trim() === "" ? null : s
    const res = await fetch(`/api/credentialing/providers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deaNumber:          licenseForm.deaNumber || undefined,
        deaExpiry:          toVal(licenseForm.deaExpiry),
        stateLicense:       licenseForm.stateLicense || undefined,
        stateLicenseState:  licenseForm.stateLicenseState || undefined,
        stateLicenseExpiry: toVal(licenseForm.stateLicenseExpiry),
        boardCertExpiry:    toVal(licenseForm.boardCertExpiry),
        malpracticeCarrier: licenseForm.malpracticeCarrier || undefined,
        malpracticeExpiry:  toVal(licenseForm.malpracticeExpiry),
        caqhProviderId:     licenseForm.caqhProviderId || undefined,
      }),
    })
    if (res.ok) await load()
    else setSaveError("Failed to save credentials — please try again")
    setSaving(false)
  }

  async function handleAddPayer(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setAddingPayer(true)
    setPayerError(null)
    const res = await fetch("/api/credentialing/payers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId:      selected.id,
        payerId:         payerForm.payerId,
        payerName:       payerForm.payerName,
        status:          payerForm.status,
        applicationDate: payerForm.applicationDate || undefined,
        approvedDate:    payerForm.approvedDate || undefined,
        expiryDate:      payerForm.expiryDate || undefined,
        notes:           payerForm.notes || undefined,
      }),
    })
    if (res.ok) {
      setShowPayerForm(false)
      setPayerForm({ payerId: "", payerName: "", status: "PENDING", applicationDate: "", approvedDate: "", expiryDate: "", notes: "" })
      await load()
    } else {
      const err = await res.json().catch(() => ({}))
      setPayerError(err.error ?? "Failed to add payer — check payer ID is unique for this provider")
    }
    setAddingPayer(false)
  }

  async function handleUpdatePayerStatus(credId: string, status: CredentialStatus) {
    await fetch(`/api/credentialing/payers/${credId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function handleDeletePayer(credId: string, payerName: string) {
    if (!confirm(`Remove ${payerName} credentialing record?`)) return
    await fetch(`/api/credentialing/payers/${credId}`, { method: "DELETE" })
    await load()
  }

  function handleCommonPayerSelect(payerId: string) {
    const payer = COMMON_PAYERS.find((p) => p.id === payerId)
    if (payer) setPayerForm((f) => ({ ...f, payerId: payer.id, payerName: payer.name }))
  }

  const filtered = providers.filter((p) => {
    if (healthFilter === "all") return true
    const h = providerHealth(p)
    return h !== "ok"
  })

  // summary counts
  const issues = providers.filter((p) => {
    const h = providerHealth(p)
    return h === "expired" || h === "urgent" || h === "warning"
  })

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left panel */}
        <div className="w-[380px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="mb-4">
              <h1 className="text-base font-semibold text-gray-900">Credentialing</h1>
              <p className="text-xs text-gray-500 mt-0.5">{providers.length} provider{providers.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">
                  {providers.filter((p) => providerHealth(p) === "ok").length}
                </div>
                <div className="text-xs text-green-600">All Clear</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">
                  {providers.filter((p) => providerHealth(p) === "warning").length}
                </div>
                <div className="text-xs text-amber-600">Expiring &lt;90d</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-700">
                  {providers.filter((p) => ["expired", "urgent"].includes(providerHealth(p))).length}
                </div>
                <div className="text-xs text-red-600">Urgent</div>
              </div>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setHealthFilter("all")}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${healthFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                All
              </button>
              <button
                onClick={() => setHealthFilter("issues")}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${healthFilter === "issues" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                Issues only {issues.length > 0 && `(${issues.length})`}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                {healthFilter === "issues" ? "No credential issues detected." : "No providers found. Add providers in Settings."}
              </div>
            ) : (
              filtered.map((p) => {
                const health = providerHealth(p)
                const payerApproved = p.payerCredentials.filter((c) => c.status === "APPROVED").length
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selected?.id === p.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[health]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          Dr. {p.lastName}, {p.firstName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">NPI {p.npi}</div>
                      </div>
                    </div>
                    <div className="mt-2 ml-4 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {[
                        { label: "State Lic", expiry: p.stateLicenseExpiry },
                        { label: "DEA", expiry: p.deaExpiry },
                        { label: "Board Cert", expiry: p.boardCertExpiry },
                        { label: "Malpractice", expiry: p.malpracticeExpiry },
                      ].map(({ label, expiry }) => {
                        const h = getExpiryHealth(expiry)
                        const color = h === "expired" ? "text-red-600" : h === "urgent" ? "text-orange-500" : h === "warning" ? "text-amber-600" : "text-gray-400"
                        return (
                          <div key={label} className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">{label}:</span>
                            <span className={`text-xs font-medium ${color}`}>
                              {!expiry ? "—" : h === "expired" ? "Expired" : h === "ok" ? new Date(expiry).toLocaleDateString() : `${daysUntil(expiry)}d`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-1.5 ml-4 text-xs text-gray-400">
                      {payerApproved}/{p.payerCredentials.length} payers approved
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
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a provider to manage credentials
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-8 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Dr. {selected.lastName}, {selected.firstName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">NPI {selected.npi} · {selected.taxonomy}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                  providerHealth(selected) === "ok" ? "bg-green-100 text-green-700" :
                  providerHealth(selected) === "warning" ? "bg-amber-100 text-amber-700" :
                  providerHealth(selected) === "expired" || providerHealth(selected) === "urgent" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[providerHealth(selected)]}`} />
                  {providerHealth(selected) === "ok" ? "All credentials current" :
                   providerHealth(selected) === "warning" ? "Expiring soon" :
                   providerHealth(selected) === "expired" ? "Credential expired" :
                   providerHealth(selected) === "urgent" ? "Expiring within 30 days" : "Incomplete"}
                </div>
              </div>

              {/* Expiry at-a-glance */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Expiry Overview</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ExpiryCell label="State License" dateStr={selected.stateLicenseExpiry} />
                  <ExpiryCell label="DEA Certificate" dateStr={selected.deaExpiry} />
                  <ExpiryCell label="Board Certification" dateStr={selected.boardCertExpiry} />
                  <ExpiryCell label="Malpractice Insurance" dateStr={selected.malpracticeExpiry} />
                </div>
              </div>

              {/* License edit form */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Update Credentials</h3>
                <form onSubmit={handleSaveLicense} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">State License #</label>
                      <input value={licenseForm.stateLicense} onChange={(e) => setLicenseForm((f) => ({ ...f, stateLicense: e.target.value }))}
                        placeholder="e.g. MD12345" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">License State</label>
                      <input value={licenseForm.stateLicenseState} onChange={(e) => setLicenseForm((f) => ({ ...f, stateLicenseState: e.target.value.toUpperCase().slice(0, 2) }))}
                        placeholder="e.g. NY" maxLength={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">License Expiry</label>
                      <input type="date" value={licenseForm.stateLicenseExpiry} onChange={(e) => setLicenseForm((f) => ({ ...f, stateLicenseExpiry: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">DEA Number</label>
                      <input value={licenseForm.deaNumber} onChange={(e) => setLicenseForm((f) => ({ ...f, deaNumber: e.target.value }))}
                        placeholder="e.g. AB1234563" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">DEA Expiry</label>
                      <input type="date" value={licenseForm.deaExpiry} onChange={(e) => setLicenseForm((f) => ({ ...f, deaExpiry: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Board Cert Expiry</label>
                      <input type="date" value={licenseForm.boardCertExpiry} onChange={(e) => setLicenseForm((f) => ({ ...f, boardCertExpiry: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Malpractice Carrier</label>
                      <input value={licenseForm.malpracticeCarrier} onChange={(e) => setLicenseForm((f) => ({ ...f, malpracticeCarrier: e.target.value }))}
                        placeholder="e.g. ProAssurance" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Malpractice Expiry</label>
                      <input type="date" value={licenseForm.malpracticeExpiry} onChange={(e) => setLicenseForm((f) => ({ ...f, malpracticeExpiry: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">CAQH Provider ID</label>
                      <input value={licenseForm.caqhProviderId} onChange={(e) => setLicenseForm((f) => ({ ...f, caqhProviderId: e.target.value }))}
                        placeholder="e.g. 12345678" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                      {selected.caqhLastUpdated && (
                        <p className="text-xs text-gray-400 mt-1">Last updated {new Date(selected.caqhLastUpdated).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full text-sm bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving…" : "Save Credentials"}
                  </button>
                  {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
                </form>
              </div>

              {/* Payer credentials */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payer Credentialing</h3>
                  <button
                    onClick={() => setShowPayerForm((v) => !v)}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    + Add Payer
                  </button>
                </div>

                {showPayerForm && (
                  <form onSubmit={handleAddPayer} className="mb-4 p-4 bg-blue-50 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Common payers</label>
                        <select
                          onChange={(e) => handleCommonPayerSelect(e.target.value)}
                          className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                          defaultValue=""
                        >
                          <option value="">Quick select…</option>
                          {COMMON_PAYERS.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Status</label>
                        <select
                          value={payerForm.status}
                          onChange={(e) => setPayerForm((f) => ({ ...f, status: e.target.value as CredentialStatus }))}
                          className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                        >
                          {Object.entries(CRED_STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Payer ID</label>
                        <input required value={payerForm.payerId} onChange={(e) => setPayerForm((f) => ({ ...f, payerId: e.target.value }))}
                          placeholder="e.g. 00001" className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Payer Name</label>
                        <input required value={payerForm.payerName} onChange={(e) => setPayerForm((f) => ({ ...f, payerName: e.target.value }))}
                          placeholder="e.g. Medicare" className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Application Date</label>
                        <input type="date" value={payerForm.applicationDate} onChange={(e) => setPayerForm((f) => ({ ...f, applicationDate: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Approved Date</label>
                        <input type="date" value={payerForm.approvedDate} onChange={(e) => setPayerForm((f) => ({ ...f, approvedDate: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                        <input type="date" value={payerForm.expiryDate} onChange={(e) => setPayerForm((f) => ({ ...f, expiryDate: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <input value={payerForm.notes} onChange={(e) => setPayerForm((f) => ({ ...f, notes: e.target.value }))}
                          placeholder="Optional" className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={addingPayer}
                        className="flex-1 text-xs bg-blue-600 text-white py-1.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
                        {addingPayer ? "Saving…" : "Add Payer"}
                      </button>
                      <button type="button" onClick={() => setShowPayerForm(false)}
                        className="text-xs text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-100">Cancel</button>
                    </div>
                    {payerError && <p className="text-xs text-red-600 mt-1">{payerError}</p>}
                  </form>
                )}

                {selected.payerCredentials.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No payer credentials added. Click + Add Payer to track credentialing status with each insurance company.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selected.payerCredentials.map((cred) => (
                      <div key={cred.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{cred.payerName}</span>
                            <span className="text-xs text-gray-400 font-mono">{cred.payerId}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                            {cred.applicationDate && <span>Applied {new Date(cred.applicationDate).toLocaleDateString()}</span>}
                            {cred.approvedDate && <span>Approved {new Date(cred.approvedDate).toLocaleDateString()}</span>}
                            {cred.expiryDate && (
                              <span className={daysUntil(cred.expiryDate) !== null && daysUntil(cred.expiryDate)! <= 30 ? "text-orange-600 font-medium" : ""}>
                                Expires {new Date(cred.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {cred.notes && <p className="text-xs text-gray-400 mt-0.5">{cred.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={cred.status}
                            onChange={(e) => handleUpdatePayerStatus(cred.id, e.target.value as CredentialStatus)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          >
                            {Object.entries(CRED_STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          <CredBadge status={cred.status} />
                          <button
                            onClick={() => handleDeletePayer(cred.id, cred.payerName)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
