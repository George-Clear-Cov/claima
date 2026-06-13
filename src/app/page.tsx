"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import NavBar from "@/components/NavBar"

interface Priority {
  rank: number
  action: string
  reason: string
  urgency: "immediate" | "today" | "this_week"
  dollars: number
}

interface BriefingData {
  date: string
  paidYesterday: number
  totalPaidAmount: number
  newDenials: number
  newDenialsAmount: number
  appealsNeeding: number
  agingClaims: number
  timelyRisks: number
  timelyRisksAmount: number
  overdueStatements: number
  overdueAmount: number
  headline: string
  narrative: string | null
  priorities: Priority[]
}

const URGENCY_CONFIG = {
  immediate: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", badge: "bg-red-100 text-red-700", label: "Immediate" },
  today:     { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-700", label: "Today" },
  this_week: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", badge: "bg-blue-100 text-blue-700", label: "This Week" },
}

function MarketingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">C</div>
            <span className="font-semibold text-sm">Claima</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/security" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Security</Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign in</Link>
            <Link href="/signup" className="text-sm font-medium bg-gray-900 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg transition-colors">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-blue-600 mb-4 tracking-wide uppercase">AI-native medical billing</p>
          <h1 className="text-[3.25rem] font-bold tracking-tight leading-[1.1] text-gray-900 mb-6">
            Your billing team,<br />minus the overhead
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl">
            Claima automates the full revenue cycle — claim submission, denial appeals, ERA posting, and patient billing. You keep seeing patients. We handle the rest.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
              Start for free
            </Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              Sign in to your practice
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-5">HIPAA compliant · BAA included · No contracts</p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-10">How it works</p>
          <div className="grid grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Submit a claim",
                body: "Enter patient and visit details. Claima validates the claim, checks eligibility in real time, and routes it to the payer.",
              },
              {
                step: "02",
                title: "We handle denials",
                body: "When a claim is denied, Claima reads the CARC code and drafts a complete appeal letter using Claude AI — ready to send in one click.",
              },
              {
                step: "03",
                title: "You get paid",
                body: "ERAs are posted automatically. Patient balances are billed and tracked. Every dollar is accounted for.",
              },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs font-mono text-gray-300 mb-3">{s.step}</div>
                <div className="text-base font-semibold text-gray-900 mb-2">{s.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-10">What's included</p>
        <div className="grid grid-cols-2 gap-x-16 gap-y-10">
          {[
            {
              title: "Autonomous billing sweep",
              body: "One click reviews your entire practice: posts ERA payments, drafts pending appeals, flags claims at timely filing risk, and surfaces aging AR.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              ),
            },
            {
              title: "AI-generated appeal letters",
              body: "Every denial triggers a fully written appeal letter citing the specific CARC/RARC code, payer policy, and clinical justification. No templates.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              ),
            },
            {
              title: "837P claim submission",
              body: "Build and submit HIPAA-standard claims directly. Real-time 270/271 eligibility verification before every appointment.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              ),
            },
            {
              title: "Patient billing & AR",
              body: "Automated patient statements, balance tracking, and payment collection. Stop manually chasing co-pays and deductibles.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              ),
            },
            {
              title: "Daily AI briefing",
              body: "Every morning, a prioritized summary of what needs your attention — sorted by dollar impact, not alphabetically.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              ),
            },
            {
              title: "HIPAA-ready infrastructure",
              body: "BAA signed at signup. AES-256 encryption at rest, TLS 1.2+ in transit, immutable audit logs retained 6 years. SOC 2 Type II in progress.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              ),
            },
          ].map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1 text-sm">{f.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Pricing</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You only pay when you get paid</h2>
          <p className="text-gray-500 text-sm mb-10">We charge a percentage of collections. No monthly fee, no per-claim cost, no setup fee.</p>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-sm">
            <div className="text-3xl font-bold text-gray-900 mb-1">% of collections</div>
            <div className="text-sm text-gray-500 mb-6">Contact us for your rate — based on specialty and volume.</div>
            <ul className="space-y-2.5 text-sm text-gray-600 mb-8">
              {["Unlimited claims", "Unlimited appeal letters", "ERA posting included", "Patient billing included", "BAA included", "No long-term contract"].map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Supported specialties</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Family Medicine", "Internal Medicine", "Pediatrics", "OB/GYN",
            "Psychiatry", "Psychology", "Mental Health Counseling", "Social Work",
            "Physical Therapy", "Occupational Therapy", "Speech Therapy", "Chiropractic",
            "Cardiology", "Neurology", "Gastroenterology", "Dermatology",
            "Orthopedics", "Podiatry", "Optometry", "Allergy & Immunology",
            "Endocrinology", "Rheumatology", "Urology",
            "Nurse Practitioners", "Physician Assistants",
          ].map((s) => (
            <span key={s} className="border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-md">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-20 flex items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to start?</h2>
            <p className="text-gray-500 text-sm">Set up your practice in under 10 minutes.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
              Create account
            </Link>
            <a href="mailto:support@claima.io" className="text-sm text-gray-500 hover:text-gray-900 px-5 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              Talk to us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold" style={{fontSize: 9}}>C</div>
            <span>© 2026 Claima, Inc.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
            <Link href="/security" className="hover:text-gray-600">Security</Link>
            <a href="mailto:support@claima.io" className="hover:text-gray-600">support@claima.io</a>
          </div>
        </div>
      </footer>

    </div>
  )
}

function Dashboard() {
  const [userName, setUserName] = useState("")
  const [setup, setSetup] = useState<{ practiceComplete: boolean; hasProviders: boolean; hasPatients: boolean } | null>(null)
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.ok ? r.json() : null),
      fetch("/api/context").then(r => r.ok ? r.json() : null),
      fetch("/api/briefing").then(r => r.ok ? r.json() : null),
    ]).then(([me, ctx, brief]) => {
      if (me?.user?.name) setUserName(me.user.name)
      if (ctx) {
        setSetup({
          practiceComplete: !ctx.practice?.npi?.startsWith("PENDING-"),
          hasProviders: (ctx.providers?.length ?? 0) > 0,
          hasPatients: (ctx.patients?.length ?? 0) > 0,
        })
      }
      if (brief && !brief.error) setBriefing(brief)
    }).finally(() => setLoading(false))
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const firstName = userName.split(" ").find(p => !p.startsWith("Dr")) ?? userName.split(" ")[0] ?? ""
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`
  const setupIncomplete = setup && (!setup.practiceComplete || !setup.hasProviders || !setup.hasPatients)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <NavBar />
      <main className="max-w-3xl mx-auto px-8 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {briefing?.date
                ? new Date(briefing.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                : "Daily billing intelligence"}
            </p>
          </div>
          <Link
            href="/claims/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <span>+</span> New Claim
          </Link>
        </div>

        {setupIncomplete && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
              <span className="text-sm font-semibold text-blue-900">Complete your setup to start submitting claims</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { done: setup!.practiceComplete, label: "Practice details", desc: "NPI, Tax ID, address", href: "/settings" },
                { done: setup!.hasProviders, label: "Add a provider", desc: "Rendering provider NPI", href: "/settings?tab=providers" },
                { done: setup!.hasPatients, label: "Add a patient", desc: "Demographics & insurance", href: "/settings?tab=patients" },
              ].map((step) => (
                <Link
                  key={step.label}
                  href={step.href}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    step.done ? "bg-green-50 border-green-200 pointer-events-none" : "bg-white border-blue-200 hover:border-blue-400 hover:shadow-sm"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    step.done ? "bg-green-500 text-white" : "bg-blue-100 text-blue-600"
                  }`}>{step.done ? "✓" : "→"}</div>
                  <div>
                    <div className={`text-sm font-medium ${step.done ? "text-green-800 line-through" : "text-blue-900"}`}>{step.label}</div>
                    <div className="text-xs text-blue-600 opacity-70 mt-0.5">{step.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating briefing…
          </div>
        )}

        {briefing && (
          <div className="space-y-6">
            <div className={`rounded-xl border p-5 shadow-sm ${
              briefing.timelyRisks > 0 || briefing.newDenials > 2
                ? "bg-amber-50 border-amber-200"
                : briefing.paidYesterday > 0
                ? "bg-green-50 border-green-200"
                : "bg-white border-gray-200"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Briefing</span>
              </div>
              <div className={`text-base font-bold mb-2 ${
                briefing.timelyRisks > 0 || briefing.newDenials > 2 ? "text-amber-900" :
                briefing.paidYesterday > 0 ? "text-green-900" : "text-gray-900"
              }`}>{briefing.headline}</div>
              {briefing.narrative && (
                <p className={`text-sm leading-relaxed ${
                  briefing.timelyRisks > 0 || briefing.newDenials > 2 ? "text-amber-700" :
                  briefing.paidYesterday > 0 ? "text-green-700" : "text-gray-600"
                }`}>{briefing.narrative}</p>
              )}
            </div>

            {briefing.priorities.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priorities</h2>
                {briefing.priorities.map((p, i) => {
                  const cfg = URGENCY_CONFIG[p.urgency] ?? URGENCY_CONFIG.today
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>{cfg.label}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-sm ${cfg.text}`}>{p.action}</div>
                          <div className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>{p.reason}</div>
                        </div>
                        {p.dollars > 0 && (
                          <div className={`text-sm font-mono font-bold shrink-0 ${cfg.text}`}>{fmt(p.dollars)}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">At a Glance</h2>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Payments In", value: fmt(briefing.totalPaidAmount), sub: `${briefing.paidYesterday} claims`, accent: "bg-green-500", color: "text-green-700" },
                  { label: "New Denials", value: String(briefing.newDenials), sub: fmt(briefing.newDenialsAmount), accent: briefing.newDenials > 0 ? "bg-red-500" : "bg-gray-300", color: briefing.newDenials > 0 ? "text-red-700" : "text-gray-600" },
                  { label: "Timely Risk", value: String(briefing.timelyRisks), sub: fmt(briefing.timelyRisksAmount), accent: briefing.timelyRisks > 0 ? "bg-red-500" : "bg-gray-300", color: briefing.timelyRisks > 0 ? "text-red-700" : "text-gray-600" },
                  { label: "Overdue AR", value: fmt(briefing.overdueAmount), sub: `${briefing.overdueStatements} stmts`, accent: "bg-amber-500", color: "text-amber-700" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden shadow-sm">
                    <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} />
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">{stat.label}</div>
                    <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
              {briefing.appealsNeeding > 0 && (
                <Link href="/denials" className="text-xs bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all">
                  {briefing.appealsNeeding} appeal{briefing.appealsNeeding > 1 ? "s" : ""} need action →
                </Link>
              )}
              {briefing.agingClaims > 0 && (
                <Link href="/claims" className="text-xs bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all">
                  {briefing.agingClaims} aging claim{briefing.agingClaims > 1 ? "s" : ""} →
                </Link>
              )}
              {briefing.overdueStatements > 0 && (
                <Link href="/billing" className="text-xs bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all">
                  {briefing.overdueStatements} overdue balance{briefing.overdueStatements > 1 ? "s" : ""} →
                </Link>
              )}
              <Link href="/agent" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all">
                Run autonomous sweep →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => setAuthed(r.ok)).catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  return authed ? <Dashboard /> : <MarketingPage />
}
