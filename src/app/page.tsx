import Link from "next/link"
import { getSession } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import NavBar from "@/components/NavBar"

interface KPI {
  label: string
  value: string
  sub: string
  valueColor: string
  accentColor: string
}

async function getDashboardKPIs(practiceId: string): Promise<KPI[]> {
  if (!process.env.DATABASE_URL) {
    return [
      { label: "Claims Submitted", value: "—", sub: "this month", valueColor: "text-white", accentColor: "bg-blue-500" },
      { label: "Revenue Collected", value: "—", sub: "patient payments", valueColor: "text-green-400", accentColor: "bg-green-500" },
      { label: "Outstanding", value: "—", sub: "balance due", valueColor: "text-yellow-400", accentColor: "bg-yellow-500" },
      { label: "Denial Rate", value: "—", sub: "no DB", valueColor: "text-red-400", accentColor: "bg-red-500" },
    ]
  }

  const { prisma } = await import("@/lib/prisma")

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [claimsThisMonth, statements, denials] = await Promise.all([
    prisma.claim.count({
      where: { practiceId, submittedAt: { gte: startOfMonth } },
    }),
    prisma.patientStatement.findMany({
      where: { patient: { practiceId } },
      select: { balanceDue: true, patientPaid: true, statementStatus: true },
    }),
    prisma.denial.findMany({
      where: { claim: { practiceId } },
      select: { appealStatus: true },
    }),
  ])

  const totalOutstanding = statements
    .filter((s) => !["PAID", "WRITE_OFF"].includes(s.statementStatus))
    .reduce((sum, s) => sum + Number(s.balanceDue), 0)

  const totalCollected = statements.reduce((sum, s) => sum + Number(s.patientPaid), 0)

  const openDenials = denials.filter((d) => ["PENDING", "IN_PROGRESS"].includes(d.appealStatus)).length
  const denialRate = denials.length > 0
    ? Math.round((openDenials / denials.length) * 100)
    : 0

  return [
    { label: "Claims Submitted", value: String(claimsThisMonth), sub: "this month", valueColor: "text-white", accentColor: "bg-blue-500" },
    { label: "Revenue Collected", value: `$${totalCollected.toFixed(0)}`, sub: "patient payments", valueColor: "text-green-400", accentColor: "bg-green-500" },
    { label: "Outstanding", value: `$${totalOutstanding.toFixed(0)}`, sub: "balance due", valueColor: "text-yellow-400", accentColor: "bg-amber-500" },
    { label: "Denial Rate", value: `${denialRate}%`, sub: `${openDenials} open denials`, valueColor: "text-red-400", accentColor: "bg-red-500" },
  ]
}

export default async function Home() {
  const cookieStore = await cookies()
  void cookieStore

  const session = await getSession()
  if (!session) redirect("/login")

  const kpis = await getDashboardKPIs(session.practiceId)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const firstName = session.name.split(" ").find((p) => !p.startsWith("Dr")) ?? session.name.split(" ")[0]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Practice revenue snapshot · {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {kpis.map((k) => (
            <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 relative overflow-hidden group hover:border-gray-700 transition-colors">
              <div className={`absolute inset-x-0 top-0 h-0.5 ${k.accentColor}`} />
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">{k.label}</div>
              <div className={`text-3xl font-bold font-mono ${k.valueColor}`}>{k.value}</div>
              <div className="text-xs text-gray-600 mt-1.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Workflow grid */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-gray-600 uppercase tracking-widest font-medium">Workflows</span>
          <div className="flex-1 h-px bg-gray-800/60" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Submit Claim — full-width primary CTA */}
          <Link
            href="/claims/new"
            className="col-span-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border border-blue-500/50 rounded-xl p-6 flex items-center justify-between transition-all group shadow-lg shadow-blue-900/20"
          >
            <div>
              <div className="font-semibold text-lg tracking-tight">Submit a Claim</div>
              <div className="text-blue-200/80 text-sm mt-0.5">837P EDI → clearinghouse → paid. Start here after every session.</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-blue-100 group-hover:bg-white/15 group-hover:translate-x-0.5 transition-all">
              →
            </div>
          </Link>

          {/* Claims */}
          <Link href="/claims" className="bg-gray-900 border border-gray-800 hover:border-blue-500/40 hover:bg-gray-900/80 rounded-xl p-5 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="font-semibold text-sm tracking-tight">Track Submissions</div>
            <div className="text-gray-500 text-xs mt-1 leading-relaxed">Status, ERA payments, payer responses</div>
            <div className="text-blue-400/70 text-xs mt-3 font-mono">{kpis[0].value} claims · all payers</div>
          </Link>

          {/* Denials */}
          <Link href="/denials" className="bg-gray-900 border border-gray-800 hover:border-red-500/40 hover:bg-gray-900/80 rounded-xl p-5 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="font-semibold text-sm tracking-tight">Appeal Denials</div>
            <div className="text-gray-500 text-xs mt-1 leading-relaxed">AI letters, CARC triage, appeal tracking</div>
            <div className="text-red-400/70 text-xs mt-3 font-mono">{kpis[3].sub}</div>
          </Link>

          {/* Eligibility */}
          <Link href="/eligibility" className="bg-gray-900 border border-gray-800 hover:border-green-500/40 hover:bg-gray-900/80 rounded-xl p-5 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="font-semibold text-sm tracking-tight">Verify Benefits</div>
            <div className="text-gray-500 text-xs mt-1 leading-relaxed">270/271 real-time, deductible & copay</div>
            <div className="text-green-400/70 text-xs mt-3 font-mono">3,400+ payers live</div>
          </Link>

          {/* Patient Billing */}
          <Link href="/billing" className="bg-gray-900 border border-gray-800 hover:border-amber-500/40 hover:bg-gray-900/80 rounded-xl p-5 col-span-3 flex items-center justify-between transition-all">
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="font-semibold text-sm tracking-tight">Collect Patient Balances</div>
              <div className="text-gray-500 text-xs mt-1">Statements, copays & partial payments after ERA posting</div>
            </div>
            <div className="text-right pr-2">
              <div className="text-amber-400 text-2xl font-bold font-mono">{kpis[2].value}</div>
              <div className="text-gray-600 text-xs mt-0.5">outstanding</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-900">
          <p className="text-gray-700 text-xs tracking-wide">
            MediBill · HIPAA-compliant · Stedi clearinghouse · Anthropic AI
          </p>
          <Link href="/onboarding" className="text-xs text-blue-500/70 hover:text-blue-400 transition-colors">
            Connect Stripe payments →
          </Link>
        </div>
      </main>
    </div>
  )
}
