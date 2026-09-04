import Link from "next/link"
import { notFound } from "next/navigation"
import { LogoMark } from "@/components/Logo"
import { activationEnabled } from "@/lib/flags"

/**
 * ⚠️ COUNSEL REVIEW REQUIRED BEFORE THIS IS RELIED ON COMMERCIALLY.
 *
 * These are the engagement terms a practice accepts in the self-serve activation flow. Two
 * items are open and are recorded in the pricing-model notes:
 *
 *  1. NY Education Law §6530(19) fee-splitting. Compensation that is "a percentage of, or
 *     otherwise dependent upon, the income or receipts of the licensee" is professional
 *     misconduct FOR THE PHYSICIAN, and it is payer-agnostic. No vendor carve-out exists —
 *     clarifying bills were introduced in 2015, 2017, 2019 and 2021 and none passed. The
 *     terms below mirror the defensible posture those bills describe (no control over the
 *     fees charged, collections paid directly to the practice, no referral-based
 *     compensation), but that posture has not been cleared by counsel.
 *  2. The signing entity is still legally Pathfinder Projects LLC. Until the Certificate of
 *     Amendment is filed, the legal name here and on the BAA must match the entity that
 *     actually exists.
 *
 * Section 3 already carves Medicaid out to a flat per-claim fee, which addresses the
 * separate and narrower NY Medicaid percentage prohibition.
 */
export const metadata = {
  title: "Recovery Services Agreement — Claima",
  description:
    "The engagement terms for Claima A/R recovery services: contingency fee, scope, and how funds are handled.",
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-[15px] text-gray-700 leading-relaxed">{children}</div>
    </section>
  )
}

// Read the flag per request rather than at build, so it can be flipped without a rebuild.
export const dynamic = "force-dynamic"

export default function EngagementPage() {
  // Until activation is live this agreement cannot be accepted by anyone, and publishing
  // legal terms nobody can act on is worse than not publishing them — it invites reliance
  // on text counsel has not cleared.
  if (!activationEnabled()) notFound()

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-semibold text-sm tracking-tight">Claima</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Recovery Services Agreement</h1>
        <p className="text-sm text-gray-500 mb-8">
          The commercial terms for accounts receivable recovery. Separate from the{" "}
          <Link href="/baa" className="text-blue-600 hover:underline">
            Business Associate Agreement
          </Link>
          , which governs how your data is handled and creates no engagement on its own.
        </p>

        <Section n="1" title="What we do">
          <p>
            Claima reviews the accounts receivable you provide, establishes the current status of
            each claim with the payer, and pursues the balances that are still recoverable. That
            includes claim status inquiries, corrected claims, reopenings, appeals, and escalation
            to the payer where a claim was never adjudicated.
          </p>
          <p>
            We do not change how you bill. There is no system migration and no requirement to move
            off your current practice-management system or clearinghouse.
          </p>
        </Section>

        <Section n="2" title="What it costs">
          <p>
            <strong>30% of amounts actually recovered</strong> on the accounts we work. You pay
            nothing up front, nothing for accounts we do not recover, and nothing for the
            diagnostic. If we recover nothing, you owe nothing.
          </p>
          <p>
            An amount is &ldquo;recovered&rdquo; when the payer or patient pays it after we began
            work on that account. Payments you had already received, and payments on accounts we
            never touched, are not recovered amounts.
          </p>
        </Section>

        <Section n="3" title="Medicaid accounts">
          <p>
            New York prohibits a billing agent from charging a percentage of the amount claimed or
            collected on Medicaid. Medicaid accounts are therefore carved out of the contingency
            entirely and billed at a <strong>flat $50 per account worked</strong>, regardless of
            outcome. We identify these accounts before starting and confirm the list with you.
          </p>
        </Section>

        <Section n="4" title="How money moves">
          <p>
            <strong>Payers and patients pay you directly, into your own account.</strong> Claima
            never takes custody of your collections. We invoice you for the contingency fee after
            payment has been received and posted.
          </p>
          <p>
            You set and control every fee charged to your patients. Claima does not set your fee
            schedule, does not decide what is billed, and receives no compensation of any kind in
            exchange for referrals.
          </p>
        </Section>

        <Section n="5" title="What we need from you">
          <p>
            An executed Business Associate Agreement, your practice NPI and Tax ID, the A/R detail
            for the accounts to be worked, and access to the relevant payer portals or written
            authorization to act as your representative with those payers. For Medicare, that
            means a completed CMS-1696 or an equivalent delegated-official designation.
          </p>
          <p>
            Explanations of benefits for denied claims, where you have them. An appeal written
            without the actual denial reason is guesswork, and we will tell you when we are
            missing what we need rather than filing anyway.
          </p>
        </Section>

        <Section n="6" title="What we do not do">
          <p>
            We do not guarantee any specific recovery amount. Estimates shown in the Leak Report
            or elsewhere are modeled projections, not commitments, and aged accounts recover
            partially by nature.
          </p>
          <p>
            We do not determine medical necessity, select diagnosis or procedure codes on your
            behalf without your review, or submit anything to a payer that you have not authorized.
            Clinical and coding judgment stays with the practice.
          </p>
        </Section>

        <Section n="7" title="Ending the engagement">
          <p>
            Either party may end this agreement with 30 days&apos; written notice. Fees remain
            payable on amounts recovered from work performed before termination. On termination we
            return or destroy your protected health information as required by the Business
            Associate Agreement, and you may request an export of your data at any time.
          </p>
        </Section>

        <Section n="8" title="Acceptance">
          <p>
            Accepting these terms records the date, time, and IP address of acceptance against
            your practice. The person accepting represents that they are authorized to bind the
            practice. This agreement is separate from and in addition to the Business Associate
            Agreement and the{" "}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-gray-100 flex items-center gap-5 text-xs text-gray-500">
          <Link href="/baa" className="hover:text-gray-900">
            Business Associate Agreement
          </Link>
          <Link href="/terms" className="hover:text-gray-900">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-gray-900">
            Privacy
          </Link>
          <Link href="/security" className="hover:text-gray-900">
            Security
          </Link>
        </div>
      </main>
    </div>
  )
}
