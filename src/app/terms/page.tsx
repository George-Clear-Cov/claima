import Link from "next/link"

export const metadata = { title: "Terms of Service — Claima" }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">C</div>
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <div className="flex gap-4 text-xs text-gray-500">
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/security" className="hover:text-gray-700">Security</Link>
          <Link href="/login" className="hover:text-gray-700">Sign in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: June 7, 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Claima (the "Service"), operated by Claima, Inc. ("Company," "we," "us"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>Claima is an AI-powered medical billing platform that helps healthcare providers submit insurance claims, manage denials, track patient billing, and optimize revenue. The Service is intended for use by licensed healthcare providers, billing staff, and authorized healthcare organizations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. HIPAA and Healthcare Compliance</h2>
            <p>You acknowledge that you are a HIPAA Covered Entity or Business Associate, and that your use of Claima involves Protected Health Information (PHI). By using the Service:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>You agree to enter into a Business Associate Agreement (BAA) with Claima, Inc. prior to processing PHI.</li>
              <li>You are responsible for ensuring your use of the Service complies with all applicable laws, including HIPAA, state privacy laws, and billing regulations.</li>
              <li>You are responsible for verifying the accuracy of all claims submitted through the Service.</li>
              <li>You acknowledge that AI-generated outputs (appeal letters, code suggestions, billing insights) are assistive tools and must be reviewed by qualified staff before use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Fees and Payment</h2>
            <p>Claima charges a percentage of collections processed through the platform. Specific fee rates are agreed upon at the time of account setup. You authorize Claima to deduct platform fees from collected amounts processed through Stripe Connect. Fees are non-refundable except as expressly provided in your service agreement.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Submit false, fraudulent, or upcoded claims through the Service</li>
              <li>Use the Service to violate any applicable law or regulation</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Use the Service for any purpose other than legitimate healthcare billing operations</li>
            </ul>
            <p className="mt-3">Healthcare billing fraud is a federal crime. Claima reserves the right to suspend accounts and cooperate with law enforcement investigations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. AI-Assisted Features</h2>
            <p>The Service includes AI-assisted features for coding, appeals, and insights. These features are provided as tools to assist trained billing staff and do not constitute medical advice, legal advice, or a guarantee of claim payment. You are solely responsible for reviewing and approving all AI-generated outputs before submission to payers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Data Ownership</h2>
            <p>You retain ownership of all data you submit to Claima, including PHI. You grant Claima a limited license to process your data solely to provide the Service. We do not claim any ownership rights in your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, MEDIBILL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF REVENUE, LOSS OF PROFITS, OR LOSS OF DATA. OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE FEES YOU PAID IN THE THREE MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Termination</h2>
            <p>Either party may terminate this agreement with 30 days written notice. We may suspend or terminate your account immediately if you breach these Terms or if required by law. Upon termination, you may export your data within 30 days. After this period, we may delete your data in accordance with our data retention policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of California, without regard to its conflict of law provisions. Any disputes shall be resolved through binding arbitration in San Francisco, California, except that either party may seek injunctive relief in court.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Contact</h2>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
              <p>Claima, Inc.</p>
              <p>Email: <a href="mailto:legal@claima.io" className="text-blue-600 hover:underline">legal@claima.io</a></p>
              <p>Support: <a href="mailto:support@claima.io" className="text-blue-600 hover:underline">support@claima.io</a></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600 text-gray-600 font-medium">Terms of Service</Link>
          <Link href="/security" className="hover:text-gray-600">Security</Link>
          <a href="mailto:legal@claima.io" className="hover:text-gray-600">legal@claima.io</a>
        </div>
        <p className="mt-3">© 2026 Claima, Inc. All rights reserved.</p>
      </footer>
    </div>
  )
}
