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
      {/* Header */}
      <header className="border-b border-gray-100 px-8 h-14 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">C</div>
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/security" className="text-sm text-gray-500 hover:text-gray-700">Security</Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">Sign in</Link>
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium text-blue-700 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          AI-native medical billing
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-5 leading-tight">
          Stop leaving money<br />on the table
        </h1>
        <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
          Claima handles claim submission, denial management, and patient billing automatically — so you can focus on patients, not paperwork.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm">
            Start free →
          </Link>
          <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium px-6 py-3 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No setup fee · HIPAA compliant · BAA included</p>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-100 bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-8 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "< 24h", label: "Average claim submission time" },
            { value: "94%", label: "First-pass claim acceptance rate" },
            { value: "% of collections", label: "You only pay when you get paid" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-gray-900 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-8 py-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Everything billing, automated</h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            {
              icon: "⚡",
              title: "Autonomous billing agent",
              desc: "One click posts ERAs, drafts appeal letters, flags timely filing risks, and identifies aging claims across your entire practice.",
            },
            {
              icon: "✉",
              title: "AI appeal letters",
              desc: "Every denied claim gets an AI-generated appeal letter in seconds, citing the exact CARC code and payer policy.",
            },
            {
              icon: "📋",
              title: "Claim submission",
              desc: "Submit 837P claims directly to payers. Real-time eligibility verification before every appointment.",
            },
            {
              icon: "💳",
              title: "Patient billing",
              desc: "Automated statements, online payments, and AR tracking. Stop chasing patients for balances.",
            },
            {
              icon: "📊",
              title: "Daily AI briefing",
              desc: "Start every morning with an AI-generated summary of what needs attention — prioritized by dollar impact.",
            },
            {
              icon: "🔒",
              title: "HIPAA compliant",
              desc: "BAA included with every account. AES-256 encryption, audit logging, and SOC 2 Type II in progress.",
            },
          ].map((f) => (
            <div key={f.title} className="p-5 border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-semibold text-gray-900 mb-1.5">{f.title}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Specialties */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Built for every outpatient specialty</h2>
          <p className="text-gray-500 text-sm mb-8">If you bill insurance, Claima works for you.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Family Medicine", "Internal Medicine", "Pediatrics", "OB/GYN",
              "Psychiatry", "Psychology", "Mental Health Counseling",
              "Physical Therapy", "Occupational Therapy", "Speech Therapy", "Chiropractic",
              "Cardiology", "Neurology", "Gastroenterology", "Dermatology",
              "Orthopedics", "Podiatry", "Optometry", "Nurse Practitioners", "Physician Assistants",
            ].map((s) => (
              <span key={s} className="bg-white border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to collect more?</h2>
        <p className="text-gray-500 mb-8">Set up your practice in minutes. No contract, no setup fee.</p>
        <Link href="/signup" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-sm text-lg">
          Create free account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-4 mb-3">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <Link href="/security" className="hover:text-gray-600">Security</Link>
          <a href="mailto:support@claima.io" className="hover:text-gray-600">support@claima.io</a>
        </div>
        <p>© 2026 Claima, Inc. All rights reserved.</p>
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
