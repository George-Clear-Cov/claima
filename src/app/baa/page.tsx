import Link from "next/link"

export const metadata = {
  title: "Business Associate Agreement — Claima",
}

export default function BaaPage() {
  const effective = "June 16, 2026"

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← claima.io</Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Associate Agreement</h1>
        <p className="text-gray-500 text-sm mb-8">Effective {effective} · Version 1.0</p>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">Recitals</h2>
            <p>
              This Business Associate Agreement (&ldquo;BAA&rdquo;) is entered into between claima.io (&ldquo;Business Associate&rdquo; or &ldquo;Claima&rdquo;), a medical billing platform, and the covered entity or other business associate that has accepted these terms (&ldquo;Covered Entity&rdquo;) (each a &ldquo;Party,&rdquo; collectively the &ldquo;Parties&rdquo;).
            </p>
            <p>
              The Parties enter into this BAA to satisfy the requirements of the Health Insurance Portability and Accountability Act of 1996 (&ldquo;HIPAA&rdquo;), the Health Information Technology for Economic and Clinical Health Act (&ldquo;HITECH&rdquo;), and the regulations promulgated thereunder (collectively, &ldquo;HIPAA Rules&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">1. Definitions</h2>
            <p>Capitalized terms not otherwise defined herein have the meanings given in 45 C.F.R. Parts 160 and 164.</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong>&ldquo;PHI&rdquo;</strong> means Protected Health Information as defined in 45 C.F.R. § 160.103.</li>
              <li><strong>&ldquo;ePHI&rdquo;</strong> means Electronic Protected Health Information.</li>
              <li><strong>&ldquo;Services&rdquo;</strong> means the medical billing, claim submission, denial management, eligibility verification, and related services provided by Claima to Covered Entity.</li>
              <li><strong>&ldquo;Breach&rdquo;</strong> has the meaning set forth in 45 C.F.R. § 164.402.</li>
              <li><strong>&ldquo;Security Incident&rdquo;</strong> has the meaning set forth in 45 C.F.R. § 164.304.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">2. Permitted Uses and Disclosures of PHI</h2>
            <p>Business Associate may use and disclose PHI only as follows:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>As necessary to perform the Services for or on behalf of Covered Entity, as described in the service agreement between the Parties.</li>
              <li>As required by law.</li>
              <li>For the proper management and administration of Business Associate&apos;s operations, provided that any such disclosures are required by law or Business Associate obtains reasonable assurances from the recipient that the PHI will be held confidentially.</li>
              <li>To report violations of law to appropriate authorities, as permitted by 45 C.F.R. § 164.502(j)(1).</li>
            </ul>
            <p>Business Associate shall not use or disclose PHI for any purpose other than those set forth in this BAA or as otherwise required or permitted by the HIPAA Rules.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">3. Safeguards</h2>
            <p>Business Associate shall:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>Implement and maintain appropriate administrative, physical, and technical safeguards to protect the confidentiality, integrity, and availability of ePHI, in accordance with 45 C.F.R. Part 164, Subpart C (Security Rule).</li>
              <li>Encrypt all ePHI in transit using TLS 1.2 or higher and at rest using industry-standard encryption.</li>
              <li>Implement access controls so that only authorized workforce members may access PHI.</li>
              <li>Maintain an audit log of access to and changes in PHI systems.</li>
              <li>Conduct regular risk assessments and implement risk management measures.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">4. Reporting</h2>
            <p><strong>Breach Notification:</strong> Business Associate shall notify Covered Entity without unreasonable delay, and in no event later than thirty (30) calendar days after discovery, of any Breach of Unsecured PHI, as required by 45 C.F.R. § 164.410.</p>
            <p><strong>Security Incidents:</strong> Business Associate shall report to Covered Entity any Security Incident of which Business Associate becomes aware. Unsuccessful attempts at unauthorized access, use, disclosure, modification, or destruction of ePHI occur routinely; by accepting this BAA, Covered Entity agrees that this paragraph constitutes ongoing notice of such unsuccessful attempts.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">5. Subcontractors</h2>
            <p>
              Business Associate shall ensure that any subcontractor or agent that creates, receives, maintains, or transmits PHI on behalf of Business Associate agrees to the same restrictions and conditions that apply to Business Associate through a written agreement that complies with the HIPAA Rules. Current subprocessors that may handle PHI include: Supabase (database), Vercel (hosting), and Stripe (payment processing). Claima will maintain and make available a current list of subprocessors upon request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">6. Individual Rights</h2>
            <p>To the extent Business Associate maintains a Designated Record Set, Business Associate shall:</p>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>Provide Covered Entity access to PHI necessary for Covered Entity to respond to individuals&apos; requests for access under 45 C.F.R. § 164.524.</li>
              <li>Incorporate any amendments to PHI as directed by Covered Entity under 45 C.F.R. § 164.526.</li>
              <li>Provide Covered Entity with information necessary to respond to accounting of disclosures requests under 45 C.F.R. § 164.528.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">7. Minimum Necessary</h2>
            <p>Business Associate shall use, disclose, or request only the minimum amount of PHI necessary to accomplish the intended purpose of the use, disclosure, or request.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">8. Term and Termination</h2>
            <p><strong>Term:</strong> This BAA is effective as of the date Covered Entity accepts these terms and shall continue until terminated as provided herein.</p>
            <p><strong>Termination for Cause:</strong> Either Party may terminate this BAA, effective immediately, if the other Party materially breaches a provision of this BAA and does not cure such breach within thirty (30) days of written notice.</p>
            <p><strong>Effect of Termination:</strong> Upon termination, Business Associate shall, at Covered Entity&apos;s election, return or destroy all PHI received from, or created or received on behalf of, Covered Entity that Business Associate still maintains. If return or destruction is infeasible, Business Associate shall continue to protect such PHI in accordance with this BAA.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">9. Miscellaneous</h2>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li><strong>Amendment:</strong> Claima reserves the right to amend this BAA from time to time. Continued use of the Services following notice of a material change constitutes acceptance of the amended BAA.</li>
              <li><strong>Interpretation:</strong> Any ambiguity in this BAA shall be resolved in favor of a meaning that permits the Parties to comply with the HIPAA Rules.</li>
              <li><strong>Survival:</strong> The obligations of Business Associate under Section 8 (Term and Termination) shall survive termination of this BAA.</li>
              <li><strong>No Third-Party Beneficiaries:</strong> Nothing in this BAA shall confer any rights or remedies upon any person other than the Parties and their respective successors and permitted assigns.</li>
              <li><strong>Governing Law:</strong> This BAA shall be governed by applicable federal law, including HIPAA and HITECH, and the laws of the state in which Covered Entity&apos;s principal place of business is located.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">10. Acceptance</h2>
            <p>
              By checking the &ldquo;I accept the Business Associate Agreement&rdquo; checkbox during account creation, or by clicking &ldquo;Accept BAA&rdquo; in the Claima application, Covered Entity agrees to be bound by the terms of this BAA. The person accepting on behalf of the Covered Entity represents and warrants that they have authority to bind the Covered Entity.
            </p>
            <p>
              This electronic acceptance constitutes a valid and binding agreement under the Electronic Signatures in Global and National Commerce Act (E-SIGN) and applicable state laws on electronic signatures.
            </p>
          </section>

          <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400">
            <p>Questions about this BAA? Contact <a href="mailto:legal@claima.io" className="text-blue-600 hover:underline">legal@claima.io</a></p>
            <p className="mt-1">This document was last updated {effective}.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
