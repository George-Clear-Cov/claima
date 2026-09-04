"use client"

/**
 * The Leak Report tool.
 *
 * The diagnostic runs entirely in the visitor's browser. The file is read with the File API,
 * parsed by the pure adapters in src/lib/import, and analyzed by src/lib/leak-report. There
 * is no fetch, no upload, no analytics call and no server action on that path — which is what
 * keeps a prospect's A/R export out of PHI scope and lets us make the promise on the page
 * truthfully. Do not add a network call to the diagnostic path without a compliance review.
 *
 * There is exactly ONE way the file leaves the browser, and it is the visitor's deliberate
 * choice: the activation flow at the bottom of the report. The ordering there is a HIPAA
 * requirement, not a UX preference — the account is created and the BAA accepted FIRST
 * (/api/auth/register records baaAcceptedAt + IP), and only then is the file text posted to
 * /api/import/backlog, which independently refuses PHI without a BAA on file. The raw text
 * is held in React state for exactly this reason: it never touches sessionStorage, so a
 * prospect who abandons the flow leaves no PHI behind on their own machine either.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { parseCsvBacklog } from "@/lib/import/fromCsv"
import { parse835Backlog } from "@/lib/import/from835"
import { analyzeLeakReport, RECOVERY_RATE_BASIS, type LeakReport, type LeakSource } from "@/lib/leak-report"
import { PASSWORD_RULES } from "@/lib/password"
import { isValidNpi } from "@/lib/npi"

type Audience = "practice" | "portfolio"

/** A parsed file, plus the original text so activation can commit it without a re-upload. */
interface AnalyzedSource extends LeakSource {
  rawText: string
  format: "835" | "csv"
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

const pct = (n: number) => `${Math.round(n)}%`

function detectFormat(name: string, text: string): "835" | "csv" {
  if (/^\s*ISA/.test(text)) return "835"
  if (/\.(835|edi|era|txt)$/i.test(name) && text.includes("~")) return "835"
  return "csv"
}

export default function LeakReportTool({ activationEnabled = false }: { activationEnabled?: boolean }) {
  const [report, setReport] = useState<LeakReport | null>(null)
  const [sources, setSources] = useState<AnalyzedSource[]>([])
  const [audience, setAudience] = useState<Audience>("practice")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback(async (files: FileList | File[]) => {
    setBusy(true)
    setError(null)
    try {
      const analyzed: AnalyzedSource[] = []

      for (const file of Array.from(files)) {
        const text = await file.text()
        const format = detectFormat(file.name, text)
        const parsed = format === "835" ? parse835Backlog([text]) : parseCsvBacklog(text)
        if (parsed.records.length > 0) {
          analyzed.push({
            name: file.name.replace(/\.[^.]+$/, ""),
            records: parsed.records,
            rawText: text,
            format,
          })
        }
      }

      if (analyzed.length === 0) {
        setError(
          "No claim rows were found in that file. An aging or A/R export with one row per " +
            "service line works best. It needs at least a payer column and a balance column.",
        )
        setReport(null)
        return
      }

      const result = analyzeLeakReport(analyzed)
      if (result.totals.balance === 0) {
        setError(
          "Rows were found, but every balance came through as zero. The balance column may " +
            "have a header we did not recognize. Try renaming it to Balance or Billed.",
        )
        setReport(null)
        return
      }

      setAudience(analyzed.length > 1 ? "portfolio" : "practice")
      setSources(analyzed)
      setReport(result)
    } catch {
      setError("That file could not be read. Plain CSV or an 835 text file works best.")
      setReport(null)
    } finally {
      setBusy(false)
    }
  }, [])

  if (report) {
    return (
      <Report
        report={report}
        sources={sources}
        activationEnabled={activationEnabled}
        audience={audience}
        onAudienceChange={setAudience}
        onReset={() => {
          setReport(null)
          setSources([])
          setError(null)
          if (inputRef.current) inputRef.current.value = ""
        }}
      />
    )
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files?.length) void run(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.txt,.835,.edi,.era,text/csv,text/plain"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void run(e.target.files)
          }}
        />
        <div className="mx-auto mb-4 w-11 h-11 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-900">
          {busy ? "Reading your file…" : "Drop your A/R aging export here"}
        </p>
        <p className="text-sm text-gray-600 mt-1.5 max-w-md mx-auto leading-relaxed">
          CSV from any practice-management system, or a raw 835 remittance file. Drop several
          files to analyze a whole group at once.
        </p>
        <p className="text-xs text-gray-500 mt-4">No signup. No account. Nothing is uploaded.</p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="mt-8 grid sm:grid-cols-3 gap-5 text-sm">
        <Step n="1" title="Export your A/R">
          Any aging or open-balance report. One row per service line, with the payer, the
          service date, the balance, and whatever follow-up notes exist.
        </Step>
        <Step n="2" title="Drop it above">
          It is parsed here, inside your browser. The file never touches a network and never
          reaches us.
        </Step>
        <Step n="3" title="Read the number">
          What is recoverable, which payer is quietly your largest, and what stops being
          collectible in the next 60 days.
        </Step>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center justify-center mb-2.5">
        {n}
      </div>
      <p className="font-semibold text-gray-900 mb-1">{title}</p>
      <p className="text-gray-600 leading-relaxed text-[13px]">{children}</p>
    </div>
  )
}

function Report({
  report: r,
  sources,
  activationEnabled,
  audience,
  onAudienceChange,
  onReset,
}: {
  report: LeakReport
  sources: AnalyzedSource[]
  activationEnabled: boolean
  audience: Audience
  onAudienceChange: (a: Audience) => void
  onReset: () => void
}) {
  const portfolio = audience === "portfolio"
  const [activating, setActivating] = useState(false)

  const emailBody = encodeURIComponent(
    [
      `A/R analyzed: ${money(r.totals.balance)} across ${r.totals.accounts} accounts`,
      `Never worked: ${money(r.unworked.balance)} (${pct(r.unworked.pctBalance)} of the balance)`,
      `Estimated recoverable: ${money(r.recovery.low)} to ${money(r.recovery.high)}`,
      `Closing within 60 days: ${money(r.deadlines.within60.balance)}`,
      "",
      "I would like to talk about recovering this.",
    ].join("\n"),
  )

  return (
    <div className="space-y-10">
      {/* Headline */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-900 px-7 py-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
            Estimated recoverable
          </p>
          <p className="text-4xl font-bold tracking-tight">
            {money(r.recovery.low)} <span className="text-gray-500 font-normal">to</span> {money(r.recovery.high)}
          </p>
          <p className="text-sm text-gray-300 mt-2.5 leading-relaxed">
            From {money(r.totals.balance)} of A/R across {r.totals.accounts.toLocaleString()} accounts
            {portfolio ? ` at ${r.totals.sources} locations` : ""}. That is {pct(r.recovery.lowPct)} to{" "}
            {pct(r.recovery.highPct)} of the book.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
          <Stat label="Total A/R" value={money(r.totals.balance)} />
          <Stat label="Never worked" value={pct(r.unworked.pctBalance)} tone="warn" />
          <Stat label="Closing in 60 days" value={money(r.deadlines.within60.balance)} tone="warn" />
          <Stat label="Payers, consolidated" value={`${r.totals.payersAsWritten} → ${r.totals.payersConsolidated}`} />
        </div>
      </section>

      {/* Finding 1 — unworked */}
      <Finding
        n="01"
        title="Most of this was never worked"
        lede={`${r.unworked.accounts} of ${r.totals.accounts} accounts, holding ${money(
          r.unworked.balance,
        )}, carry no follow-up note at all.`}
      >
        <p>
          This is the finding that changes the conversation. {pct(r.unworked.pctBalance)} of the
          balance is not a denial problem and not an appeals problem. Nobody touched it. An aged
          claim with no worklog is <strong>status unknown</strong>, not denied, and the two need
          opposite responses: a status inquiry establishes whether the payer ever received the
          claim, while an appeal on a claim that was never adjudicated burns the appeal and misses
          the real fix.
        </p>
      </Finding>

      {/* Finding 2 — fragmentation */}
      {r.fragmentation.merged.length > 0 && (
        <Finding
          n="02"
          title="Your payer list is hiding your largest payer"
          lede={`${r.totals.payersAsWritten} payer names in the export are really ${r.totals.payersConsolidated} payers.`}
        >
          {r.fragmentation.hidden.length > 0 ? (
            <p>
              <strong>{r.fragmentation.hidden[0].canonical}</strong> appears under{" "}
              {r.fragmentation.hidden[0].variants.length} different spellings. Written out, its
              biggest single entry ranks #{r.fragmentation.hidden[0].rankAsWritten} in your book.
              Consolidated, it is <strong>#{r.fragmentation.hidden[0].rankConsolidated}</strong> at{" "}
              {money(r.fragmentation.hidden[0].balance)}. One payer split across several spellings
              looks like several small problems instead of the largest one, which is exactly why it
              never gets escalated.
            </p>
          ) : (
            <p>
              Several payers appear under more than one spelling. Consolidating them changes what
              your A/R actually looks like and which payer is worth an escalation.
            </p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-semibold">Payer</th>
                  <th className="py-2 pr-4 font-semibold">Appears as</th>
                  <th className="py-2 pr-4 font-semibold text-right">Accounts</th>
                  <th className="py-2 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {r.fragmentation.merged.slice(0, 8).map((p) => (
                  <tr key={p.canonical}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{p.canonical}</td>
                    <td className="py-2.5 pr-4 text-gray-600 text-[13px]">{p.variants.join(", ")}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">{p.accounts}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-gray-900">{money(p.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Finding>
      )}

      {/* Finding 3 — tiers */}
      <Finding
        n={r.fragmentation.merged.length > 0 ? "03" : "02"}
        title="What to do with it, in order"
        lede="Aged A/R is not one problem. Each tier below needs a different action, and they are not equally worth your time."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-semibold">Tier</th>
                <th className="py-2 pr-4 font-semibold text-right">Accts</th>
                <th className="py-2 pr-4 font-semibold text-right">Balance</th>
                <th className="py-2 font-semibold text-right">Est. recovery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.tiers.map((t) => (
                <tr key={t.tier}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          t.priority === "HIGH" ? "bg-red-500" : t.priority === "MEDIUM" ? "bg-amber-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="font-medium text-gray-900">{t.label}</span>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-1 leading-relaxed max-w-md">{t.action}</p>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-gray-700 align-top">{t.accounts}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-gray-700 align-top">{money(t.balance)}</td>
                  <td className="py-3 text-right tabular-nums font-medium text-gray-900 align-top whitespace-nowrap">
                    {money(t.recoveryLow)}–{money(t.recoveryHigh)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Finding>

      {/* Finding 4 — deadlines */}
      {(r.deadlines.within60.accounts > 0 || r.deadlines.alreadyClosed.accounts > 0) && (
        <Finding
          n={r.fragmentation.merged.length > 0 ? "04" : "03"}
          title="What stops being collectible soon"
          lede="Timely filing is the one deadline that does not negotiate."
        >
          <div className="grid sm:grid-cols-3 gap-4 mt-1">
            <Deadline label="Closes within 30 days" {...r.deadlines.within30} tone="red" />
            <Deadline label="Closes within 60 days" {...r.deadlines.within60} tone="amber" />
            <Deadline label="Window already closed" {...r.deadlines.alreadyClosed} tone="gray" />
          </div>
          <p className="mt-4">
            A closed filing window is not automatically a write-off. Medicare allows a reopening
            for a full year from the date of service, and most payers have good-cause provisions.
            But every day of delay moves balance from the first column into the third.
          </p>
        </Finding>
      )}

      {/* Portfolio rollup */}
      {r.sources.length > 1 && (
        <Finding n="05" title="By location" lede="The same analysis, split by the files you dropped in.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-semibold">Location</th>
                  <th className="py-2 pr-4 font-semibold text-right">Accts</th>
                  <th className="py-2 pr-4 font-semibold text-right">A/R</th>
                  <th className="py-2 pr-4 font-semibold text-right">Never worked</th>
                  <th className="py-2 font-semibold text-right">Est. recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {r.sources.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{s.name}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">{s.accounts}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">{money(s.balance)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-amber-700">{pct(s.unworkedPctBalance)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">
                      {money(s.recoveryLow)}–{money(s.recoveryHigh)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            Variance between locations is usually a staffing and process gap, not a payer-mix
            difference. The location with the highest never-worked percentage is where a single
            change produces the most cash.
          </p>
        </Finding>
      )}

      {/* Methodology + honesty */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 px-7 py-6 text-sm text-gray-600 leading-relaxed">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-3">
          How this number was produced
        </p>
        <p className="mb-3">
          Each account is triaged by payer, age, and whether anyone documented follow-up, then a
          recovery range is applied per tier. {RECOVERY_RATE_BASIS}
        </p>
        {r.dataQuality.length > 0 && (
          <>
            <p className="font-medium text-gray-800 mb-1.5">What this export did not contain:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              {r.dataQuality.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </>
        )}
        <p>
          Your file was parsed in this browser tab and was never transmitted. Close the tab and
          nothing about it remains.
        </p>
      </section>

      {/* CTA — the activation flow, not a mailto */}
      <section className="rounded-xl border border-blue-100 bg-blue-50 px-7 py-7 print:hidden">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {portfolio
            ? "Start recovering this across the portfolio"
            : `Start recovering the ${money(r.recovery.low)}`}
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-5 max-w-2xl">
          We work this A/R on contingency. You pay 30% of what we actually recover, nothing on
          what we do not, and nothing up front. No system migration and no change to how you bill
          today. If we recover the low end of this estimate, you keep{" "}
          {money(r.recovery.low - r.recovery.feeLow)} you were not going to see.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {activationEnabled ? (
            <button
              onClick={() => setActivating(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              Start recovery &rarr;
            </button>
          ) : (
            <a
              href={`mailto:george@claima.io?subject=${encodeURIComponent("Leak Report — recovering our A/R")}&body=${emailBody}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm"
            >
              Send us this summary
            </a>
          )}
          <button
            onClick={() => window.print()}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
          >
            Save as PDF
          </button>
          <button onClick={onReset} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2.5">
            Analyze a different file
          </button>
        </div>
        <p className="text-[12px] text-gray-500 mt-4">
          {activationEnabled
            ? "Takes about a minute. You confirm who the practice is, accept the BAA and the services agreement, and verify your email. Only then does this same file load into your account as a worklist. Nothing is sent before that."
            : "The summary email carries totals only — no patient, account, or claim detail leaves your machine."}
        </p>
      </section>

      {activationEnabled && activating && (
        <ActivateModal
          sources={sources}
          report={r}
          onClose={() => setActivating(false)}
        />
      )}

      {r.sources.length > 1 && (
        <div className="text-center">
          <button
            onClick={() => onAudienceChange(portfolio ? "practice" : "portfolio")}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {portfolio ? "View as a single practice" : "View as a portfolio"}
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone === "warn" ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  )
}

function Deadline({ label, accounts, balance, tone }: { label: string; accounts: number; balance: number; tone: "red" | "amber" | "gray" }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    gray: "border-gray-200 bg-gray-50 text-gray-600",
  }
  return (
    <div className={`rounded-lg border px-4 py-3.5 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums">{money(balance)}</p>
      <p className="text-[12px] mt-0.5 opacity-80">{accounts} account{accounts === 1 ? "" : "s"}</p>
    </div>
  )
}

function Finding({ n, title, lede, children }: { n: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm px-7 py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600 mb-2">Finding {n}</p>
      <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-2">{title}</h3>
      <p className="text-[15px] text-gray-800 font-medium leading-relaxed mb-3">{lede}</p>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

/**
 * Activation: identity, then agreements, then a proven email address, and only then the file.
 *
 * The order is the whole point. Before this gate a stranger could push a practice's entire
 * A/R into the product in under a minute, which took on Business Associate obligations for a
 * counterparty we could not identify and created no engagement in return. Now:
 *
 *   1. Practice NPI + Tax ID   — a real, check-digit-valid identity, and the values an 837P
 *                                actually needs. Without them claims cannot be filed at all.
 *   2. BAA + services agreement — the first governs the data, the second creates the
 *                                engagement. Neither is inferred from the other.
 *   3. Emailed 6-digit code    — proves control of the address before any PHI moves.
 *   4. The file.
 *
 * Every one of these is also enforced server-side in /api/import/backlog, so a bug here
 * cannot open the gate. The file text stays in React state throughout and is never written
 * to storage, so abandoning the flow leaves no PHI behind on the visitor's machine either.
 */
function ActivateModal({
  sources,
  report,
  onClose,
}: {
  sources: AnalyzedSource[]
  report: LeakReport
  onClose: () => void
}) {
  const [step, setStep] = useState<"account" | "verify" | "working" | "done">("account")
  const [name, setName] = useState("")
  const [practiceName, setPracticeName] = useState(sources[0]?.name ?? "")
  const [npi, setNpi] = useState("")
  const [taxId, setTaxId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [baaAccepted, setBaaAccepted] = useState(false)
  const [servicesAccepted, setServicesAccepted] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [existingAccount, setExistingAccount] = useState(false)
  const [progress, setProgress] = useState("")
  const [result, setResult] = useState<{ claims: number; denials: number; patients: number } | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "working") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, step])

  const npiDigits = npi.replace(/\D/g, "")
  const taxDigits = taxId.replace(/\D/g, "")
  const npiOk = isValidNpi(npiDigits)
  const npiError =
    npiDigits.length === 10 && !npiOk
      ? "That NPI fails the check digit. Verify it at npiregistry.cms.hhs.gov."
      : null
  const canSubmitAccount = npiOk && taxDigits.length === 9 && baaAccepted && servicesAccepted

  /** Posts the file. Runs only after the email is verified. */
  async function runImport() {
    setStep("working")
    const totals = { claims: 0, denials: 0, patients: 0 }
    const warnings = new Set<string>()
    for (const [i, src] of sources.entries()) {
      setProgress(
        sources.length > 1
          ? `Loading ${src.name} (${i + 1} of ${sources.length})…`
          : `Loading ${report.totals.accounts} accounts into your worklist…`,
      )
      const res = await fetch("/api/import/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: src.format, contents: [src.rawText], mode: "commit" }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail ?? body.error ?? "The import did not complete.")
        setStep("verify")
        return
      }
      const body = await res.json()
      totals.claims += body.summary?.claimsCreated ?? 0
      totals.denials += body.summary?.denialsCreated ?? 0
      totals.patients += body.summary?.patientsCreated ?? 0
      // The import tells us what it had to guess at — placeholder demographics, a
      // placeholder rendering provider. A practice that is about to work this queue needs
      // to know, and silently dropping these was hiding the caveats behind a success screen.
      for (const w of [...(body.summary?.warnings ?? []), ...(body.parseWarnings ?? [])]) warnings.add(w)
    }
    setImportWarnings([...warnings])
    setResult(totals)
    setStep("done")
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExistingAccount(false)
    if (!canSubmitAccount) return

    setStep("working")
    setProgress("Creating your account and recording the agreements…")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          practiceName,
          npi: npiDigits,
          taxId: taxDigits,
          baaAccepted: true,
          servicesAgreementAccepted: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) setExistingAccount(true)
        setError([body.error, body.detail].filter(Boolean).join(" ") || "We could not create the account.")
        setStep("account")
        return
      }
      setNotice(`We emailed a 6-digit code to ${email}.`)
      setStep("verify")
    } catch {
      setError("Something went wrong. Your file has not been sent.")
      setStep("account")
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "That code did not work.")
        return
      }
      await runImport()
    } catch {
      setError("Something went wrong. Your file has not been sent.")
    }
  }

  async function resend() {
    setError(null)
    const res = await fetch("/api/auth/verify-email/resend", { method: "POST" })
    setNotice(res.ok ? "A new code is on its way." : null)
    if (!res.ok) setError("We could not send another code just yet. Wait a moment and try again.")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 px-4 py-10 print:hidden">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {step === "done" && result ? (
          <div className="px-7 py-8">
            <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Your worklist is live</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              Agreements recorded, email verified, and {result.claims.toLocaleString()} claims across{" "}
              {result.patients.toLocaleString()} patients are loaded. The{" "}
              {money(report.recovery.low)}–{money(report.recovery.high)} in this report is now a
              queue you can work, starting with the accounts whose filing windows close first.
            </p>
            {importWarnings.length > 0 && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[12px] font-semibold text-amber-900 mb-1.5">Before you work this queue</p>
                <ul className="list-disc pl-4 space-y-1 text-[12px] text-amber-900 leading-relaxed">
                  {importWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                href="/denials"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                Open the worklist &rarr;
              </a>
              <a
                href="/settings"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Finish practice details
              </a>
            </div>
          </div>
        ) : (
          <div className="px-7 py-7">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                {step === "verify" ? "Verify your email" : "Start recovery"}
              </h3>
              {step !== "working" && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {step === "working" ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                <p className="text-sm font-medium text-gray-900">{progress}</p>
                <p className="text-xs text-gray-500 mt-1.5">This takes a few seconds. Do not close the tab.</p>
              </div>
            ) : step === "verify" ? (
              <form onSubmit={submitCode}>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">
                  Your file is still only on your machine. Enter the code we sent so we know the
                  address belongs to you, and then the {report.totals.accounts.toLocaleString()}{" "}
                  accounts load into your worklist.
                </p>
                <label className="block">
                  <span className="block text-[13px] font-medium text-gray-700 mb-1">6-digit code</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg tracking-[0.4em] font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </label>
                {notice && <p className="text-[12px] text-gray-500 mt-2">{notice}</p>}
                {error && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={code.length !== 6}
                  className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Verify and load my A/R
                </button>
                <button
                  type="button"
                  onClick={resend}
                  className="w-full mt-2 text-[12px] text-gray-500 hover:text-gray-700 py-1"
                >
                  Send a new code
                </button>
              </form>
            ) : (
              <form onSubmit={submitAccount}>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  Your file is still only on your machine. It is sent after the agreements below
                  are accepted and your email is verified, and it becomes a worklist of{" "}
                  {report.totals.accounts.toLocaleString()} accounts worth {money(report.totals.balance)}.
                </p>

                <div className="space-y-3.5">
                  <Field label="Your name" value={name} onChange={setName} autoComplete="name" />
                  <Field
                    label="Practice legal name"
                    value={practiceName}
                    onChange={setPracticeName}
                    hint="As it appears on the BAA and with payers."
                    autoComplete="organization"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Practice NPI"
                      value={npi}
                      onChange={(v) => setNpi(v.replace(/\D/g, "").slice(0, 10))}
                      inputMode="numeric"
                      hint={npiError ?? "10 digits. Public in the NPPES registry."}
                      error={Boolean(npiError)}
                    />
                    <Field
                      label="Tax ID (EIN)"
                      value={taxId}
                      onChange={(v) => setTaxId(v.replace(/\D/g, "").slice(0, 9))}
                      inputMode="numeric"
                      hint="9 digits."
                    />
                  </div>
                  <Field label="Work email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                  <Field
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                    autoComplete="new-password"
                    hint={PASSWORD_RULES.join(" · ")}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  <Consent checked={baaAccepted} onChange={setBaaAccepted}>
                    I accept the{" "}
                    <Link href="/baa" target="_blank" className="text-blue-600 hover:underline font-medium">
                      Business Associate Agreement
                    </Link>
                    , which governs how {practiceName || "the practice"} data is handled.
                  </Consent>
                  <Consent checked={servicesAccepted} onChange={setServicesAccepted}>
                    I accept the{" "}
                    <Link href="/engagement" target="_blank" className="text-blue-600 hover:underline font-medium">
                      Recovery Services Agreement
                    </Link>{" "}
                    — 30% of amounts recovered, nothing otherwise — and I have authority to bind{" "}
                    {practiceName || "the practice"}. Both acceptances are recorded with a timestamp
                    and IP address.
                  </Consent>
                </div>

                {error && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                    {existingAccount && (
                      <>
                        {" "}
                        <Link href="/login" className="underline font-medium">
                          Sign in
                        </Link>{" "}
                        and load this file from the import page instead.
                      </>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmitAccount}
                  className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Continue
                </button>
                <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                  No card required. Nothing is sent until the next step. Already have an account?{" "}
                  <Link href="/login" className="underline hover:text-gray-700">
                    Sign in
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Consent({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-[13px] text-gray-700 leading-relaxed">{children}</span>
    </label>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  autoComplete,
  inputMode,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  autoComplete?: string
  inputMode?: "numeric" | "text"
  error?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-gray-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        }`}
      />
      {hint && (
        <span className={`block text-[11px] mt-1 ${error ? "text-red-600" : "text-gray-500"}`}>{hint}</span>
      )}
    </label>
  )
}
