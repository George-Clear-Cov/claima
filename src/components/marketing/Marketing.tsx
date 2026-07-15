import Link from "next/link"
import { LogoMark } from "@/components/Logo"
import HeroDashboardMockup from "@/components/HeroDashboardMockup"
import SweepMockup from "@/components/SweepMockup"
import AppealMockup from "@/components/AppealMockup"

// Server component. The marketing copy is fully server-rendered (crawlable,
// shareable, no blank first paint) — the interactive product mockups are the
// only client components on the page. Previously this whole page was a
// "use client" tree gated behind a client-side auth fetch that returned null
// until it resolved, so crawlers and social unfurlers saw an empty document.

const PAYERS = [
  { name: "Aetna",                 logo: "aetna.svg"   },
  { name: "UnitedHealthcare",      logo: "uhc.svg"     },
  { name: "Cigna",                 logo: "cigna.svg",   h: "h-10" },
  { name: "Humana",                logo: "humana.svg"  },
  { name: "Blue Cross Blue Shield", logo: "bcbs.svg",   h: "h-10" },
  { name: "Anthem",                logo: "anthem.png"  },
  { name: "Molina Healthcare",     logo: "molina.png"  },
  { name: "Kaiser Permanente",     logo: "kaiser.svg"  },
  { name: "Centene",               logo: "centene.png" },
  { name: "Oscar Health",          logo: "oscar.png"   },
  { name: "Highmark",              logo: "highmark.png" },
  { name: "Optum",                 logo: "optum.svg"   },
  { name: "Tricare",               logo: "tricare.png" },
  { name: "Tufts Health",          logo: "tufts.png"   },
]

function PayerList() {
  return (
    <div className="flex shrink-0 items-center py-2" aria-hidden="true">
      {PAYERS.map((payer, i) => (
        <div key={i} className="flex items-center gap-3 px-8 shrink-0 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/logos/${payer.logo}`}
            alt={payer.name}
            loading="lazy"
            className={`${payer.h ?? "h-6"} w-auto max-w-[110px] object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-200`}
          />
        </div>
      ))}
    </div>
  )
}

export default function Marketing() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-semibold text-sm tracking-tight">Claima</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/security" className="hidden sm:inline-block text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50">Security</Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50">Sign in</Link>
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
            <p className="text-[1.05rem] text-gray-600 leading-relaxed mb-8">
              Claima handles the full revenue cycle for outpatient practices — claim submission, denial appeals, ERA posting, and patient statements.
            </p>
            <div className="flex items-center gap-3 mb-8">
              <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
                Start for free
              </Link>
              <a href="mailto:support@claima.io" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Talk to us →
              </a>
            </div>
            <div className="flex items-center gap-5 text-xs text-gray-500">
              {["HIPAA compliant", "BAA included", "No setup fee"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: product mockup */}
          <div className="relative hidden lg:block pb-0 translate-y-6">
            <div className="relative">
              <HeroDashboardMockup />
              <div className="absolute -inset-6 bg-blue-100 rounded-3xl -z-10 blur-2xl opacity-40" />
            </div>
          </div>

        </div>
      </section>

      {/* Payer marquee */}
      <section className="border-t border-gray-100 bg-white py-8 overflow-hidden">
        <p className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-[0.12em] mb-6">
          Submits to every major payer
        </p>
        <div className="relative overflow-visible">
          <div className="animate-marquee">
            <PayerList />
            <PayerList />
          </div>
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Problem statement */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { stat: "30%", label: "of claims are denied on first submission industry-wide", sub: "Most are recoverable — but only if you catch them." },
              { stat: "8–12hrs", label: "per week spent by average practice on billing admin", sub: "Time that could be spent on patient care." },
              { stat: "5–7%", label: "of collections lost to billing firms that take a flat cut", sub: "Claima charges less, and only when you get paid." },
            ].map((s) => (
              <div key={s.stat} className="border-l-2 border-gray-200 pl-5">
                <div className="text-2xl font-bold text-gray-900 mb-1">{s.stat}</div>
                <div className="text-sm font-medium text-gray-700 mb-1">{s.label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-10">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { n: "1", title: "Patient visits", body: "Eligibility verified before the appointment. Coverage gaps flagged before the claim is even written." },
            { n: "2", title: "Claim submitted", body: "837P claim built from visit data and routed to the payer through a HIPAA-certified clearinghouse." },
            { n: "3", title: "Denial — handled", body: "Claima reads the CARC code, cites the payer policy, and writes the appeal letter. One click to send." },
            { n: "4", title: "Payment posted", body: "ERA auto-posted. Patient balance calculated. Statement sent. Aging AR tracked in one view." },
          ].map((s) => (
            <div key={s.n}>
              <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center mb-4">{s.n}</div>
              <div className="text-sm font-semibold text-gray-900 mb-2">{s.title}</div>
              <div className="text-sm text-gray-600 leading-relaxed">{s.body}</div>
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
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em]">Autonomous agent</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">One click. Every billing task done.</h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-md">The Claima agent sweeps your practice daily: posts ERA payments at contracted rates, drafts appeal letters for every new denial, flags claims approaching the timely filing window, and surfaces aging AR sorted by dollar value. What used to take a billing coordinator half a day takes 30 seconds.</p>
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
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em]">Denial management</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">Every denial gets a real appeal, not a template</h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-md">When a payer returns CARC 197 (missing auth) or CARC 50 (not medically necessary), Claima doesn&apos;t send a form letter. It writes a specific appeal citing the denial code, the relevant payer policy, and the clinical documentation on file. Practices using Claima appeal more claims — and win more of them.</p>
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
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em]">Daily briefing</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">Start every morning knowing exactly what to do</h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-md">Claima&apos;s AI briefing summarizes overnight ERA activity, new denials, timely filing risks, and patient AR — ranked by dollar impact. Not a dashboard you have to interpret. A briefing you can act on.</p>
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
                      <div className="text-[9px] text-gray-500 uppercase tracking-wide">{m.label}</div>
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
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-8">Pricing</p>
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Pay a percentage of what you collect. Nothing else.</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-md">
              No monthly subscriptions. No per-claim fees. No setup costs. We make money when you make money, which means our incentives are exactly aligned with yours.
            </p>
            <a href="mailto:support@claima.io" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Contact us for your rate →
            </a>
          </div>
          <div className="w-full sm:w-72 shrink-0 bg-gray-50 border border-gray-200 rounded-xl p-6">
            <ul className="space-y-3">
              {[
                "Unlimited claims",
                "Unlimited appeal letters",
                "ERA posting",
                "Patient billing & statements",
                "Eligibility verification",
                "HIPAA BAA",
                "No contracts",
              ].map((item) => (
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
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-6">Works for every outpatient specialty</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Family Medicine", "Internal Medicine", "Pediatrics", "OB/GYN",
              "Psychiatry", "Psychology", "Mental Health Counseling", "Social Work",
              "Physical Therapy", "Occupational Therapy", "Speech Therapy", "Chiropractic",
              "Cardiology", "Neurology", "Gastroenterology", "Dermatology",
              "Orthopedic Surgery", "Podiatry", "Optometry", "Allergy & Immunology",
              "Endocrinology", "Rheumatology", "Urology", "Nurse Practitioners", "Physician Assistants",
            ].map((s) => (
              <span key={s} className="bg-white border border-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded">
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
              <div className="text-xs text-gray-600 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Dark footer CTA */}
      <section className="bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Get started in 10 minutes</h2>
            <p className="text-gray-400 text-sm">Create an account, add your practice details, and submit your first claim today.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/signup" className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
              Create account
            </Link>
            <a href="mailto:support@claima.io" className="text-gray-300 hover:text-white text-sm transition-colors">
              Talk to sales →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <LogoMark size={20} />
            <span>© 2026 Claima, Inc.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-gray-200 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-200 transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-gray-200 transition-colors">Security</Link>
            <a href="mailto:support@claima.io" className="hover:text-gray-200 transition-colors">support@claima.io</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
