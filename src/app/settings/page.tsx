"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import NavBar from "@/components/NavBar"

// ─── Types ──────────────────────────────────────────────────────────────────

interface Practice {
  id: string
  name: string
  npi: string
  taxId: string
  taxonomy: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zip: string
  phone: string
  platformFeePercent: number
  stripeOnboarded: boolean
}

interface Provider {
  id: string
  firstName: string
  lastName: string
  npi: string
  taxonomy: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  gender: string
  memberId: string
  groupNumber: string | null
  payerId: string
  payerName: string
  addressLine1: string
  city: string
  state: string
  zip: string
}

const COMMON_TAXONOMIES = [
  { code: "193200000X", label: "Group Counseling" },
  { code: "101YA0400X", label: "Addiction Counselor" },
  { code: "101YM0800X", label: "Mental Health Counselor" },
  { code: "103T00000X", label: "Psychologist" },
  { code: "1041C0700X", label: "Clinical Social Worker" },
  { code: "106H00000X", label: "Marriage & Family Therapist" },
  { code: "2084P0800X", label: "Psychiatry" },
]

const COMMON_PAYERS = [
  { id: "AETNA", name: "Aetna" },
  { id: "BCBS", name: "BlueCross BlueShield" },
  { id: "UHC", name: "United Healthcare" },
  { id: "CIGNA", name: "Cigna" },
  { id: "HUMANA", name: "Humana" },
  { id: "MAGELLAN", name: "Magellan Health" },
  { id: "OPTUM", name: "Optum" },
  { id: "MEDICAID", name: "Medicaid" },
  { id: "MEDICARE", name: "Medicare" },
]

const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-400"

// ─── Practice Tab ───────────────────────────────────────────────────────────

function PracticeTab({ practice, onSaved }: { practice: Practice | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Practice>>(practice ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (practice) {
      setForm({
        ...practice,
        npi: practice.npi?.startsWith("PENDING-") ? "" : practice.npi,
        taxId: practice.taxId === "PENDING" ? "" : practice.taxId,
        addressLine1: practice.addressLine1 === "PENDING" ? "" : practice.addressLine1,
        city: practice.city === "PENDING" ? "" : practice.city,
        state: practice.state === "XX" ? "" : practice.state,
        zip: practice.zip === "00000" ? "" : practice.zip,
        phone: practice.phone === "0000000000" ? "" : practice.phone,
      })
    }
  }, [practice])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/practices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Save failed")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function field(key: keyof Practice, label: string, opts?: { placeholder?: string; half?: boolean; type?: string }) {
    return (
      <div className={opts?.half ? "" : "col-span-2"}>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
        <input
          type={opts?.type ?? "text"}
          value={(form[key] as string) ?? ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={opts?.placeholder}
          className={inputClass}
        />
      </div>
    )
  }

  if (!practice) {
    return <div className="text-gray-400 text-sm py-8 text-center">Loading practice details…</div>
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Practice Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("name", "Practice Name")}
          {field("npi", "NPI", { half: true })}
          {field("taxId", "Tax ID", { half: true })}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Taxonomy Code</label>
            <select
              value={form.taxonomy ?? ""}
              onChange={(e) => setForm({ ...form, taxonomy: e.target.value })}
              className={inputClass}
            >
              {COMMON_TAXONOMIES.map((t) => (
                <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Address & Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("addressLine1", "Address Line 1")}
          {field("addressLine2", "Address Line 2 (optional)")}
          {field("city", "City", { half: true })}
          {field("state", "State", { half: true, placeholder: "NY" })}
          {field("zip", "ZIP", { half: true })}
          {field("phone", "Phone", { half: true, placeholder: "2125551234" })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Billing Settings</h3>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Claima Platform Fee (%)</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={form.platformFeePercent ?? 5}
              onChange={(e) => setForm({ ...form, platformFeePercent: parseFloat(e.target.value) })}
              step="0.5"
              min="0"
              max="20"
              className="w-32 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
            <span className="text-gray-400 text-sm">applied to patient payments only</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
      </div>
    </form>
  )
}

// ─── Providers Tab ───────────────────────────────────────────────────────────

function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firstName: "", lastName: "", npi: "", taxonomy: "193200000X" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/providers")
      const data = await res.json()
      setProviders(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add provider")
      setForm({ firstName: "", lastName: "", npi: "", taxonomy: "193200000X" })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Providers</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {showForm ? "Cancel" : "+ Add Provider"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 space-y-4 shadow-sm">
          <h4 className="text-xs text-gray-500 uppercase tracking-widest font-medium">New Provider</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                placeholder="Emily"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                placeholder="Chen"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">NPI (10 digits)</label>
              <input
                value={form.npi}
                onChange={(e) => setForm({ ...form, npi: e.target.value })}
                required
                maxLength={10}
                placeholder="1234567890"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Taxonomy</label>
              <select
                value={form.taxonomy}
                onChange={(e) => setForm({ ...form, taxonomy: e.target.value })}
                className={inputClass}
              >
                {COMMON_TAXONOMIES.map((t) => (
                  <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {saving ? "Adding…" : "Add Provider"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">No providers yet. Add one above.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NPI</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxonomy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-gray-500 text-xs">{p.npi}</td>
                  <td className="px-5 py-3.5 font-mono text-gray-400 text-xs">{p.taxonomy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Patients Tab ────────────────────────────────────────────────────────────

function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", dob: "", gender: "F" as "M" | "F" | "U",
    memberId: "", groupNumber: "", payerId: "AETNA", payerName: "Aetna",
    addressLine1: "", city: "New York", state: "NY", zip: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const url = q ? `/api/patients?q=${encodeURIComponent(q)}` : "/api/patients"
      const res = await fetch(url)
      const data = await res.json()
      setPatients(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setSearch(q)
    load(q)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, groupNumber: form.groupNumber || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to add patient")
      setForm({
        firstName: "", lastName: "", dob: "", gender: "F",
        memberId: "", groupNumber: "", payerId: "AETNA", payerName: "Aetna",
        addressLine1: "", city: "New York", state: "NY", zip: "",
      })
      setShowForm(false)
      load(search || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  function payerChange(payerId: string) {
    const payer = COMMON_PAYERS.find((p) => p.id === payerId)
    setForm({ ...form, payerId, payerName: payer?.name ?? payerId })
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Patients</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {showForm ? "Cancel" : "+ Add Patient"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 space-y-4 shadow-sm">
          <h4 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Patient Demographics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date of Birth</label>
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "M" | "F" | "U" })} className={inputClass}>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown / Other</option>
              </select>
            </div>
          </div>

          <h4 className="text-xs text-gray-500 uppercase tracking-widest font-medium pt-2">Insurance</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Payer</label>
              <select value={form.payerId} onChange={(e) => payerChange(e.target.value)} className={inputClass}>
                {COMMON_PAYERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Member ID</label>
              <input value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} required placeholder="W123456789" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Group Number (optional)</label>
              <input value={form.groupNumber} onChange={(e) => setForm({ ...form, groupNumber: e.target.value })} placeholder="GRP-12345" className={inputClass} />
            </div>
          </div>

          <h4 className="text-xs text-gray-500 uppercase tracking-widest font-medium pt-2">Address</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Street Address</label>
              <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} required placeholder="123 Main St" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">State</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required maxLength={2} placeholder="NY" className={`${inputClass} uppercase`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">ZIP</label>
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required placeholder="10001" className={inputClass} />
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            {saving ? "Adding…" : "Add Patient"}
          </button>
        </form>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or member ID…"
          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-400"
        />
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
      ) : patients.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">
          {search ? `No patients matching "${search}"` : "No patients yet. Add one above."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DOB</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{p.lastName}, {p.firstName}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">
                    {new Date(p.dob).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{p.payerName}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{p.memberId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Integrations Tab ────────────────────────────────────────────────────────

interface IntegrationStatus {
  stripeConfigured: boolean
  stediConfigured: boolean
  anthropicConfigured: boolean
  dbConfigured: boolean
}

function IntegrationsTab() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setStatus({
            stripeConfigured: !!data.stripeConfigured,
            stediConfigured: !!data.stediConfigured,
            anthropicConfigured: !!data.anthropicConfigured,
            dbConfigured: !!data.dbConfigured,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const integrations = [
    {
      name: "Stripe",
      description: "Patient payment collection via card. Required for live billing.",
      configured: status?.stripeConfigured ?? false,
      envVars: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
      docsUrl: "https://dashboard.stripe.com/apikeys",
      docsLabel: "Get API keys →",
      note: "Use test mode keys (prefix sk_test_) during development.",
    },
    {
      name: "Stedi Clearinghouse",
      description: "837P electronic claim submission to insurance payers.",
      configured: status?.stediConfigured ?? false,
      envVars: ["STEDI_API_KEY"],
      docsUrl: "https://www.stedi.com/app/keys",
      docsLabel: "Get API key →",
      note: "Without this key, claims submit in mock mode (accepted locally, not sent to payers).",
    },
    {
      name: "Anthropic (Claude)",
      description: "AI-generated denial appeal letters.",
      configured: status?.anthropicConfigured ?? false,
      envVars: ["ANTHROPIC_API_KEY"],
      docsUrl: "https://console.anthropic.com/settings/keys",
      docsLabel: "Get API key →",
      note: "Required for the AI appeal letter feature in Denials.",
    },
    {
      name: "Database (Supabase)",
      description: "PostgreSQL for claims, patients, statements, and billing data.",
      configured: status?.dbConfigured ?? false,
      envVars: ["DATABASE_URL"],
      docsUrl: "https://supabase.com/dashboard/project/_/settings/database",
      docsLabel: "Get connection string →",
      note: "Without this, all data is ephemeral — nothing persists between requests.",
    },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      <div className="text-xs text-gray-400 mb-2">
        Set env vars in <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">.env.local</code> then restart the dev server.
      </div>

      {integrations.map((integ) => (
        <div key={integ.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-gray-900 text-sm">{integ.name}</h3>
                {loading ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">checking…</span>
                ) : integ.configured ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Not configured
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{integ.description}</p>
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            {integ.envVars.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <code className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">{v}</code>
              </div>
            ))}
          </div>

          {!integ.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-3">
              {integ.note}
            </div>
          )}

          <a
            href={integ.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {integ.docsLabel}
          </a>
        </div>
      ))}
    </div>
  )
}

// ─── Data & Privacy Tab ──────────────────────────────────────────────────────

function DataPrivacyTab() {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showDeleteSection, setShowDeleteSection] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch("/api/admin/export")
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? "claima-export.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (confirmText !== "DELETE MY PRACTICE") return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/admin/practice", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE MY PRACTICE" }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? "Delete failed")
      window.location.href = "/login?deleted=1"
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed")
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Export */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">Export Practice Data</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Download a full JSON export of all your practice data — patients, claims, denials, statements, providers, and audit logs. Required for HIPAA offboarding.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {exporting ? "Preparing export…" : "Download data export"}
        </button>
      </div>

      {/* Delete */}
      <div className="bg-white border border-red-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-red-700 text-sm mb-1">Delete Practice & All Data</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Permanently deletes your practice account and all associated PHI — patients, claims, denials, providers, statements, and audit logs. This action cannot be undone. Export your data first.
        </p>
        {!showDeleteSection ? (
          <button
            onClick={() => setShowDeleteSection(true)}
            className="text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            I want to delete my practice
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              Type <strong>DELETE MY PRACTICE</strong> below to confirm. This will immediately and permanently delete all data.
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY PRACTICE"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all font-mono"
            />
            {deleteError && (
              <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText !== "DELETE MY PRACTICE"}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting…" : "Permanently delete everything"}
              </button>
              <button
                onClick={() => { setShowDeleteSection(false); setConfirmText(""); setDeleteError(null) }}
                className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Audit Log Tab ───────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  userEmail: string | null
  action: string
  resource: string | null
  resourceId: string | null
  ip: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Sign in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.login_blocked": "Account locked (too many failures)",
  "baa.accepted": "BAA accepted",
  "claim.list": "Viewed claims",
  "claim.create": "Submitted claim",
  "denial.list": "Viewed denials",
  "eligibility.check": "Eligibility check",
  "patient.list": "Viewed patients",
  "patient.create": "Added patient",
  "provider.list": "Viewed providers",
  "practice.view": "Viewed practice settings",
  "practice.export": "Exported practice data",
  "practice.delete": "Deleted practice",
  "analytics.view": "Viewed analytics dashboard",
  "statement.list": "Viewed statements",
  "payment.create": "Recorded payment",
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/audit?page=${page}`)
      .then(r => r.json())
      .then(data => {
        setLogs(Array.isArray(data.logs) ? data.logs : [])
        setPages(data.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-0.5">All PHI access and data changes — required for HIPAA compliance.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No audit events yet. Events will appear here as users interact with the system.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                    {log.userEmail ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 ${log.action === "auth.login_failed" ? "text-red-600" : "text-gray-800"}`}>
                      {log.action === "auth.login_failed" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">
                    {log.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = "practice" | "providers" | "patients" | "integrations" | "audit" | "data"

function SettingsInner() {
  const params = useSearchParams()
  const initialTab = (params.get("tab") as Tab | null) ?? "practice"
  const [tab, setTab] = useState<Tab>(initialTab)
  const [practice, setPractice] = useState<Practice | null>(null)

  const loadPractice = useCallback(async () => {
    try {
      const res = await fetch("/api/practices")
      if (res.ok) setPractice(await res.json())
    } catch {}
  }, [])

  useEffect(() => { loadPractice() }, [loadPractice])

  const TABS: { id: Tab; label: string }[] = [
    { id: "practice", label: "Practice Info" },
    { id: "providers", label: "Providers" },
    { id: "patients", label: "Patients" },
    { id: "integrations", label: "Integrations" },
    { id: "audit", label: "Audit Log" },
    { id: "data", label: "Data & Privacy" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <NavBar />
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your practice, providers, and patients</p>
        </div>

        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-xl p-1 mb-8 w-fit shadow-sm">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "practice" && <PracticeTab practice={practice} onSaved={loadPractice} />}
        {tab === "providers" && <ProvidersTab />}
        {tab === "patients" && <PatientsTab />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "audit" && <AuditTab />}
        {tab === "data" && <DataPrivacyTab />}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}
