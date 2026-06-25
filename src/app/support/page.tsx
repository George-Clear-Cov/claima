import Link from "next/link"
import AppLayout from "@/components/AppLayout"

const FAQS = [
  {
    q: "A claim was rejected — what do I do?",
    a: "Go to Claims and check the rejection reason. Common causes: invalid NPI, missing diagnosis codes, or prior auth required. The AI Claim Scrub flags most of these before submission. If it was rejected by the payer after submission, a denial will appear automatically in the Denials tab — use AI to generate an appeal letter.",
    link: { label: "View denials →", href: "/denials" },
  },
  {
    q: "ERA didn't post automatically — how do I post it manually?",
    a: "Go to Billing and find the claim in the ERA tab. Click 'Post ERA' on any claim that shows as submitted. If you have a real ERA file from the payer, paste the raw text into the ERA parser to extract the payment details, then post it to the claim.",
    link: { label: "Go to Billing →", href: "/billing" },
  },
  {
    q: "A patient can't pay their balance — how do I send them a payment link?",
    a: "Patient-facing payment links are coming soon. In the meantime, you can record manual payments in the Billing tab by clicking on a statement. For questions about patient payments or Stripe, email us and we'll help you directly.",
    link: null,
  },
  {
    q: "How do I add a new payer or update enrollment status?",
    a: "Go to Settings → Payers. You can add new payers, mark them as Active or Pending enrollment, and record your Claim.MD payer ID. Enrollment through Claim.MD must be completed on their platform before live EDI claims will route correctly.",
    link: { label: "Go to Settings → Payers →", href: "/settings?tab=payers" },
  },
  {
    q: "How do I sign a Business Associate Agreement (BAA)?",
    a: "Visit the BAA page to review and accept the Claima BAA. This is required before any PHI touches the system. For Stripe, Vercel, Supabase, and Anthropic BAAs, contact us and we'll send you the documents.",
    link: { label: "Review BAA →", href: "/baa" },
  },
  {
    q: "How does the 5% platform fee work?",
    a: "Claima collects a 5% fee on patient payments only — not on insurance collections. When a patient pays their copay or balance through the platform, 5% goes to Claima and 95% is deposited to your practice's connected Stripe account within 2 business days.",
    link: null,
  },
]

export default function SupportPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-gray-500 text-sm mt-1">Get help with claims, billing, and your account.</p>

        {/* Contact card */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Contact support</h2>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">✉</span>
              <div>
                <a href="mailto:support@claima.io" className="text-sm font-medium text-blue-700 hover:text-blue-900">
                  support@claima.io
                </a>
                <p className="text-xs text-blue-600 mt-0.5">Response within 4 business hours, Mon–Fri</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">🔒</span>
              <div>
                <a href="mailto:security@claima.io" className="text-sm font-medium text-blue-700 hover:text-blue-900">
                  security@claima.io
                </a>
                <p className="text-xs text-blue-600 mt-0.5">Security incidents, BAA requests, compliance questions</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Common questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900">{faq.q}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{faq.a}</p>
                {faq.link && (
                  <Link
                    href={faq.link.href}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-3 inline-block"
                  >
                    {faq.link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex gap-4 text-xs text-gray-400">
          <Link href="/baa" className="hover:text-gray-600">BAA</Link>
          <Link href="/security" className="hover:text-gray-600">Security</Link>
          <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms</Link>
        </div>
      </div>
    </AppLayout>
  )
}
