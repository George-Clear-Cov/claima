import Link from "next/link"
import { LogoMark } from "@/components/Logo"
import LeakReportTool from "@/components/marketing/LeakReportTool"
import { activationEnabled } from "@/lib/flags"

// Public, no-auth, no-signup. The page shell is server-rendered so it is crawlable and
// unfurls properly; the tool itself is the only client component, and it never transmits
// the visitor's file. See the note at the top of LeakReportTool.tsx.
export const metadata = {
  title: "Free A/R Leak Report — find the money your practice never collected | Claima",
  description:
    "Drop in your A/R aging export and see what is actually recoverable, which payer is quietly your largest, and what stops being collectible in 60 days. Runs entirely in your browser. No signup, nothing uploaded.",
  alternates: { canonical: "https://claima.io/leak-report" },
  openGraph: {
    title: "You did not lose the money. Nobody looked for it.",
    description:
      "A free diagnostic that reads your own A/R export in your browser and tells you what is recoverable. Nothing is uploaded.",
    url: "https://claima.io/leak-report",
    type: "website",
  },
}

// The activation flag is read per request so it can be flipped with an app setting rather
// than a rebuild. The diagnostic itself is public either way.
export const dynamic = "force-dynamic"

export default function LeakReportPage() {
  const activation = activationEnabled()

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 print:hidden">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-semibold text-sm tracking-tight">Claima</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/security"
              className="hidden sm:inline-block text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              Security
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-14">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 text-xs font-medium text-blue-700 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Free. No signup. Nothing leaves your browser.
          </div>
          <h1 className="text-[2.4rem] font-bold tracking-tight leading-[1.1] text-gray-900 mb-4">
            You did not lose the money.
            <br />
            Nobody looked for it.
          </h1>
          <p className="text-[1.05rem] text-gray-600 leading-relaxed max-w-2xl">
            Every billing company is paid a percentage of what it collects, which means it is paid
            to process claims and never paid to find the ones it failed to collect. Drop in your
            own A/R export and see the difference in ten seconds.
          </p>
        </div>

        <LeakReportTool activationEnabled={activation} />

        <section className="mt-16 pt-10 border-t border-gray-100 print:hidden">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-6">
            Common questions
          </h2>
          <div className="space-y-6 text-sm">
            <Faq q="Is this really private?">
              Yes, and it is structural rather than a promise. The parser is JavaScript that runs in
              your browser tab. Your file is read from your own disk, analyzed in memory, and
              displayed. There is no upload, no server call, and no analytics event carrying your
              data. You can confirm it: open your browser network tab before dropping the file and
              you will see no request. Because the file never reaches us, running the diagnostic
              needs no business associate agreement.{" "}
              {activation
                ? "There is exactly one exception, and it is yours to choose: if you decide at the end to have us work the A/R, the file is sent only after you have signed the BAA. Until you click that button, nothing moves."
                : "There is no way for this page to send it — the only thing that leaves is an email you write yourself, carrying totals and no patient detail."}
            </Faq>

            {activation && (
              <Faq q="What happens when I click &ldquo;start recovery&rdquo;?">
                Four things, in this order, and the order is the point. You identify the practice
                with its NPI and Tax ID, which are what name the covered entity on the agreements
                and appear on every claim. You accept the Business Associate Agreement, which
                governs the data, and the Recovery Services Agreement, which sets the 30%
                contingency; both are recorded with a timestamp and IP address. You verify your
                email with a six-digit code. Only then is the file you already analyzed loaded
                into your account, so you never upload it twice. Every one of those conditions is
                also enforced on the server, so the import is refused if any of them is missing no
                matter what the page does.
              </Faq>
            )}

            <Faq q="What file do I need?">
              An A/R aging or open-balance report exported to CSV from whatever system you bill in.
              One row per service line. It needs a payer column and a balance column at minimum;
              service date and follow-up notes make the analysis considerably sharper. Raw 835
              remittance files work too. If your headers are unusual, the parser will tell you which
              columns it could not read rather than guessing.
            </Faq>
            <Faq q="Where do the recovery estimates come from?">
              From a live A/R engagement, applied per tier rather than as one blended rate. We say
              exactly what the basis is on the report itself, and we tell you what your export did
              not contain. We do not publish benchmarks we do not have. As the corpus grows the
              ranges will be rebuilt on it, and we will say so when that happens.
            </Faq>
            <Faq q="What if the number looks too good?">
              Read the tiers rather than the headline. Recovery on aged A/R is genuinely partial,
              and the ranges reflect that. The estimate is most reliable where your export carried
              service dates and follow-up notes, and least reliable where it did not, which is
              called out in the report. The honest version of this diagnostic is more useful to you
              than a flattering one.
            </Faq>
            <Faq q="What does it cost?">
              We work the A/R on contingency: 30% of what is actually recovered, nothing on what is
              not, and nothing up front. No card is required to start and there is no system
              migration or change to how you bill today. Practices that want us to take over
              billing entirely move to 5% of collections after the recovery work proves out.
            </Faq>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 bg-gray-50 print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <LogoMark size={18} />
            <span>Claima — AI-native revenue cycle management</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/security" className="hover:text-gray-900">Security</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-gray-900 mb-1.5">{q}</p>
      <p className="text-gray-600 leading-relaxed">{children}</p>
    </div>
  )
}
