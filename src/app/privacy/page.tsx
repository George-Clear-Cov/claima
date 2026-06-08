import Link from "next/link"

export const metadata = { title: "Privacy Policy — Claima" }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">C</div>
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <div className="flex gap-4 text-xs text-gray-500">
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <Link href="/login" className="hover:text-gray-700">Sign in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: June 7, 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Overview</h2>
            <p>Claima ("we," "us," or "our") is a HIPAA-compliant medical billing platform operated by Claima, Inc. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use our service. We are committed to protecting both personal information and protected health information (PHI) in accordance with applicable law, including the Health Insurance Portability and Accountability Act (HIPAA).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">HIPAA Compliance</h2>
            <p>Claima acts as a <strong>Business Associate</strong> to covered healthcare entities (practices and providers) under HIPAA. As such:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>We execute a Business Associate Agreement (BAA) with each covered entity customer.</li>
              <li>PHI is encrypted at rest (AES-256) and in transit (TLS 1.2+).</li>
              <li>Access to PHI is limited to authorized personnel on a need-to-know basis.</li>
              <li>We maintain audit logs of all PHI access and modifications.</li>
              <li>PHI is never used for advertising, sold, or shared with third parties except as required to provide our services or as permitted by HIPAA.</li>
              <li>We notify covered entities of any PHI breach within 60 days of discovery.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Information We Collect</h2>
            <h3 className="font-medium text-gray-800 mb-2">Account Information</h3>
            <p>When you create an account, we collect your name, email address, and (for password-based accounts) a hashed password. We may also collect your organization name and contact information.</p>
            <h3 className="font-medium text-gray-800 mb-2 mt-4">Practice and Clinical Data</h3>
            <p>To provide billing services, we process practice information (NPI, Tax ID, address), provider information, patient demographic and insurance information, clinical service records, and insurance claim data. This data constitutes PHI and is handled in accordance with HIPAA.</p>
            <h3 className="font-medium text-gray-800 mb-2 mt-4">Usage Data</h3>
            <p>We automatically collect certain usage information such as IP addresses, browser type, pages viewed, and actions taken within the application. This data is used to improve our service and ensure security.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve our billing platform</li>
              <li>To process and submit insurance claims on your behalf</li>
              <li>To generate AI-powered billing insights and recommendations</li>
              <li>To send service-related notifications and billing statements</li>
              <li>To comply with legal obligations including HIPAA reporting requirements</li>
              <li>To detect and prevent fraud and security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">AI and Machine Learning</h2>
            <p>Claima uses AI models (including third-party AI APIs) to provide features such as claim code extraction, denial analysis, appeal letter drafting, and revenue insights. When processing PHI through AI systems:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>PHI is processed through HIPAA-compliant AI service providers under BAA.</li>
              <li>We do not use PHI to train general-purpose AI models.</li>
              <li>AI-generated outputs (appeal letters, insights) are reviewed and controlled by your practice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Data Sharing and Disclosure</h2>
            <p>We share information only as follows:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Insurance Payers:</strong> Claim data is transmitted to payers as necessary for billing.</li>
              <li><strong>Clearinghouses:</strong> EDI claim data may be routed through certified HIPAA clearinghouses.</li>
              <li><strong>Payment Processors:</strong> Payment data is handled by PCI-DSS compliant processors (Stripe).</li>
              <li><strong>AI Service Providers:</strong> Select data is processed by AI providers under BAA.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information when required by law or valid legal process.</li>
            </ul>
            <p className="mt-3">We do not sell personal information or PHI to any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Data Retention</h2>
            <p>We retain PHI for a minimum of 6 years from the date of creation or the date it was last in effect, as required by HIPAA. Account information is retained for the duration of your account plus a reasonable period thereafter. You may request deletion of non-PHI account data at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Security</h2>
            <p>We implement administrative, physical, and technical safeguards to protect your information, including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>TLS 1.2+ encryption for all data in transit</li>
              <li>AES-256 encryption for data at rest</li>
              <li>Multi-factor authentication support</li>
              <li>Role-based access controls</li>
              <li>Regular security assessments and penetration testing</li>
              <li>SOC 2 Type II compliance (in progress)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Rights</h2>
            <p>Depending on your location, you may have rights to access, correct, or delete your personal information. To exercise these rights, contact us at privacy@claima.io. Note that rights with respect to PHI are governed by HIPAA and may be addressed through your covered entity.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p>For privacy inquiries, HIPAA questions, or to request a BAA:</p>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
              <p>Claima, Inc.</p>
              <p>Email: <a href="mailto:privacy@claima.io" className="text-blue-600 hover:underline">privacy@claima.io</a></p>
              <p>Support: <a href="mailto:support@claima.io" className="text-blue-600 hover:underline">support@claima.io</a></p>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
