"use client"

import { useEffect, useState, useCallback } from "react"
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

// ─── Practice Tab ───────────────────────────────────────────────────────────

function PracticeTab({ practice, onSaved }: { practice: Practice | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Practice>>(practice ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (practice) setForm(practice)
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
        <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
        <input
          type={opts?.type ?? "text"}
          value={(form[key] as string) ?? ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={opts?.placeholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
    )
  }

  if (!practice) {
    return <div className="text-gray-500 text-sm py-8 text-center">Loading practice details…</div>
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold mb-4">Practice Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("name", "Practice Name")}
          {field("npi", "NPI", { half: true })}
          {field("taxId", "Tax ID", { half: true })}
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1.5">Taxonomy Code</label>
            <select
              value={form.taxonomy ?? ""}
              onChange={(e) => setForm({ ...form, taxonomy: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {COMMON_TAXONOMIES.map((t) => (
                <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">Address & Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          {field("addressLine1", "Address Line 1")}
          {field("addressLine2", "Address Line 2 (optional)")}
          {field("city", "City", { half: true })}
          {field("state", "State", { half: true, placeholder: "NY" })}
          {field("zip", "ZIP", { half: true })}
          {field("phone", "Phone", { half: true, placeholder: "2125551234" })}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">Billing Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1.5">MediBill Platform Fee (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={form.platformFeePercent ?? 5}
                onChange={(e) => setForm({ ...form, platformFeePercent: parseFloat(e.target.value) })}
                step="0.5"
                min="0"
                max="20"
                className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-sm">applied to patient payments only</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
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
        <h3 className="font-semibold">Providers</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Provider"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                placeholder="Emily"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                placeholder="Chen"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">NPI (10 digits)</label>
              <input
                value={form.npi}
                onChange={(e) => setForm({ ...form, npi: e.target.value })}
                required
                maxLength={10}
                placeholder="1234567890"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Taxonomy</label>
              <select
                value={form.taxonomy}
                onChange={(e) => setForm({ ...form, taxonomy: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {COMMON_TAXONOMIES.map((t) => (
                  <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Adding…" : "Add Provider"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">No providers yet. Add one above.</div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NPI</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxonomy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-100">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-gray-400 text-xs">{p.npi}</td>
                  <td className="px-5 py-3.5 font-mono text-gray-500 text-xs">{p.taxonomy}</td>
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
        <h3 className="font-semibold">Patients</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Patient"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-6 space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Patient Demographics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Date of Birth</label>
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "M" | "F" | "U" })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown / Other</option>
              </select>
            </div>
          </div>

          <h4 className="text-sm font-medium text-gray-300 pt-2">Insurance</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Payer</label>
              <select value={form.payerId} onChange={(e) => payerChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                {COMMON_PAYERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Member ID</label>
              <input value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} required placeholder="W123456789"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Group Number (optional)</label>
              <input value={form.groupNumber} onChange={(e) => setForm({ ...form, groupNumber: e.target.value })} placeholder="GRP-12345"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <h4 className="text-sm font-medium text-gray-300 pt-2">Address</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Street Address</label>
              <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} required placeholder="123 Main St"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">State</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required maxLength={2} placeholder="NY"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 uppercase" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">ZIP</label>
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} required placeholder="10001"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? "Adding…" : "Add Patient"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or member ID…"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading…</div>
      ) : patients.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">
          {search ? `No patients matching "${search}"` : "No patients yet. Add one above."}
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DOB</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-100">{p.lastName}, {p.firstName}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">
                    {new Date(p.dob).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">{p.payerName}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{p.memberId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = "practice" | "providers" | "patients"

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("practice")
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
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your practice, providers, and patients</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 bg-gray-900/60 border border-gray-800 rounded-xl p-1 mb-8 w-fit">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "practice" && <PracticeTab practice={practice} onSaved={loadPractice} />}
        {tab === "providers" && <ProvidersTab />}
        {tab === "patients" && <PatientsTab />}
      </div>
    </div>
  )
}
