"use client"

import { useState } from "react"
import AppLayout from "@/components/AppLayout"

interface Summary {
  dryRun: boolean
  patientsCreated: number
  providersCreated: number
  claimsCreated: number
  denialsCreated: number
  skipped: number
  warnings: string[]
}
interface SampleRecord {
  patientFirstName?: string
  patientLastName?: string
  payerName?: string
  serviceDate?: string
  lines?: { cptCode?: string }[]
  totalCharge?: number
  status?: string
  carcCodes?: string[]
}
interface ImportResponse {
  format: string
  recordCount: number
  parseWarnings: string[]
  sample?: SampleRecord[]
  summary: Summary
}

const FORMATS = [
  { v: "835", label: "835 / ERA remittance files — best for a denial backlog" },
  { v: "csv", label: "CSV / spreadsheet export of claims or denials" },
  { v: "837", label: "837 claim files" },
  { v: "text", label: "Paste an EOB / denial report (AI extraction)" },
]

export default function ImportPage() {
  const [format, setFormat] = useState("835")
  const [contents, setContents] = useState<string[]>([])
  const [text, setText] = useState("")
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setContents(await Promise.all(Array.from(files).map((f) => f.text())))
    setResult(null)
  }

  async function run(mode: "preview" | "commit") {
    setLoading(true)
    setError(null)
    try {
      const payload =
        format === "text"
          ? { format, contents: [text], mode }
          : { format, contents, mode }
      const res = await fetch("/api/import/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Import failed")
      setResult(data as ImportResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setLoading(false)
    }
  }

  const s = result?.summary
  const warnings = [...(result?.parseWarnings ?? []), ...(s?.warnings ?? [])]
  const canRun = format === "text" ? text.trim().length > 0 : contents.length > 0

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Import backlog</h1>
        <p className="text-sm text-gray-500 mb-6">
          Load a practice&apos;s historical claims &amp; denials. <b>Preview first</b> — nothing is written until you commit.
        </p>

        <label className="block text-xs font-medium text-gray-500 mb-1.5">Format</label>
        <select
          value={format}
          onChange={(e) => { setFormat(e.target.value); setResult(null) }}
          className="w-full mb-5 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
        </select>

        {format === "text" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            aria-label="Paste EOB or denial report text"
            placeholder="Paste the EOB / denial report text here…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono mb-4"
          />
        ) : (
          <div className="mb-4">
            <input type="file" multiple onChange={(e) => onFiles(e.target.files)} accept=".835,.837,.era,.edi,.txt,.csv" className="text-sm" />
            {contents.length > 0 && <p className="text-xs text-gray-500 mt-1.5">{contents.length} file(s) loaded</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => run("preview")}
            disabled={loading || !canRun}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Working…" : "Preview"}
          </button>
          {s?.dryRun && (result?.recordCount ?? 0) > 0 && (
            <button
              onClick={() => run("commit")}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Commit import
            </button>
          )}
        </div>

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {result && s && (
          <div className="mt-6 border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{s.dryRun ? "Preview" : "✓ Committed"}</h2>
              <span className="text-xs text-gray-500">{result.recordCount} record(s) parsed</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center mb-4">
              {([["Patients", s.patientsCreated], ["Claims", s.claimsCreated], ["Denials", s.denialsCreated], ["Skipped", s.skipped]] as const).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg py-3">
                  <div className="text-xl font-semibold text-gray-900">{v}</div>
                  <div className="text-[11px] text-gray-500">{k}{s.dryRun ? " (would create)" : ""}</div>
                </div>
              ))}
            </div>
            {warnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1 mb-4">
                {warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
              </ul>
            )}
            {result.sample && result.sample.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1.5 pr-3">Patient</th><th className="pr-3">Payer</th><th className="pr-3">DOS</th>
                      <th className="pr-3">CPT</th><th className="pr-3">Charge</th><th className="pr-3">Status</th><th>CARC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sample.slice(0, 15).map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5 pr-3">{[r.patientFirstName, r.patientLastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="pr-3">{r.payerName || "—"}</td>
                        <td className="pr-3">{r.serviceDate || "—"}</td>
                        <td className="pr-3">{r.lines?.[0]?.cptCode || "—"}</td>
                        <td className="pr-3">{r.totalCharge != null ? `$${r.totalCharge}` : "—"}</td>
                        <td className="pr-3">{r.status}</td>
                        <td>{(r.carcCodes ?? []).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
