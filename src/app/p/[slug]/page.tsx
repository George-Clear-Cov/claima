import Link from "next/link"
import { notFound } from "next/navigation"
import { LogoMark } from "@/components/Logo"
import practices from "@/data/practices.json"
import type { PracticeRecord } from "@/lib/practices"

/**
 * One indexable page per practice, built from data CMS already publishes about them.
 *
 * The play, borrowed from SmarterDx's ~178 per-hospital pages: a free public denominator plus
 * arithmetic the reader can redo, published at a URL they can find by searching their own name.
 * It turns a cold email into a link the recipient can verify without replying to anyone. Nobody
 * else in this category does it: a sweep of 999 URLs across Candid, Adonis, Athelas and Commure
 * found zero per-prospect pages.
 *
 * EVERY NUMBER HERE IS PUBLIC AND CHECKABLE.
 * Source is the CMS Medicare Physician & Other Practitioners PUF, by Provider and Service. No
 * modelled recovery figures appear anywhere on this page, deliberately: the modelled aged-A/R
 * estimates in our own target list understated by 5.6x and were pulled from outreach in
 * September. The page asserts what CMS published and then asks a question. It does not estimate.
 *
 * The Medicare allowed amounts come straight from the PUF, which means they are already
 * locality-adjusted by CMS for this specific provider. No locality inference happens here.
 */

const ALL = practices as unknown as PracticeRecord[]

export const dynamicParams = false

export function generateStaticParams() {
  return ALL.map((p) => ({ slug: p.slug }))
}

function find(slug: string): PracticeRecord | undefined {
  return ALL.find((p) => p.slug === slug)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = find(slug)
  if (!p) return { title: "Practice not found · Claima" }
  return {
    title: `${p.name}${p.credentials ? `, ${p.credentials}` : ""} · Medicare billing profile · Claima`,
    description:
      `Public CMS data for ${p.name} in ${p.city}, ${p.state}: ${money(p.totalAllowed)} in Medicare ` +
      `allowed charges across ${p.totalServices.toLocaleString()} services. See which codes carry ` +
      `the revenue and what commercial payers should be paying against them.`,
    alternates: { canonical: `https://claima.io/p/${p.slug}` },
  }
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function money2(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
}

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = find(slug)
  if (!p) notFound()

  const top = p.codes.slice(0, 8)
  const officeShare =
    p.codes.filter((c) => c.pos === "O").reduce((s, c) => s + c.allowedTotal, 0) /
    Math.max(p.totalAllowed, 1)
  const drugs = p.codes.filter((c) => c.isDrug)
  const drugShare = drugs.reduce((s, c) => s + c.allowedTotal, 0) / Math.max(p.totalAllowed, 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <div className="flex gap-4 text-xs text-gray-500">
          <Link href="/leak-report" className="hover:text-gray-700">Leak Report</Link>
          <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600 mb-2">
          Public Medicare billing profile
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
          {p.name}
          {p.credentials ? <span className="text-gray-400 font-semibold">, {p.credentials}</span> : null}
        </h1>
        <p className="text-gray-600 mb-8">
          {p.specialty} · {p.city}, {p.state} · NPI {p.npi}
        </p>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Medicare allowed
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{money(p.totalAllowed)}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Services
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {p.totalServices.toLocaleString()}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Top 5 codes are
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {Math.round(p.concentration * 100)}%
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">
            {Math.round(p.concentration * 100)}% of your Medicare revenue sits in five codes
          </h2>
          <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
            That concentration is the useful part. It means a few percent of variance on a handful
            of codes moves real money, and it means checking whether you are being paid correctly is
            a small job rather than an audit of everything you bill.
          </p>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Code</th>
                  <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Service</th>
                  <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide text-right">Volume</th>
                  <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide text-right">You charge</th>
                  <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide text-right">Medicare allows</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c) => (
                  <tr key={`${c.code}-${c.pos}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-4 font-mono text-gray-900 whitespace-nowrap">
                      {c.code}
                      {c.pos === "F" ? (
                        <span className="ml-1.5 text-[10px] text-gray-400 font-sans">facility</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-xs">{c.desc}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-gray-600">
                      {c.services.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-gray-500">
                      {money2(c.charge)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-900">
                      {money2(c.allowed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Ranked by total Medicare allowed. Allowed amounts are already adjusted by CMS for your
            locality.
          </p>
        </section>

        {/* The question the page exists to ask. It is a question, not an estimate. */}
        <section className="rounded-xl border border-blue-100 bg-blue-50 px-7 py-7 mb-8">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">
            Here is what this does not tell you
          </h2>
          <p className="text-[15px] text-gray-800 leading-relaxed mb-3">
            CMS publishes what Medicare allowed you. It publishes nothing about what Aetna, Cigna,
            United or your Blues plan allowed for the same codes. Commercial contracts are
            conventionally written as a percentage of Medicare and normally sit above it, so the
            numbers in that table are a floor your commercial payers should clear.
          </p>
          <p className="text-[15px] text-gray-800 leading-relaxed mb-5">
            Most practices have never checked. A claim paid at 70% of the allowable does not show up
            as a denial or land in anyone&apos;s work queue. It shows up as <em>paid</em>.
          </p>
          <Link
            href="/leak-report"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            Check your own remittance file
          </Link>
          <p className="text-[12.5px] text-gray-600 mt-3">
            Free, no signup, and the file never leaves your browser. Open your network tab before
            you drop it and you will see no request.
          </p>
        </section>

        {(drugShare > 0.15 || officeShare < 0.6) && (
          <section className="rounded-xl border border-gray-200 bg-white px-7 py-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Two things specific to your mix</h2>
            <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
              {drugShare > 0.15 && (
                <li>
                  <strong>{Math.round(drugShare * 100)}% of your Medicare allowed is drug codes.</strong>{" "}
                  Buy-and-bill reimbursement moves with the ASP file, which CMS republishes every
                  quarter. A payer still paying last quarter&apos;s rate is a four-figure variance per
                  administration, and it never appears as a denial.
                </li>
              )}
              {officeShare < 0.6 && (
                <li>
                  <strong>
                    {Math.round((1 - officeShare) * 100)}% of your allowed dollars are billed at a
                    facility place of service.
                  </strong>{" "}
                  Facility rates are materially lower than office rates for the same work, because
                  the practice expense sits with the facility. Worth confirming the split is
                  intentional on every code.
                </li>
              )}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-gray-50 px-7 py-6 text-sm text-gray-600 leading-relaxed">
          <h2 className="font-semibold text-gray-900 mb-2">Where these numbers come from</h2>
          <p className="mb-2">
            Medicare Physician &amp; Other Practitioners, by Provider and Service, published by the
            Centers for Medicare &amp; Medicaid Services. It is public data covering Part B
            fee-for-service claims. Service descriptions are CMS&apos;s own.
          </p>
          <p className="mb-2">
            Nothing here is modelled and nothing is an estimate of what you could recover. The
            totals are sums of what CMS published for NPI {p.npi}. Beneficiary counts overlap
            across codes, so we do not add them up.
          </p>
          <p>
            If something is wrong or you would rather this page not exist,{" "}
            <Link href="/support" className="text-blue-600 underline hover:text-blue-700">
              tell us
            </Link>{" "}
            and we will correct or remove it.
          </p>
        </section>
      </main>
    </div>
  )
}
