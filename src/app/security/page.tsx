import Link from "next/link"

export const metadata = { title: "Security & Compliance — Claima" }

function Check() {
  return (
    <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function InProgress() {
  return (
    <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">C</div>
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <div className="flex gap-4 text-xs text-gray-500">
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <Link href="/login" className="hover:text-gray-700">Sign in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Security & Compliance</h1>
        </div>
        <p className="text-gray-500 text-sm mb-2">Last updated: June 8, 2026</p>
        <p className="text-gray-600 text-sm mb-10 leading-relaxed">
          Claima is built for healthcare providers across all specialties. Every architectural decision — from our database to our AI providers — is made with HIPAA compliance and the protection of Protected Health Information (PHI) as a first-order requirement.
        </p>

        {/* Compliance status banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-10">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-4">Compliance Posture</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "HIPAA-Ready", status: "live" },
              { label: "Business Associate Agreements (BAA)", status: "live" },
              { label: "Data Processing Agreement (DPA)", status: "live" },
              { label: "TLS 1.2+ encryption in transit", status: "live" },
              { label: "AES-256 encryption at rest", status: "live" },
              { label: "SOC 2 Type II", status: "progress" },
              { label: "HITRUST CSF", status: "progress" },
              { label: "Microsoft AppSource Certified", status: "progress" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2.5">
                {item.status === "live" ? <Check /> : <InProgress />}
                <div>
                  <span className="text-sm text-gray-800">{item.label}</span>
                  {item.status === "progress" && (
                    <span className="ml-2 text-xs text-amber-600 font-medium">In progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-10 text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">HIPAA Compliance</h2>
            <p className="text-sm leading-relaxed mb-3">
              Claima acts as a <strong>Business Associate</strong> under HIPAA for all covered entity customers. We execute a Business Associate Agreement (BAA) with every customer before any PHI is processed. Our BAA covers:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Permitted uses and disclosures of PHI</li>
              <li>Safeguards to prevent unauthorized use or disclosure</li>
              <li>Breach notification within 60 days of discovery</li>
              <li>Return or destruction of PHI upon contract termination</li>
              <li>Sub-processor obligations passed through to all vendors handling PHI</li>
            </ul>
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
              To request a BAA or review our standard BAA template, contact{" "}
              <a href="mailto:security@claima.io" className="text-blue-600 hover:underline">security@claima.io</a>.
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Data Encryption</h2>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />
                <div>
                  <div className="font-medium text-gray-900">In Transit</div>
                  <div className="text-gray-500 mt-0.5">All data transmitted between clients and Claima servers is encrypted using TLS 1.2 or higher. We enforce HTTPS across all endpoints with HSTS headers.</div>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />
                <div>
                  <div className="font-medium text-gray-900">At Rest</div>
                  <div className="text-gray-500 mt-0.5">All data at rest is encrypted using AES-256. This includes PHI stored in our PostgreSQL database (hosted on Supabase with encryption at the storage layer) and all backups.</div>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />
                <div>
                  <div className="font-medium text-gray-900">API Keys & Secrets</div>
                  <div className="text-gray-500 mt-0.5">All API keys, secrets, and credentials are stored as encrypted environment variables and never committed to source code or logs.</div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Access Controls</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Role-based access control (RBAC) — users only access data belonging to their practice</li>
              <li>JWT-based authentication with short-lived session tokens</li>
              <li>Multi-factor authentication (MFA) support via Microsoft Azure AD SSO</li>
              <li>All PHI access is scoped to authenticated, authorized sessions</li>
              <li>Internal Claima staff access to production data requires explicit approval and is logged</li>
              <li>Principle of least privilege applied to all service accounts and API integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">AI & Third-Party Processors</h2>
            <p className="text-sm leading-relaxed mb-3">
              Claima uses AI to power appeal letter drafting, billing insights, and claim assistance. PHI processed through AI systems is handled as follows:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><strong>Anthropic (Claude):</strong> PHI is processed under a Business Associate Agreement with Anthropic. PHI is never used to train general-purpose models.</li>
              <li><strong>Stedi:</strong> EDI claim transmission is handled by Stedi under BAA as a HIPAA-compliant clearinghouse.</li>
              <li><strong>Stripe:</strong> Payment processing is PCI-DSS Level 1 compliant. Claima does not store full card numbers.</li>
              <li><strong>Supabase / AWS:</strong> Database hosted on AWS infrastructure with SOC 2 Type II and HIPAA compliance.</li>
            </ul>
            <p className="text-sm mt-3 text-gray-500">A full list of sub-processors is available upon request.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Infrastructure & Availability</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>Hosted on Vercel (edge network) and AWS (database), both with 99.9%+ uptime SLAs</li>
              <li>Automated daily database backups with 30-day retention</li>
              <li>Point-in-time recovery available on database tier</li>
              <li>Zero-downtime deployments via Vercel's edge infrastructure</li>
              <li>US-East data residency (AWS us-east-1)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Audit Logging</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li>All PHI access and modifications are logged with user, timestamp, and action</li>
              <li>Authentication events (login, logout, failed attempts) are logged</li>
              <li>Logs are retained for a minimum of 6 years in accordance with HIPAA requirements</li>
              <li>Logs are immutable and stored separately from application data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Incident Response</h2>
            <p className="text-sm leading-relaxed">
              Claima maintains a documented incident response plan. In the event of a PHI breach, we will notify affected covered entities within <strong>60 days</strong> of discovery, in accordance with the HIPAA Breach Notification Rule. Notifications include the nature of the breach, PHI involved, steps taken to mitigate harm, and corrective actions implemented.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Certifications Roadmap</h2>
            <div className="space-y-3 text-sm">
              {[
                { name: "SOC 2 Type II", status: "In progress — audit period begins Q3 2026", color: "amber" },
                { name: "HITRUST CSF", status: "Planned Q1 2027", color: "gray" },
                { name: "Microsoft AppSource Certification", status: "In progress — submission Q3 2026", color: "amber" },
              ].map((cert) => (
                <div key={cert.name} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="font-medium text-gray-900">{cert.name}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    cert.color === "amber"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-gray-100 text-gray-500"
                  }`}>{cert.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Responsible Disclosure</h2>
            <p className="text-sm leading-relaxed">
              If you discover a security vulnerability in Claima, please report it responsibly to{" "}
              <a href="mailto:security@claima.io" className="text-blue-600 hover:underline">security@claima.io</a>.
              We will acknowledge receipt within 24 hours and work to resolve confirmed vulnerabilities promptly. We do not pursue legal action against researchers who report issues in good faith.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-1">
              <p className="font-medium text-gray-900">Claima, Inc. — Security Team</p>
              <p>Security inquiries & BAA requests: <a href="mailto:security@claima.io" className="text-blue-600 hover:underline">security@claima.io</a></p>
              <p>Privacy inquiries: <a href="mailto:privacy@claima.io" className="text-blue-600 hover:underline">privacy@claima.io</a></p>
              <p>General support: <a href="mailto:support@claima.io" className="text-blue-600 hover:underline">support@claima.io</a></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <Link href="/security" className="hover:text-gray-600 text-gray-600 font-medium">Security</Link>
          <a href="mailto:security@claima.io" className="hover:text-gray-600">security@claima.io</a>
        </div>
        <p className="mt-3">© 2026 Claima, Inc. All rights reserved.</p>
      </footer>
    </div>
  )
}
