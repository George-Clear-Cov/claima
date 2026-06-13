"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"]

const TAXONOMIES = [
  { code: "193200000X", label: "Group Practice" },
  // Primary Care
  { code: "207Q00000X", label: "Family Medicine" },
  { code: "207R00000X", label: "Internal Medicine" },
  { code: "208000000X", label: "Pediatrics" },
  { code: "207V00000X", label: "Obstetrics & Gynecology" },
  // Mental & Behavioral Health
  { code: "2084P0800X", label: "Psychiatrist" },
  { code: "103T00000X", label: "Psychologist" },
  { code: "101YM0800X", label: "Mental Health Counselor" },
  { code: "104100000X", label: "Social Worker" },
  { code: "1041C0700X", label: "Clinical Social Worker" },
  { code: "106H00000X", label: "Marriage & Family Therapist" },
  { code: "101YA0400X", label: "Addiction (Substance Use Disorder) Counselor" },
  { code: "363LP0808X", label: "Psychiatric/Mental Health Nurse Practitioner" },
  // Physical Medicine
  { code: "225100000X", label: "Physical Therapist" },
  { code: "225X00000X", label: "Occupational Therapist" },
  { code: "235Z00000X", label: "Speech-Language Pathologist" },
  { code: "111N00000X", label: "Chiropractor" },
  // Specialty
  { code: "207X00000X", label: "Orthopedic Surgery" },
  { code: "207N00000X", label: "Dermatology" },
  { code: "207W00000X", label: "Ophthalmology" },
  { code: "207Y00000X", label: "Otolaryngology (ENT)" },
  { code: "208100000X", label: "Physical Medicine & Rehabilitation" },
  { code: "2086S0120X", label: "Surgery — General" },
  { code: "207P00000X", label: "Emergency Medicine" },
  // Other
  { code: "101Y00000X", label: "Counselor" },
  { code: "101YP2500X", label: "Professional Counselor" },
]

export default function PracticeSetupPage() {
  const router = useRouter()

  const [practiceName, setPracticeName] = useState("")
  const [npi, setNpi] = useState("")
  const [taxId, setTaxId] = useState("")
  const [taxonomy, setTaxonomy] = useState("193200000X")
  const [addressLine1, setAddressLine1] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("CA")
  const [zip, setZip] = useState("")
  const [phone, setPhone] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceName, npi, taxId, taxonomy, addressLine1, city, state, zip, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Setup failed")
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder-gray-300"

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shadow-md">
            C
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-gray-900">Claima</div>
            <div className="text-xs text-gray-400 -mt-0.5">Practice setup</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Set up your practice</h1>
          <p className="text-gray-500 text-sm mt-1">This information is used for claim submission. You can update it anytime in Settings.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Practice Name</label>
              <input type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} required placeholder="Riverside Medical Group" className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Group NPI</label>
                <input type="text" value={npi} onChange={(e) => setNpi(e.target.value)} required placeholder="1234567890" maxLength={10} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">10-digit NPI from NPPES</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Tax ID (EIN)</label>
                <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} required placeholder="12-3456789" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Taxonomy Code</label>
              <select value={taxonomy} onChange={(e) => setTaxonomy(e.target.value)} className={inputClass}>
                {TAXONOMIES.map((t) => (
                  <option key={t.code} value={t.code}>{t.code} — {t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Practice Address</label>
              <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required placeholder="123 Main St, Suite 100" className={inputClass} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="Los Angeles" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">State</label>
                <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">ZIP</label>
                <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} required placeholder="90001" maxLength={10} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(310) 555-0100" className={inputClass} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <span className="text-red-500 shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm"
            >
              {submitting ? "Saving…" : "Go to dashboard →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700 underline">Skip for now</Link>
          {" "}— you can complete this in Settings
        </p>
      </div>
    </div>
  )
}
