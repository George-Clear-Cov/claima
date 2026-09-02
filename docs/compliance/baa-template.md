<!--
▲▲▲ INTERNAL — DELETE THIS BLOCK BEFORE SENDING TO A PRACTICE ▲▲▲

STATUS: Execution-ready draft. **Healthcare-attorney review still required before first signature.**
Based on the HHS model BAA provisions (45 CFR §164.504(e)) plus Claima-specific terms.

BEFORE YOU SEND, FILL IN / CONFIRM:
  1. §Preamble — Business Associate legal name. As of 2026-08-31 the NY DOS registry shows
     **PATHFINDER PROJECTS LLC** (DOS ID 7249876, Active). The Certificate of Amendment to
     "Claima LLC" was decided but NEVER FILED. Do not sign as "Claima LLC" until the amendment
     is filed and confirmed. Re-check the registry before every signature.
  2. Exhibit A — must match production on the day you send it. Delete any row whose subprocessor
     BAA is not executed and dated. If the app is still on Vercel/Supabase at signature, those
     are the hosting/database subprocessors and must be listed (with executed BAAs) instead of
     Azure. Never transmit PHI to a subprocessor that is not listed here.
  3. Exhibit B — every control listed is live as of 2026-08-31 (MFA, idle timeout, SSO, audit
     log, tenant isolation, export/delete, PHI scrubbing). Re-verify before each send; strike
     anything that regresses.
  4. §13.7 Governing law — defaults to the MSA; New York fallback.
  5. Notice addresses in Exhibit C.
  6. ~~Exhibit A [DATE] on the two Microsoft rows~~ — ✅ RESOLVED 2026-09-02. Microsoft Customer
     Agreement **B1810932D4F5, effective 2026-07-10** (from `az billing agreement list`). The
     HIPAA BAA attaches to that agreement automatically, so this is the date for both Microsoft
     rows — not any resource creation date.
  7. Azure OpenAI is a STANDBY (AI_PROVIDER=bedrock). If it is not the active provider on the day
     you send this, either strike its row or keep it and disclose it as standby — but never send
     an Exhibit A that omits a provider PHI can actually reach.

  NOT IN THIS DOCUMENT ON PURPOSE (do not re-add until true):
  - Insurance covenant — cyber/E&O is not bound. Add a §12 Insurance clause only once a policy
    is in force and you can produce a certificate.
  - SOC 2 / HITRUST / penetration-test attestations — none exist. §10.2 only obligates you to
    share attestations you actually maintain.

  MUST BE TRUE BEFORE FIRST SIGNATURE (obligations the document creates):
  - §4.3 workforce HIPAA training — must be conducted and logged before anyone touches PHI.
    Even for a one-person workforce. See officer-designation-and-training.md.
  - §11(b) written policies + designated Privacy/Security Officer — drafted; needs effective dates.
  - §11(c) federal exclusion screening — run the OIG LEIE / SAM.gov check and keep the result.

VARIANTS:
  - Click-through version lives at src/app/baa/page.tsx (/baa). Keep the two in sync — see the
    drift notes in docs/compliance/README.md.
  - Downstream (subcontractor) BAA: swap the parties so Claima is the "Covered Entity"-side
    discloser and the vendor is the Business Associate; §164.504(e)(5) requires the same terms.

▲▲▲ END INTERNAL BLOCK ▲▲▲
-->

# BUSINESS ASSOCIATE AGREEMENT

This Business Associate Agreement (this **"Agreement"**) is entered into as of
**[EFFECTIVE DATE]** (the **"Effective Date"**) by and between:

**[PRACTICE LEGAL NAME]**, a [STATE] [ENTITY TYPE], with its principal place of business at
[ADDRESS] (**"Covered Entity"**); and

**[PATHFINDER PROJECTS LLC]**, a New York limited liability company doing business as
**Claima**, with its principal place of business at [ADDRESS] (**"Business Associate"** or
**"Claima"**).

Covered Entity and Business Associate are each a **"Party"** and together the **"Parties."**

## Recitals

**A.** Covered Entity is a "covered entity" (or a business associate acting on behalf of a
covered entity) as defined under the Health Insurance Portability and Accountability Act of
1996, Public Law 104-191, as amended by the Health Information Technology for Economic and
Clinical Health Act (the "HITECH Act") of the American Recovery and Reinvestment Act of 2009,
and the regulations promulgated thereunder at 45 C.F.R. Parts 160 and 164 (collectively, the
**"HIPAA Rules"**).

**B.** The Parties have entered into, or will enter into, a services agreement, order form,
statement of work, or online terms of service (the **"Services Agreement"**) under which
Business Associate provides revenue-cycle management services to Covered Entity, which may
include claim scrubbing and submission, eligibility and benefits verification, denial
management and appeals, remittance posting, patient statements and payment collection, coding
support, analytics, and related services (the **"Services"**).

**C.** In performing the Services, Business Associate will create, receive, maintain, or
transmit Protected Health Information on behalf of Covered Entity, and therefore acts as a
"business associate" as defined at 45 C.F.R. § 160.103.

**D.** The Parties enter into this Agreement to comply with 45 C.F.R. §§ 164.502(e) and
164.504(e), and to set out the terms on which Business Associate may handle Protected Health
Information.

NOW, THEREFORE, in consideration of the mutual promises below and the exchange of information
under the Services Agreement, the Parties agree as follows.

---

## 1. Definitions

**1.1** Capitalized terms used but not otherwise defined in this Agreement have the meanings
given to them in the HIPAA Rules, including but not limited to: *Breach*, *Data Aggregation*,
*Designated Record Set*, *Disclosure*, *Health Care Operations*, *Individual*, *Minimum
Necessary*, *Notice of Privacy Practices*, *Required By Law*, *Secretary*, *Security Incident*,
*Subcontractor*, *Unsecured Protected Health Information*, and *Use*.

**1.2 "PHI"** means Protected Health Information, as defined at 45 C.F.R. § 160.103, that is
created, received, maintained, or transmitted by Business Associate from or on behalf of
Covered Entity. **"ePHI"** means PHI maintained or transmitted in electronic media.

**1.3 "Privacy Rule"** means 45 C.F.R. Part 160 and Part 164, Subparts A and E.
**"Security Rule"** means 45 C.F.R. Part 160 and Part 164, Subparts A and C.
**"Breach Notification Rule"** means 45 C.F.R. Part 164, Subpart D.

**1.4 "Subprocessor"** means a Subcontractor of Business Associate that creates, receives,
maintains, or transmits PHI on behalf of Business Associate in connection with the Services.
The Subprocessors engaged as of the Effective Date are listed in **Exhibit A**.

**1.5 "AI Services"** means machine-learning, large-language-model, or other automated
inference capabilities used by Business Associate in performing the Services, as further
described in **Section 3**.

---

## 2. Permitted Uses and Disclosures by Business Associate

**2.1 Performance of the Services.** Business Associate may Use and Disclose PHI as necessary
to perform the Services for, or on behalf of, Covered Entity, provided that such Use or
Disclosure would not violate the Privacy Rule if done by Covered Entity, except as permitted by
Sections 2.3, 2.4, and 2.5.

**2.2 Required By Law.** Business Associate may Use or Disclose PHI as Required By Law.
Business Associate will, to the extent legally permitted, notify Covered Entity in advance of
any such Disclosure so that Covered Entity may seek a protective order or other relief.

**2.3 Management and Administration.** Business Associate may Use PHI for the proper management
and administration of Business Associate or to carry out its legal responsibilities. Business
Associate may Disclose PHI for such purposes only if (a) the Disclosure is Required By Law, or
(b) Business Associate obtains reasonable assurances from the recipient, in writing, that the
PHI will be held confidentially and Used or further Disclosed only as Required By Law or for
the purpose for which it was disclosed, and that the recipient will notify Business Associate
of any breach of confidentiality of which it becomes aware.

**2.4 Data Aggregation.** Business Associate may Use and Disclose PHI to provide Data
Aggregation services relating to the Health Care Operations of Covered Entity, as permitted by
45 C.F.R. § 164.504(e)(2)(i)(B).

**2.5 De-Identification and Aggregate Analytics.** Covered Entity expressly authorizes Business
Associate to Use PHI to create de-identified information in accordance with 45 C.F.R.
§ 164.514(a)–(b), as permitted by 45 C.F.R. § 164.502(d)(1). Information de-identified in
accordance with that standard is not PHI and is not subject to this Agreement. Business
Associate's rights in de-identified information survive termination of this Agreement. Business
Associate covenants that, with respect to information de-identified from Covered Entity's PHI:

   (a) it will not attempt to re-identify the information or contact any Individual, and will
       contractually prohibit any recipient from doing so;
   (b) it will not disclose, publish, or make available any de-identified data set, benchmark,
       statistic, or model output in a form that identifies Covered Entity, any of Covered
       Entity's providers, or any Individual, without Covered Entity's prior written consent;
   (c) any external benchmark or industry statistic derived in part from Covered Entity's data
       will be aggregated across a minimum of [FIVE (5)] contributing organizations; and
   (d) it will not sell de-identified information derived from Covered Entity's PHI to any data
       broker, payer, pharmaceutical manufacturer, or life-sciences purchaser without Covered
       Entity's prior written consent.

**2.6 Report of Violations.** Business Associate may Use and Disclose PHI to report violations
of law to appropriate federal and state authorities, consistent with 45 C.F.R.
§ 164.502(j)(1).

**2.7 Prohibited Uses and Disclosures.** Notwithstanding anything to the contrary, Business
Associate will not:

   (a) Use or Disclose PHI in a manner that would violate Subpart E of 45 C.F.R. Part 164 if
       done by Covered Entity, except as permitted by Sections 2.3, 2.4, and 2.5;
   (b) sell PHI or receive direct or indirect remuneration in exchange for PHI, except as
       permitted by 45 C.F.R. § 164.502(a)(5)(ii);
   (c) Use or Disclose PHI for marketing or fundraising purposes, or for any purpose requiring
       an Individual's authorization under 45 C.F.R. § 164.508, without such authorization;
   (d) Use or Disclose PHI for Business Associate's own research, product marketing, or
       commercial purposes, except as expressly permitted by Sections 2.4 and 2.5; or
   (e) Use, Disclose, store, or permit access to PHI outside of the United States, or by
       personnel or Subprocessors located outside of the United States, without Covered
       Entity's prior written consent.

**2.8 Minimum Necessary.** Business Associate will request, Use, and Disclose only the Minimum
Necessary PHI to accomplish the intended purpose of the request, Use, or Disclosure, consistent
with 45 C.F.R. §§ 164.502(b) and 164.514(d) and any guidance issued by the Secretary.

---

## 3. Artificial Intelligence and Automated Processing

**3.1 Disclosure of AI Use.** Covered Entity acknowledges that Business Associate uses AI
Services to perform portions of the Services, including without limitation denial
classification, appeal-letter drafting, coding and documentation review, eligibility
interpretation, and remittance analysis. PHI may be transmitted to and processed by the AI
Service providers identified in **Exhibit A**.

**3.2 BAA-Covered Infrastructure Only.** Business Associate will transmit PHI only to AI Service
providers with which Business Associate has an executed business associate agreement, and only
through service configurations that the provider has designated as eligible for use with PHI.
Business Associate's systems are configured to block the transmission of PHI to any AI Service
provider that is not so covered.

**3.3 No Model Training on PHI.** Business Associate will not Use PHI, and will contractually
require that its AI Service providers do not Use PHI, to train, fine-tune, or otherwise improve
any foundation model, general-purpose model, or model made available to any third party.
Business Associate may Use de-identified information created under Section 2.5 to develop and
improve the Services, including to tune models made available solely to Business Associate.

**3.4 No Retention by AI Providers.** Business Associate will configure its AI Services so that
prompts and outputs containing PHI are not retained by the AI Service provider beyond the
period necessary to return the inference result, except where retention is required for abuse
monitoring under terms covered by the applicable business associate agreement.

**3.5 Human Oversight; No Clinical Decision-Making.** The AI Services support administrative and
revenue-cycle functions only. They do not provide medical advice, diagnosis, or treatment
recommendations, and are not a substitute for the professional judgment of Covered Entity's
providers. Covered Entity remains solely responsible for the medical necessity, accuracy, and
propriety of the services it renders and documents, and for the final content of any claim,
appeal, or attestation submitted under its provider identifiers. Business Associate will
maintain a mechanism for human review of AI-generated output prior to external submission where
required by the Services Agreement.

**3.6 Auditability.** Business Associate will log AI-assisted actions performed on Covered
Entity's data sufficient to identify the action taken, the time, and the acting user or system
process, and will make such logs available to Covered Entity on reasonable request.

---

## 4. Obligations of Business Associate

Business Associate will:

**4.1 Safeguards.** Implement and maintain administrative, physical, and technical safeguards
that reasonably and appropriately protect the confidentiality, integrity, and availability of
PHI, and comply with Subpart C of 45 C.F.R. Part 164 with respect to ePHI, including the
requirements at 45 C.F.R. §§ 164.308, 164.310, 164.312, and 164.316. A summary of Business
Associate's current safeguards is attached as **Exhibit B**.

**4.2 Risk Analysis.** Conduct and document an accurate and thorough assessment of the potential
risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI it holds,
and implement security measures sufficient to reduce those risks to a reasonable and
appropriate level, reviewed at least annually and upon material change to its environment.

**4.3 Workforce.** Limit access to PHI to those workforce members who require it to perform the
Services; train each such workforce member on HIPAA and on Business Associate's privacy and
security policies prior to granting access and at least annually thereafter; and apply
appropriate sanctions against workforce members who fail to comply.

**4.4 Mitigation.** Mitigate, to the extent practicable, any harmful effect known to Business
Associate of a Use or Disclosure of PHI by Business Associate in violation of this Agreement.

**4.5 Individual Access (§ 164.524).** Within **ten (10) business days** of a written request
from Covered Entity, make available PHI in a Designated Record Set maintained by Business
Associate as necessary to satisfy Covered Entity's obligations under 45 C.F.R. § 164.524,
including in the electronic form and format requested where readily producible. If an
Individual submits such a request directly to Business Associate, Business Associate will
forward it to Covered Entity within **five (5) business days** and will not respond directly
unless directed by Covered Entity.

**4.6 Amendment (§ 164.526).** Within **ten (10) business days** of a written request from
Covered Entity, make any amendment to PHI in a Designated Record Set that Covered Entity directs
or agrees to pursuant to 45 C.F.R. § 164.526.

**4.7 Accounting of Disclosures (§ 164.528).** Document Disclosures of PHI and information
related to such Disclosures as would be required for Covered Entity to respond to a request for
an accounting under 45 C.F.R. § 164.528, and provide such documentation to Covered Entity within
**ten (10) business days** of a written request.

**4.8 Restrictions and Confidential Communications.** Comply with any restriction on the Use or
Disclosure of PHI, and any request for confidential communications, that Covered Entity
communicates to Business Associate in writing pursuant to 45 C.F.R. §§ 164.522 and 164.520.

**4.9 Availability to the Secretary.** Make its internal practices, books, and records relating
to the Use and Disclosure of PHI available to the Secretary for purposes of determining Covered
Entity's compliance with the HIPAA Rules, and notify Covered Entity of any such request unless
prohibited from doing so.

**4.10 Covered Entity Obligations.** To the extent Business Associate is to carry out one or
more of Covered Entity's obligations under Subpart E of 45 C.F.R. Part 164, comply with the
requirements of Subpart E that apply to Covered Entity in the performance of such obligation(s).

**4.11 Direct Liability.** Business Associate acknowledges that it is directly liable under the
HIPAA Rules for compliance with the provisions applicable to business associates, including
under HITECH Act §§ 13401 and 13404.

---

## 5. Reporting: Breaches, Security Incidents, and Improper Use or Disclosure

**5.1 Notice of Breach.** Business Associate will notify Covered Entity of any Breach of
Unsecured PHI without unreasonable delay and in no case later than **five (5) business days**
after Discovery, as "discovery" is determined under 45 C.F.R. § 164.410(a)(2).

**5.2 Notice of Improper Use or Disclosure.** Business Associate will report to Covered Entity
any Use or Disclosure of PHI not permitted by this Agreement of which it becomes aware, and any
Security Incident that results in unauthorized access to, or the acquisition, use, disclosure,
modification, or destruction of, ePHI, without unreasonable delay and in no case later than
**five (5) business days** after Business Associate becomes aware of it.

**5.3 Content of Notice.** Each notice under Section 5.1 or 5.2 will include, to the extent then
known and with supplemental information provided promptly as it becomes available (and in any
event within **fifteen (15) calendar days**): the identification of each Individual whose PHI
was or is reasonably believed to have been accessed, acquired, Used, or Disclosed; a description
of what happened, including the date of the incident and the date of Discovery; the types of PHI
involved; the steps Business Associate has taken to investigate, mitigate harm, and protect
against further incidents; and any other information Covered Entity is required to include in
its notification to Individuals under 45 C.F.R. § 164.404(c).

**5.4 Unsuccessful Security Incidents.** The Parties acknowledge that unsuccessful attempts at
unauthorized access to ePHI — including pings and other broadcast attacks on firewalls, port
scans, unsuccessful log-on attempts, denial-of-service attacks, and malware that is blocked and
does not result in unauthorized access — occur routinely and result in no unauthorized access,
Use, or Disclosure of ePHI. This Section constitutes notice of such unsuccessful attempts, and
no additional notice is required, provided that Business Associate maintains records of such
attempts and makes summary reports available to Covered Entity on reasonable request.

**5.5 Cooperation and Cost.** Business Associate will cooperate with Covered Entity in
investigating any Breach and in meeting Covered Entity's obligations under the Breach
Notification Rule and applicable state law. Covered Entity retains sole authority to determine
whether and how notification to Individuals, the Secretary, and the media will be made. Where
the Breach arises from Business Associate's or its Subprocessor's act or omission, Business
Associate will bear the reasonable and documented costs of investigation, forensic analysis,
notification to affected Individuals, and credit monitoring for the period required by applicable
law. Business Associate's obligations under this Section are subject to the limitation of
liability set out in the Services Agreement.

**5.6 Security Contact.** Notices under this Section will be given to the contacts identified in
**Exhibit C** and, in the case of notice to Business Associate, may be given concurrently to
Business Associate's Security Officer.

---

## 6. Subprocessors

**6.1 Written Agreements.** In accordance with 45 C.F.R. §§ 164.502(e)(1)(ii) and 164.308(b)(2),
Business Associate will ensure that each Subprocessor that creates, receives, maintains, or
transmits PHI on Business Associate's behalf agrees in writing to restrictions and conditions
at least as protective as those that apply to Business Associate under this Agreement, prior to
that Subprocessor receiving any PHI.

**6.2 Current List; Changes.** Exhibit A lists the Subprocessors engaged as of the Effective
Date. Business Associate will maintain a current list of Subprocessors and make it available to
Covered Entity on request. Business Associate will give Covered Entity at least **thirty (30)
days'** prior written notice (which may be by email to the contact in Exhibit C) before engaging
a new Subprocessor that will handle PHI. If Covered Entity reasonably objects on
privacy-or-security grounds within that period, the Parties will work in good faith to resolve
the objection; if they cannot, Covered Entity may terminate the affected Services without
penalty.

**6.3 Responsibility.** Business Associate remains fully responsible to Covered Entity for the
acts and omissions of its Subprocessors with respect to PHI to the same extent as for its own
acts and omissions.

**6.4 Payment Processors.** The Parties acknowledge that entities that process payment
transactions solely to authorize, clear, settle, bill, transfer, reconcile, or collect
payments — and that do not otherwise create, receive, maintain, or transmit PHI on Business
Associate's behalf — are excluded from the definition of "business associate" under
45 C.F.R. § 160.103 and are addressed by the exception at HIPAA § 1179. Such entities are not
required to be listed in Exhibit A as Subprocessors, and are identified there for transparency
only.

---

## 7. Obligations of Covered Entity

**7.1** Covered Entity will notify Business Associate of any limitation(s) in its Notice of
Privacy Practices under 45 C.F.R. § 164.520, and of any changes to or revocation of an
Individual's permission to Use or Disclose PHI, to the extent such limitation, change, or
revocation may affect Business Associate's Use or Disclosure of PHI.

**7.2** Covered Entity will notify Business Associate of any restriction on the Use or
Disclosure of PHI that Covered Entity has agreed to or is required to abide by under
45 C.F.R. § 164.522, to the extent it may affect Business Associate's Use or Disclosure of PHI.

**7.3** Covered Entity will not request or direct Business Associate to Use or Disclose PHI in
any manner that would not be permissible under the HIPAA Rules if done by Covered Entity, except
as permitted by Sections 2.3, 2.4, and 2.5 of this Agreement.

**7.4** Covered Entity is responsible for obtaining any consents, authorizations, or
acknowledgements required under the HIPAA Rules or applicable state law for the Disclosure of
PHI to Business Associate and for Business Associate's performance of the Services, and for the
accuracy and completeness of the PHI and other data it, its providers, or its systems transmit
to Business Associate.

**7.5** Covered Entity will transmit PHI to Business Associate only through the secure methods
and interfaces designated by Business Associate, and will implement reasonable safeguards to
protect PHI prior to transmission.

---

## 8. Term and Termination

**8.1 Term.** This Agreement takes effect on the Effective Date and continues until the later of
(a) termination of the Services Agreement, or (b) the date on which all PHI is returned or
destroyed in accordance with Section 9, or protections are extended to it under Section 9.3.

**8.2 Termination for Cause by Covered Entity.** Upon Covered Entity's knowledge of a material
breach of this Agreement by Business Associate, Covered Entity will either (a) provide an
opportunity for Business Associate to cure the breach or end the violation, and terminate this
Agreement and the Services Agreement if Business Associate does not cure within **thirty (30)
days**; (b) immediately terminate this Agreement and the Services Agreement if cure is not
feasible; or (c) if neither termination nor cure is feasible, report the violation to the
Secretary.

**8.3 Termination for Cause by Business Associate.** Business Associate may terminate this
Agreement on the same basis set out in Section 8.2 if it knows of a pattern of activity or
practice by Covered Entity that constitutes a material breach of Covered Entity's obligations
under this Agreement.

**8.4 Effect on Services Agreement.** Termination of this Agreement automatically terminates the
Services Agreement, and termination of the Services Agreement terminates this Agreement subject
to Section 8.1 and the surviving provisions of Section 13.9.

---

## 9. Return or Destruction of PHI

**9.1 On Termination.** Within **thirty (30) days** after termination or expiration of this
Agreement, Business Associate will, at Covered Entity's written election, return to Covered
Entity or destroy all PHI that Business Associate or its Subprocessors still maintain in any
form, and retain no copies. Return will be made in a commercially reasonable, machine-readable
electronic format. If Covered Entity makes no election within **thirty (30) days** of
termination, Business Associate will make a complete export available to Covered Entity and,
after a further **thirty (30) days**, may destroy the PHI.

**9.2 Certification.** Business Associate will certify the destruction of PHI in writing upon
Covered Entity's request, describing the method of destruction, which will conform to
NIST SP 800-88 media-sanitization guidance or equivalent.

**9.3 Infeasibility.** If return or destruction of any PHI is infeasible — including PHI
contained in backups, archives, or audit logs that cannot be selectively deleted, or PHI that
Business Associate is Required By Law to retain — Business Associate will notify Covered Entity
in writing of the conditions that make return or destruction infeasible, will extend the
protections of this Agreement to such PHI, and will limit further Uses and Disclosures to those
purposes that make return or destruction infeasible, for so long as it retains the PHI. Backup
media containing PHI will be destroyed on Business Associate's ordinary backup rotation schedule
of no more than **[NINETY (90)] days**.

**9.4 Retention Notwithstanding.** Nothing in this Section requires Business Associate to delete
(a) de-identified information created under Section 2.5, or (b) audit logs, transaction records,
and other records that Business Associate is required to maintain under 45 C.F.R. § 164.316(b)
or other applicable law, which will be retained in accordance with such law and protected in
accordance with this Agreement.

---

## 10. Records and Audit

**10.1 Documentation.** Business Associate will maintain the policies, procedures, and
documentation required by 45 C.F.R. § 164.316 for **six (6) years** from the date of creation or
the date last in effect, whichever is later.

**10.2 Covered Entity Review.** No more than once in any twelve (12)-month period (and at any
time following a Breach affecting Covered Entity's PHI), upon **thirty (30) days'** prior
written notice, Business Associate will provide Covered Entity with a written response to a
reasonable security questionnaire and copies of its then-current risk analysis summary, security
policies, and any third-party audit or penetration-test attestations it maintains. Any on-site
review will be at Covered Entity's expense, during normal business hours, subject to Business
Associate's confidentiality and security requirements, and will not extend to the data of
Business Associate's other customers.

---

## 11. Representations and Warranties

Business Associate represents and warrants that: (a) it has the authority to enter into this
Agreement; (b) it has implemented and will maintain a HIPAA compliance program including written
privacy, security, and breach-notification policies, a designated Privacy Officer and Security
Officer, and a workforce training program; (c) it is not currently excluded, debarred, or
otherwise ineligible to participate in any federal health care program, and no person with an
ownership or control interest in, or employed or contracted by, Business Associate is so
excluded, and it will notify Covered Entity within **five (5) business days** if this ceases to
be true; and (d) it will perform the Services in compliance with applicable law, including the
HIPAA Rules and, to the extent applicable to its performance, the federal Anti-Kickback Statute
(42 U.S.C. § 1320a-7b(b)) and the False Claims Act (31 U.S.C. §§ 3729–3733).

---

## 12. Indemnification

Each Party (the "Indemnifying Party") will indemnify, defend, and hold harmless the other Party
and its officers, directors, employees, and agents from and against any third-party claims,
liabilities, fines, penalties, damages, and reasonable costs and attorneys' fees arising out of
or relating to (a) the Indemnifying Party's breach of this Agreement, or (b) any Use or
Disclosure of PHI by the Indemnifying Party in violation of the HIPAA Rules. The indemnified
Party will give prompt written notice of any claim, permit the Indemnifying Party to control the
defense, and cooperate reasonably at the Indemnifying Party's expense. This Section is subject
to any limitation of liability set out in the Services Agreement, **except** that no limitation
of liability in the Services Agreement will apply to a Party's obligations under this Section
with respect to a Breach caused by that Party's gross negligence or willful misconduct.

---

## 13. General Provisions

**13.1 Regulatory References.** A reference in this Agreement to a section of the HIPAA Rules
means the section as in effect or as amended, and for which compliance is required.

**13.2 Amendment.** The Parties agree to take such action as is necessary to amend this
Agreement from time to time as is necessary for the Parties to comply with the requirements of
the HIPAA Rules and other applicable law. Any such amendment, and any other amendment to this
Agreement, must be in writing and signed by both Parties, except that Business Associate may
update Exhibits A and B by written notice to Covered Entity in accordance with Section 6.2.

**13.3 Interpretation.** Any ambiguity in this Agreement will be resolved to permit the Parties
to comply with the HIPAA Rules.

**13.4 Order of Precedence.** In the event of a conflict between this Agreement and the Services
Agreement (including any online terms of service) with respect to the Use, Disclosure, or
protection of PHI, this Agreement controls. In all other respects the Services Agreement
controls.

**13.5 Notices.** Notices under this Agreement must be in writing and delivered to the addresses
in **Exhibit C** by personal delivery, nationally recognized overnight courier, certified mail
(return receipt requested), or email with confirmation of receipt, and are effective upon
receipt. Notices under Section 5 may be given by email in the first instance.

**13.6 No Third-Party Beneficiaries.** Nothing in this Agreement confers any rights, remedies,
obligations, or liabilities upon any person other than the Parties and their respective
successors and permitted assigns.

**13.7 Governing Law.** This Agreement is governed by federal law, including the HIPAA Rules,
and otherwise by the governing law designated in the Services Agreement, without regard to its
conflict-of-laws principles. If the Services Agreement designates no governing law, this
Agreement is governed by the laws of the State of New York.

**13.8 Assignment.** Neither Party may assign this Agreement without the other Party's prior
written consent, except that either Party may assign it to a successor in connection with a
merger, acquisition, or sale of substantially all of its assets, provided the successor assumes
all obligations under this Agreement in writing and the assigning Party gives written notice.

**13.9 Survival.** Sections 2.5 (De-Identification), 5 (Reporting, as to incidents discovered
before or after termination), 9 (Return or Destruction), 10 (Records and Audit),
12 (Indemnification), and 13 survive termination or expiration of this Agreement.

**13.10 Severability.** If any provision of this Agreement is held invalid or unenforceable, the
remaining provisions remain in full force, and the invalid provision will be modified to the
minimum extent necessary to make it enforceable while preserving its intent.

**13.11 Independent Contractors.** Nothing in this Agreement creates a partnership, joint
venture, employment, or agency relationship between the Parties. Neither Party has authority to
bind the other.

**13.12 Entire Agreement; Counterparts.** This Agreement, together with its Exhibits and the
Services Agreement, constitutes the entire agreement of the Parties regarding PHI and supersedes
all prior business associate agreements between them. It may be executed in counterparts,
including by electronic signature, each of which is an original and all of which together
constitute one instrument. The Parties agree that electronic signatures and electronic
acceptance constitute valid and binding execution under the Electronic Signatures in Global and
National Commerce Act (E-SIGN), 15 U.S.C. § 7001 et seq., and applicable state law.

---

## Signatures

IN WITNESS WHEREOF, the Parties have executed this Business Associate Agreement as of the
Effective Date.

<table>
<tr><td width="50%" valign="top">

**COVERED ENTITY**

[PRACTICE LEGAL NAME]

By: ______________________________

Name: ____________________________

Title: ___________________________

Date: ____________________________

</td><td width="50%" valign="top">

**BUSINESS ASSOCIATE**

[PATHFINDER PROJECTS LLC] d/b/a Claima

By: ______________________________

Name: George Nagib

Title: ___________________________

Date: ____________________________

</td></tr>
</table>

---

# EXHIBIT A — Subprocessors

*Current as of [DATE]. Business Associate maintains an updated list at claima.io/subprocessors
and will provide notice of changes under Section 6.2.*

## A-1. Subprocessors that handle PHI

*No entity may be listed in this table, or receive PHI, until a business associate agreement with
it is in force. A BAA counts as in force whether separately signed, accepted self-serve, or
incorporated into the vendor's standard terms — but in every case you must be able to produce a
copy and an effective date on request. Complete the "BAA in force" column before this Agreement is
signed, and delete any row you cannot evidence.*

| Subprocessor | Role in the Services | PHI handled | Location | BAA in force |
|---|---|---|---|---|
| Microsoft Corporation (Azure) | Application hosting, database, secrets management, transactional email (Azure Communication Services) | All PHI processed by the platform | United States | **July 10, 2026** (Microsoft Customer Agreement B1810932D4F5; HIPAA BAA incorporated via the Product Terms/DPA) |
| Amazon Web Services, Inc. (Amazon Bedrock) | AI inference for denial classification, appeal drafting, coding review | Claim, denial, and clinical-documentation excerpts contained in prompts | United States | **August 31, 2026** (AWS BAA, Artifact, acct 008482603773) |
| Microsoft Corporation (Azure OpenAI Service) | AI inference — same functions as above; configured as a standby to Amazon Bedrock | Claim, denial, and clinical-documentation excerpts contained in prompts | United States (West US 3; deployed on a US-data-zone SKU, not global routing) | **July 10, 2026** — same Microsoft Customer Agreement B1810932D4F5 as the Azure row above |
| Claim.MD, Inc. | Clearinghouse — claim submission (837), remittance (835), eligibility (270/271) | Claim, patient demographic, and coverage data | United States | **July 1, 2026** (BAA on file, Claim.MD acct 31008) |

*Microsoft BAA basis.* Microsoft's HIPAA Business Associate Agreement is incorporated into the
Microsoft Product Terms / Data Protection Addendum and takes effect automatically with the Azure
agreement — there is no separate instrument to sign. Azure OpenAI Service is a HIPAA-eligible
service thereunder **for production, text-based inference only**; preview features and non-text
models (image, speech) are outside that scope and must not receive PHI.

*AI inference providers — retention disclosure (Section 3.4).* Amazon Bedrock does not retain
prompts or completions. Azure OpenAI Service applies standard abuse monitoring, under which
prompts and completions are retained for up to thirty (30) days **within Business Associate's own
Azure region and subscription**, are not accessible to OpenAI or to Microsoft product teams, and
are used solely to detect misuse. Business Associate treats this as retention "required for abuse
monitoring under terms covered by the applicable business associate agreement" within the meaning
of Section 3.4. Only one AI provider processes PHI at a time; the active provider is disclosed on
request.

## A-2. Not a Subprocessor — payment processing (HIPAA § 1179)

| Entity | Role | Data received |
|---|---|---|
| Stripe, Inc. | Patient payment authorization, clearing, and settlement | Payment amount, opaque internal identifiers, and payer/patient name only. **No diagnosis, procedure, date of service, date of birth, or member identifier is transmitted.** |

Stripe performs payment-processing activities excepted from HIPAA under § 1179 and does not
create, receive, maintain, or transmit PHI on Business Associate's behalf. It is listed for
transparency and is not a Subprocessor under Section 6.

## A-3. Not a Subprocessor — PHI excluded by design

| Entity | Role | Controls |
|---|---|---|
| Functional Software, Inc. (Sentry) | Application error monitoring | PHI is stripped from event payloads before transmission by server-side scrubbing rules. |

---

# EXHIBIT B — Security Measures

*Summary of the administrative, physical, and technical safeguards Business Associate maintains
under Section 4.1. Provided for Covered Entity's due diligence; the controlling obligation is
compliance with the Security Rule.*

## Administrative
- Designated Privacy Officer and Security Officer (45 C.F.R. §§ 164.308(a)(2), 164.530(a)).
- Documented security risk analysis and risk-management plan, reviewed at least annually and on
  material change (§ 164.308(a)(1)).
- Written privacy, security, incident-response, and breach-notification policies (§ 164.316).
- Workforce HIPAA and security training at onboarding and annually, with a documented sanction
  policy (§§ 164.308(a)(5), 164.530(e)).
- Least-privilege access provisioning, with access reviewed on role change and revoked on
  termination (§ 164.308(a)(3), (a)(4)).
- Written agreements with all Subprocessors that handle PHI (§ 164.308(b)).

## Physical
- No PHI is stored on office or local hardware; all PHI resides in HIPAA-eligible cloud
  infrastructure operated by the Subprocessors in Exhibit A.
- Cloud data centers maintain SOC 2 Type II and ISO 27001 physical-security programs.
- Workforce devices require full-disk encryption and automatic screen lock.

## Technical
- **Encryption:** TLS 1.2 or higher in transit; AES-256 at rest. HSTS enforced on all web
  endpoints (§ 164.312(a)(2)(iv), (e)).
- **Access control:** unique per-user credentials, role-based authorization (Admin / Biller),
  enforced password complexity, failed-login lockout, and single sign-on via Microsoft Entra ID
  (§ 164.312(a)).
- **Automatic logoff:** idle session timeout with warning (§ 164.312(a)(2)(iii)).
- **Tenant isolation:** every record is scoped to a single practice; cross-practice access is
  structurally prevented and verified by recurring automated audits.
- **Audit controls:** every access to and modification of PHI is recorded with actor, action,
  timestamp, and source IP, retained per Business Associate's retention policy
  (§ 164.312(b)).
- **Integrity and transmission security:** input validation on all data-entry points; rate
  limiting on public endpoints (§ 164.312(c), (e)).
- **AI safeguards:** PHI is programmatically blocked from transmission to any AI provider not
  covered by an executed business associate agreement (see Section 3.2).
- **Data portability and deletion:** self-service full export and hard-delete of all practice
  PHI, supporting Sections 4.5 and 9.

*Controls are reviewed and updated as the platform evolves; Business Associate will not reduce
the overall level of protection provided during the term of this Agreement.*

---

# EXHIBIT C — Notice Contacts

| | Covered Entity | Business Associate |
|---|---|---|
| **Entity** | [PRACTICE LEGAL NAME] | [PATHFINDER PROJECTS LLC] d/b/a Claima |
| **Attn (legal notices)** | [NAME, TITLE] | George Nagib, Managing Member |
| **Address** | [ADDRESS] | [ADDRESS] |
| **Email (legal)** | [EMAIL] | legal@claima.io |
| **Privacy Officer** | [NAME / EMAIL] | George Nagib — privacy@claima.io |
| **Security Officer / incident reporting** | [NAME / EMAIL] | George Nagib — security@claima.io |
| **Incident hotline** | [PHONE] | [PHONE] |

---

*This Business Associate Agreement is based on the model business associate agreement provisions
published by the U.S. Department of Health and Human Services (45 C.F.R. § 164.504(e)),
supplemented with terms specific to the Services. It is not legal advice and should be reviewed
by counsel for each Party.*
