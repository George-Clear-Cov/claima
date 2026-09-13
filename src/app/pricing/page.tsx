import Link from "next/link"
import { LogoMark } from "@/components/Logo"

/**
 * Pricing.
 *
 * WHY THIS PAGE EXISTS AT ALL
 * A sitemap sweep of the four category leaders in September 2026 found no pricing page on
 * candidhealth.com, adonis.io, athelas.com or commure.com. The only published price anywhere in
 * the competitive set is a scribe product. Meanwhile three fabricated Adonis prices circulate in
 * search snippets, which is proof that buyers look for this and find nothing. Publishing a number
 * makes us the only findable answer to "what does this cost," and it disqualifies the wrong
 * prospects for free, which matters more than usual when the founder is the entire sales team.
 *
 * WHAT THIS PAGE MUST NEVER DO
 * Compete on price. eClinicalWorks publishes 2.9% of collections for done-for-you RCM at 1 to 9
 * providers. We are not cheaper than a twenty-year-old vendor with an offshore delivery floor and
 * we should not pretend to be. The differentiator is that the number is published, the fee
 * structure is complete, and there is a version with no percentage in it at all.
 *
 * THE FLAT ALTERNATIVE IS NOT A CONVENIENCE
 * NY Education Law §6530(19) on fee-splitting is unresolved for percentage-of-collections
 * arrangements with a licensed physician, and counsel has not cleared it. The per-account option
 * exists so a New York practice has a structure to sign that does not depend on that question,
 * and so we are never in a position where the only thing we can sell is the thing under review.
 */

export const metadata = {
  title: "Pricing · Claima",
  description:
    "Published rates for A/R recovery, full revenue cycle management, and platform licensing. " +
    "No setup fee, no minimum, no annual contract.",
}

function Tier({
  eyebrow,
  name,
  price,
  unit,
  alt,
  who,
  includes,
  cta,
  ctaHref,
  featured,
}: {
  eyebrow: string
  name: string
  price: string
  unit: string
  alt?: string
  who: string
  includes: string[]
  cta: string
  ctaHref: string
  featured?: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-6 flex flex-col ${
        featured ? "border-blue-300 shadow-md ring-1 ring-blue-100" : "border-gray-200 shadow-sm"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600 mb-1.5">{eyebrow}</p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{name}</h2>
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{who}</p>

      <div className="mb-1">
        <span className="text-3xl font-bold text-gray-900 tabular-nums">{price}</span>
        <span className="text-sm text-gray-500 ml-1.5">{unit}</span>
      </div>
      {alt ? <p className="text-[13px] text-gray-600 mb-4">{alt}</p> : <div className="mb-4" />}

      <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-1">
        {includes.map((i) => (
          <li key={i} className="flex gap-2.5">
            <svg className="w-4 h-4 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{i}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`block text-center text-sm font-medium py-2.5 rounded-lg transition-colors ${
          featured
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-900 hover:bg-gray-700 text-white"
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <div className="flex gap-4 text-xs text-gray-500">
          <Link href="/leak-report" className="hover:text-gray-700">Leak Report</Link>
          <Link href="/security" className="hover:text-gray-700">Security</Link>
          <Link href="/login" className="hover:text-gray-700">Sign in</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        <div className="max-w-2xl mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">Pricing</h1>
          <p className="text-lg text-gray-700 leading-relaxed">
            Published, because nobody else in this category publishes theirs. You should not have to
            sit through a discovery call to find out whether we are affordable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          <Tier
            eyebrow="Start here"
            name="A/R recovery"
            price="30%"
            unit="of what we recover"
            alt="Or $150 per account worked, flat, if you prefer no percentage."
            who="Aged and denied claims your current process has stopped working. Nothing changes about who bills for you."
            includes={[
              "Paid only from money you had written off",
              "No recovery, no fee",
              "Your biller keeps the relationship and the day-to-day",
              "Worklist, appeal packets and payer evidence included",
              "Month to month, cancel any time",
            ]}
            cta="Start with the free report"
            ctaHref="/leak-report"
            featured
          />

          <Tier
            eyebrow="Replace the department"
            name="Full revenue cycle"
            price="5%"
            unit="of collections"
            alt="Inside the normal 4% to 8% band for outsourced billing."
            who="We become your billing department. Coding through submission, posting, denials, appeals and patient statements."
            includes={[
              "Claim scrubbing and 837P submission",
              "ERA posting and reconciliation",
              "Denial triage and appeals",
              "Eligibility checks and patient statements",
              "Claim-level reporting you can actually read",
            ]}
            cta="Talk about switching"
            ctaHref="/support"
          />

          <Tier
            eyebrow="For billing companies"
            name="Platform licence"
            price="$500"
            unit="/ month and up"
            alt="$1,500 at 25 to 100 providers, $3,000 above that."
            who="You already have the clients and the staff. Your team runs Claima on your own book."
            includes={[
              "Your team, your clients, your BAAs",
              "No per-claim fee on top",
              "837, 835 and CSV ingestion",
              "Underpayment and denial detection across every client",
              "White-label reporting",
            ]}
            cta="Ask about licensing"
            ctaHref="/support"
          />
        </div>

        {/* The differentiator is not the number. It is that the number is the whole number. */}
        <section className="rounded-xl border border-gray-200 bg-white p-7 mb-8">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">What we do not charge</h2>
          <p className="text-sm text-gray-600 mb-5 max-w-2xl leading-relaxed">
            Setup fees, per-statement fees, per-payer credentialing fees and clearinghouse
            pass-throughs routinely add 15% to 30% on top of a quoted rate in this industry. Here is
            the complete list of what is not on your invoice.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-sm text-gray-700">
            {[
              "Setup or implementation fee",
              "Monthly minimum",
              "Annual contract",
              "Per-statement charge",
              "Per-payer credentialing fee",
              "Clearinghouse pass-through",
              "Charge for the free report",
              "Termination fee",
              "Per-seat licence",
            ].map((x) => (
              <div key={x} className="flex gap-2 items-start">
                <span className="text-gray-400 mt-0.5" aria-hidden="true">&times;</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-7 mb-8">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Questions people actually ask</h2>
          <dl className="space-y-5 text-sm max-w-3xl">
            <div>
              <dt className="font-semibold text-gray-900 mb-1">Is the free report really free?</dt>
              <dd className="text-gray-600 leading-relaxed">
                Yes, and it never reaches us. It runs in your browser, your file is read from your
                own disk and analysed in memory, and you can confirm that by opening your network
                tab before you drop it. There is no signup.{" "}
                <Link href="/leak-report" className="text-blue-600 underline hover:text-blue-700">
                  Run it
                </Link>
                .
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 mb-1">Do I have to leave my current biller?</dt>
              <dd className="text-gray-600 leading-relaxed">
                No. Recovery works alongside whoever bills for you today, on accounts they have
                already stopped working. Read your existing agreement first, though: some billing
                contracts claim an exclusive right to collect on active accounts, and in those the
                usual carve-out is for accounts already adjusted to a zero balance. We will look at
                it with you before anything is signed.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 mb-1">Why offer a flat per-account rate at all?</dt>
              <dd className="text-gray-600 leading-relaxed">
                Two reasons. Some practices simply prefer a known number. And percentage-of-collections
                arrangements sit in unsettled territory under New York fee-splitting rules, so a
                structure that does not depend on that question should always be available to you.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 mb-1">How long until we see money?</dt>
              <dd className="text-gray-600 leading-relaxed">
                Recovery starts on receivables that already exist, so there is no enrollment wait.
                Switching your full billing is different: payer EDI, EFT and ERA enrollment takes
                weeks, and we would rather say so now than discover it together in month two.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 mb-1">What if you find nothing?</dt>
              <dd className="text-gray-600 leading-relaxed">
                Then you pay nothing and you keep the report. That is the entire point of pricing
                recovery on outcome.
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50 px-7 py-7">
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">See a number before you talk to anyone</h2>
          <p className="text-sm text-gray-700 mb-4 max-w-2xl leading-relaxed">
            Drop in a remittance file and the report tells you what was never worked, which payer is
            quietly your largest, what stops being collectible in 60 days, and where you were paid
            below the published Medicare amount for your locality.
          </p>
          <Link
            href="/leak-report"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            Run the free report
          </Link>
        </section>

        <p className="text-xs text-gray-500 mt-8 max-w-3xl leading-relaxed">
          Rates shown are standard and apply to independent practices and billing companies in New
          York, New Jersey and Connecticut. Claima LLC is a New York limited liability company.
        </p>
      </main>
    </div>
  )
}
