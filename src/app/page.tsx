"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import NavBar from "@/components/NavBar"
import { LogoMark } from "@/components/Logo"
import HeroDashboardMockup from "@/components/HeroDashboardMockup"
import SweepMockup from "@/components/SweepMockup"
import AppealMockup from "@/components/AppealMockup"

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
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-semibold text-sm tracking-tight">Claima</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/security" className="text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50">Security</Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50">Sign in</Link>
            <Link href="/signup" className="ml-2 text-sm font-medium bg-gray-900 hover:bg-gray-700 text-white px-3.5 py-1.5 rounded-md transition-colors">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-0">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* Left */}
          <div className="pb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 text-xs font-medium text-blue-700 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Works across every outpatient specialty
            </div>
            <h1 className="text-[2.6rem] font-bold tracking-tight leading-[1.1] text-gray-900 mb-5">
              Medical billing that doesn&apos;t require a billing department
            </h1>
            <p className="text-[1.05rem] text-gray-500 leading-relaxed mb-8">
              Claima handles the full revenue cycle for outpatient practices — claim submission, denial appeals, ERA posting, and patient statements.
            </p>
            <div className="flex items-center gap-3 mb-8">
              <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
                Start for free
              </Link>
              <a href="mailto:support@claima.io" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Talk to us →
              </a>
            </div>
            <div className="flex items-center gap-5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                HIPAA compliant
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                BAA included
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                No setup fee
              </span>
            </div>
          </div>

          {/* Right: product mockup */}
          <div className="relative hidden lg:block pb-0 translate-y-6">
            <HeroDashboardMockup />
            <div className="absolute -inset-6 bg-blue-100 rounded-3xl -z-10 blur-2xl opacity-40" />
          </div>

        </div>
      </section>

      {/* Payer marquee */}
      {(() => {
        const PAYERS = [
          { name: "Aetna", domain: "aetna.com" },
          { name: "UnitedHealthcare", domain: "uhc.com" },
          { name: "Cigna", domain: "cigna.com" },
          { name: "Humana", domain: "humana.com" },
          { name: "Blue Cross Blue Shield", domain: "bcbs.com" },
          { name: "Anthem", domain: "anthem.com" },
          { name: "Molina Healthcare", domain: "molinahealthcare.com" },
          { name: "Kaiser Permanente", domain: "kp.org" },
          { name: "Centene", domain: "centene.com" },
          { name: "Oscar Health", domain: "hioscar.com" },
          { name: "Highmark", domain: "highmark.com" },
          { name: "Optum", domain: "optum.com" },
          { name: "Ambetter", domain: "ambetterhealth.com" },
          { name: "Tricare", domain: "tricare.mil" },
          { name: "Tufts Health", domain: "tuftshealthplan.com" },
          { name: "Harvard Pilgrim", domain: "harvardpilgrim.org" },
        ]
        const doubled = [...PAYERS, ...PAYERS]
        return (
          <section className="border-t border-gray-100 bg-white py-8 overflow-hidden">
            <p className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em] mb-6">
              Submits to every major payer
            </p>
            <div className="relative">
              <div className="flex animate-marquee items-center">
                {doubled.map((payer, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-8 shrink-0 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://logo.clearbit.com/${payer.domain}`}
                      alt={payer.name}
                      className="h-5 w-5 object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:scale-125 transition-all duration-200 rounded shrink-0 cursor-pointer"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.src = `https://www.google.com/s2/favicons?domain=${payer.domain}&sz=64`
                        el.onerror = () => { el.style.display = "none" }
                      }}
                    />
                    <span className="text-sm font-medium text-gray-400 group-hover:text-gray-700 whitespace-nowrap transition-colors duration-200">{payer.name}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            </div>
          </section>
        )
      })()}

      {/* Problem statement */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-3 gap-10">
            {[
              { stat: "30%", label: "of claims are denied on first submission industry-wide", sub: "Most are recoverable — but only if you catch them." },
              { stat: "8–12hrs", label: "per week spent by average practice on billing admin", sub: "Time that could be spent on patient care." },
              { stat: "5–7%", label: "of collections lost to billing firms that take a flat cut", sub: "Claima charges less, and only when you get paid." },
            ].map((s) => (
              <div key={s.stat} className="border-l-2 border-gray-200 pl-5">
                <div className="text-2xl font-bold text-gray-900 mb-1">{s.stat}</div>
                <div className="text-sm font-medium text-gray-700 mb-1">{s.label}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-10">How it works</p>
        <div className="grid grid-cols-4 gap-6">
          {[
            { n: "1", title: "Patient visits", body: "Eligibility verified before the appointment. Coverage gaps flagged before the claim is even written." },
            { n: "2", title: "Claim submitted", body: "837P claim built from visit data and routed to the payer through a HIPAA-certified clearinghouse." },
            { n: "3", title: "Denial — handled", body: "Claima reads the CARC code, cites the payer policy, and writes the appeal letter. One click to send." },
            { n: "4", title: "Payment posted", body: "ERA auto-posted. Patient balance calculated. Statement sent. Aging AR tracked in one view." },
          ].map((s) => (
            <div key={s.n}>
              <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center mb-4">{s.n}</div>
              <div className="text-sm font-semibold text-gray-900 mb-2">{s.title}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature detail */}
      <section className="border-t border-gray-100">

        {/* Feature 1: Agent */}
        <div className="border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-14 flex gap-16 items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em]">Autonomous agent</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">One click. Every billing task done.</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-md">The Claima agent sweeps your practice daily: posts ERA payments at contracted rates, drafts appeal letters for every new denial, flags claims approaching the timely filing window, and surfaces aging AR sorted by dollar value. What used to take a billing coordinator half a day takes 30 seconds.</p>
            </div>
            <div className="w-80 shrink-0 hidden lg:block">
              <SweepMockup />
            </div>
          </div>
        </div>

        {/* Feature 2: Denial management */}
        <div className="border-b border-gray-100 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 py-14 flex gap-16 items-center flex-row-reverse">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em]">Denial management</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">Every denial gets a real appeal, not a template</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-md">When a payer returns CARC 197 (missing auth) or CARC 50 (not medically necessary), Claima doesn&apos;t send a form letter. It writes a specific appeal citing the denial code, the relevant payer policy, and the clinical documentation on file. Practices using Claima appeal more claims — and win more of them.</p>
            </div>
            <div className="w-80 shrink-0 hidden lg:block">
              <AppealMockup />
            </div>
          </div>
        </div>

        {/* Feature 3: Daily briefing */}
        <div className="border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-14 flex gap-16 items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em]">Daily briefing</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">Start every morning knowing exactly what to do</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-md">Claima&apos;s AI briefing summarizes overnight ERA activity, new denials, timely filing risks, and patient AR — ranked by dollar impact. Not a dashboard you have to interpret. A briefing you can act on.</p>
            </div>
            <div className="w-80 shrink-0 hidden lg:block">
              <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <LogoMark size={16} />
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">AI Briefing · Mon, Jun 9</span>
                </div>
                <div className="text-sm font-bold text-amber-900 mb-2">3 denials need appeals — $4,200 at risk</div>
                <div className="text-[11px] text-amber-700 leading-relaxed mb-3">ERA from Cigna posted overnight — $8,400 applied. Two CARC 197 denials on #2841 and #2844. Both have winning appeal paths.</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Payments In", val: "$12.4k", color: "text-green-700" },
                    { label: "New Denials", val: "3", color: "text-red-700" },
                    { label: "Timely Risk", val: "1", color: "text-amber-700" },
                    { label: "Overdue AR", val: "$8.1k", color: "text-amber-700" },
                  ].map((m) => (
                    <div key={m.label} className="bg-white/70 rounded-lg p-2">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wide">{m.label}</div>
                      <div className={`text-sm font-bold font-mono ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-8">Pricing</p>
        <div className="flex gap-12 items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Pay a percentage of what you collect. Nothing else.</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-md">
              No monthly subscriptions. No per-claim fees. No setup costs. We make money when you make money, which means our incentives are exactly aligned with yours.
            </p>
            <a href="mailto:support@claima.io" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Contact us for your rate →
            </a>
          </div>
          <div className="w-72 shrink-0 bg-gray-50 border border-gray-200 rounded-xl p-6">
            <ul className="space-y-3">
              {[
                "Unlimited claims",
                "Unlimited appeal letters",
                "ERA posting",
                "Patient billing & statements",
                "Eligibility verification",
                "HIPAA BAA",
                "No contracts",
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-5 border-t border-gray-200">
              <Link href="/signup" className="block text-center text-sm font-medium bg-gray-900 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-6">Works for every outpatient specialty</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Family Medicine", "Internal Medicine", "Pediatrics", "OB/GYN",
              "Psychiatry", "Psychology", "Mental Health Counseling", "Social Work",
              "Physical Therapy", "Occupational Therapy", "Speech Therapy", "Chiropractic",
              "Cardiology", "Neurology", "Gastroenterology", "Dermatology",
              "Orthopedic Surgery", "Podiatry", "Optometry", "Allergy & Immunology",
              "Endocrinology", "Rheumatology", "Urology", "Nurse Practitioners", "Physician Assistants",
            ].map((s) => (
              <span key={s} className="bg-white border border-gray-200 text-gray-600 text-xs px-2.5 py-1 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Security strip */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap gap-8">
          {[
            { title: "HIPAA-ready", body: "BAA executed at signup. PHI encrypted in transit and at rest." },
            { title: "AES-256 encryption", body: "All data encrypted at the storage layer on AWS infrastructure." },
            { title: "Audit logs", body: "Every PHI access logged and retained for 6 years per HIPAA." },
            { title: "SOC 2 Type II", body: "Audit period begins Q3 2026. Report available to enterprise customers." },
          ].map((s) => (
            <div key={s.title} className="flex-1 min-w-[180px]">
              <div className="text-sm font-semibold text-gray-900 mb-1">{s.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Dark footer CTA */}
      <section className="bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 flex items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Get started in 10 minutes</h2>
            <p className="text-gray-400 text-sm">Create an account, add your practice details, and submit your first claim today.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/signup" className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
              Create account
            </Link>
            <a href="mailto:support@claima.io" className="text-gray-400 hover:text-white text-sm transition-colors">
              Talk to sales →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <LogoMark size={20} />
            <span>© 2026 Claima, Inc.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-gray-300 transition-colors">Security</Link>
            <a href="mailto:support@claima.io" className="hover:text-gray-300 transition-colors">support@claima.io</a>
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
