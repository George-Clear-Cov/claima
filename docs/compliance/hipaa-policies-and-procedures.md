# HIPAA Policies & Procedures Manual — Claima (Business Associate)

> **Draft for internal review; not legal advice — have healthcare counsel review before use.**
> Statements below describe the standard Claima commits to and enforces **before any
> production PHI is processed**. Items marked **(in progress)** are not yet complete and must
> not be represented as done. Replace every `[FILL IN: …]` before finalizing.

**Business Associate:** Claima LLC ("Claima"), a New York limited liability company.
**HIPAA role:** Business Associate (BA). Claima creates, receives, maintains, and transmits
Protected Health Information (PHI) on behalf of provider practices (Covered Entities) to
perform claim submission, denial management, eligibility verification, and patient billing.
**Security Officer AND Privacy Officer:** George Nagib — support@claima.io, [FILL IN: phone].
**Regulatory scope:** HIPAA Privacy, Security, and Breach Notification Rules and the HITECH
Act (45 CFR Parts 160 and 164), as applicable to a Business Associate.

---

## Policy governance

- **Owner:** George Nagib, Security & Privacy Officer, is accountable for this manual, its
  procedures, and enforcement.
- **Applicability:** all Claima workforce members (employees, contractors, and anyone acting
  under Claima's authority) who may access PHI or systems that process PHI.
- **Review cadence:** reviewed and updated **at least annually** and **upon any significant
  change** (new subprocessor, material system/architecture change, security incident, or
  regulatory change). Revisions are versioned and dated in the block at the end of this document.
- **Related documents:** *Security & HIPAA Overview*, *HIPAA Security Risk Assessment*, the
  *Business Associate Agreement* template, and the *Incident Response & Breach Notification
  Plan* (cross-referenced in §Security Incident Procedures). Where a control is verified by
  Claima's automated code-audit gate (`scripts/audit.ts`), that is cited as evidence.

---

## 1. Administrative Safeguards (§164.308)

### 1.1 Security Management Process — §164.308(a)(1)

**Policy.** Claima maintains a formal process to prevent, detect, contain, and correct
security violations affecting ePHI.

**Procedures.**
- **Risk analysis — §164.308(a)(1)(ii)(A):** Claima maintains a documented HIPAA Security Risk
  Assessment (see *HIPAA Security Risk Assessment*) covering the ePHI inventory, system/data-flow
  inventory, existing safeguards, and a risk register. It is reviewed at least annually and on
  material change.
- **Risk management — §164.308(a)(1)(ii)(B):** Identified risks are tracked in a risk register
  with owner, remediation, and priority. Remediation gating first PHI (subprocessor BAAs, AI-to-
  BAA routing) is sequenced ahead of production use.
- **Sanction policy — §164.308(a)(1)(ii)(C):** Workforce violations are sanctioned per the
  Sanction Policy (§5).
- **Information system activity review — §164.308(a)(1)(ii)(D):** Claima records an audit log of
  PHI access (actor, action, resource, timestamp, IP, user-agent) and reviews activity for
  anomalous access and failed-login patterns. Error monitoring is PHI-stripped (Sentry
  `beforeSend` or Azure App Insights).

### 1.2 Assigned Security Responsibility — §164.308(a)(2)

**Policy.** A single individual is designated responsible for HIPAA security and privacy.

**Procedure.** **George Nagib** serves as **Security Officer and Privacy Officer**
(support@claima.io, [FILL IN: phone]) and owns policy, risk assessment, incident response,
subprocessor BAAs, and workforce oversight.

### 1.3 Workforce Security — §164.308(a)(3)

**Policy.** Only authorized workforce members access PHI, and access is limited to what their
role requires and removed promptly when no longer needed.

**Procedures.**
- **Authorization & supervision — §164.308(a)(3)(ii)(A):** Access is granted on a
  least-privilege, role-based basis (RBAC: Admin / Biller). Each user has unique credentials
  (bcrypt cost 12) or Microsoft Entra ID SSO. No shared accounts.
- **Workforce clearance — §164.308(a)(3)(ii)(B):** Access is provisioned only after
  authorization by the Security Officer and appropriate role assignment. [FILL IN: background
  check policy, if any.]
- **Termination / deprovisioning — §164.308(a)(3)(ii)(C):** On role change or separation,
  access is revoked promptly — application accounts disabled, SSO access removed via Entra ID,
  and relevant secrets rotated. The audit trail of the departed user's prior access is retained.

### 1.4 Information Access Management & Minimum Necessary — §164.308(a)(4)

**Policy.** Access to PHI is authorized, role-appropriate, and limited to the **minimum
necessary** to perform the service.

**Procedures.**
- **Access authorization — §164.308(a)(4)(ii)(B)–(C):** Roles map to specific application
  capabilities; new or changed access requires Security Officer approval.
- **Strict multi-tenant isolation:** every database query is scoped to the requesting user's
  practice (`practiceId` derived from the session, never from request input). Cross-practice
  access is not possible. This isolation is enforced in code and verified by the automated
  code-audit gate.
- **Minimum necessary — §164.502(b), §164.514(d):** Claima ingests and processes only the data
  needed for the contracted service (e.g., for denial recovery: claim, denial/CARC, payer, and
  the patient identifiers required to appeal). PHI is not routed to any provider or process not
  required for the task; the AI pipeline **fails closed** if a BAA-covered path is unavailable.

### 1.5 Security Awareness & Training — §164.308(a)(5)

**Policy.** All workforce members complete HIPAA security awareness training before accessing
PHI and periodically thereafter; training is documented and retained.

**Procedure. (in progress)** Formal workforce HIPAA training has not yet been conducted.
Training will be completed and its records retained **before any production PHI is processed**,
covering security reminders, malware/phishing protection, login monitoring, and password
management (§164.308(a)(5)(ii)(A)–(D)). [FILL IN: training vendor/content and completion date.]

### 1.6 Security Incident Procedures — §164.308(a)(6)

**Policy.** Security incidents are identified, responded to, mitigated, and documented; breaches
of unsecured PHI are reported to the affected Covered Entity per contract and law.

**Procedure.** Incident handling follows the *Incident Response & Breach Notification Plan*.
Claima reports any use/disclosure not permitted by the BAA, any Security Incident, and any
Breach of Unsecured PHI to the affected Covered Entity without unreasonable delay and within
the timeframe in the applicable BAA, including the information required by **§164.410**. See
also §164.308(a)(6)(ii).

### 1.7 Contingency Plan — §164.308(a)(7)

**Policy.** Claima can recover ePHI and maintain critical operations after an emergency or
system failure.

**Procedures.**
- **Data backup — §164.308(a)(7)(ii)(A):** Encrypted, regularly scheduled backups of the primary
  datastore are maintained on the cloud platform. **(in progress — formal, tested backup/restore
  procedure being finalized as part of the Azure migration.)**
- **Disaster recovery — §164.308(a)(7)(ii)(B):** Restore-from-backup procedures target
  recovery of ePHI and application availability. [FILL IN: RPO/RTO targets.] **(in progress.)**
- **Emergency-mode operation — §164.308(a)(7)(ii)(C):** Procedures preserve required PHI
  security controls during emergency operation.
- **Testing & revision — §164.308(a)(7)(ii)(D):** Backup restore and recovery procedures are
  tested and revised periodically. **(in progress.)**

### 1.8 Evaluation — §164.308(a)(8)

**Policy.** Claima periodically evaluates its safeguards against the Security Rule and its own
policies.

**Procedures.** Periodic evaluation includes review of the risk assessment, the safeguards
checklist, and audit-log activity. In addition, a **deterministic pre-commit security audit
(`scripts/audit.ts`) and a code-review gate** run on changes, enforcing tenant-isolation,
session-derived `practiceId`, auth on protected routes, and the absence of the global
TLS-verification-disable flag (treated as CRITICAL). Failing checks block merge.

### 1.9 Business Associate / Subcontractor Agreements — §164.308(b), §164.314(a), §164.502(e)

**Policy.** Claima executes a written BAA with each Covered Entity it serves and obtains a
signed BAA (or equivalent flow-down) from every subcontractor that creates, receives,
maintains, or transmits PHI on Claima's behalf, **before any production PHI is exchanged**.

**Procedure.** Claima signs a BAA with each practice as part of onboarding (see BAA template).
Each PHI-processing subprocessor below must be under a signed BAA before production PHI:

| Subprocessor | Role | BAA status |
|---|---|---|
| Microsoft Azure | Hosting, PostgreSQL, secrets (Key Vault) | (in progress) — Microsoft BAA via Product Terms |
| AWS (Bedrock) | AI (Claude) processing | (in progress) — self-serve BAA via AWS Artifact |
| Claim.MD | Clearinghouse (837/835/270-271) | (in progress) — BAA requested |
| Stripe | Patient payments (HIPAA conduit) | (in progress) — BAA requested |
| Azure Communication Services (ACS) Email | Transactional email (patient statements) | ✅ In scope for the Microsoft BAA. **Resend removed 2026-09-01** — no BAA, and HIPAA §1179 does not cover email vendors. |
| Sentry (PHI-stripped) **or** Azure App Insights | Error monitoring | (in progress) — configured to exclude PHI |
| Microsoft Entra ID | Identity / SSO (identifiers only) | Covered by Microsoft terms |

The AI pipeline **fails closed**: PHI is blocked from any AI provider not covered by a signed
BAA. Azure migration (off Vercel/Supabase) is **in progress**.

---

## 2. Physical Safeguards (§164.310)

### 2.1 Facility Access Controls — §164.310(a)

**Policy.** Physical access to systems housing ePHI is limited to authorized parties.

**Procedure.** Claima operates no data center; all ePHI resides in HIPAA-eligible cloud
infrastructure (Azure, AWS) whose data centers maintain SOC 2 / ISO 27001 physical-security
controls under the applicable BAA. Claima's workforce is remote; no PHI is stored on office or
home hardware.

### 2.2 Workstation Use & Security — §164.310(b)–(c)

**Policy.** Workstations that can access PHI are used only for authorized purposes and are
physically and technically protected.

**Procedure.** Workforce devices require **full-disk encryption** and **automatic screen lock**;
PHI is not stored on local disk (all PHI resides in the cloud application/datastore). [FILL IN:
MDM / endpoint-management tooling, if any.] **(Endpoint hardening being formalized — in progress.)**

### 2.3 Device & Media Controls — §164.310(d)

**Policy.** ePHI is protected across the lifecycle of hardware and electronic media, including
disposal and reuse.

**Procedure.** No ePHI is stored at rest on endpoints or removable media. Cloud storage
disposal and media sanitization are handled by the cloud provider under its BAA and
certifications. For any device that handled Claima systems, disks are encrypted and are wiped
or cryptographically erased before reuse or disposal. [FILL IN: disposal log location.]

---

## 3. Technical Safeguards (§164.312)

### 3.1 Access Control — §164.312(a)

**Policy.** Only authorized users and processes can access ePHI.

**Procedures.**
- **Unique user identification — §164.312(a)(2)(i):** every user has unique credentials (bcrypt
  cost 12) or Entra ID SSO; no shared logins. Access is role-based (Admin / Biller). Failed-login
  lockout (5 attempts → 15-minute lock) and password-strength rules apply.
- **Emergency access — §164.312(a)(2)(ii):** the Security Officer retains a break-glass path to
  restore access to ePHI during an emergency. [FILL IN: break-glass procedure detail.]
- **Automatic logoff — §164.312(a)(2)(iii):** a 30-minute client idle timeout (with warning)
  ends inactive sessions; server sessions use an 8-hour sliding window with an HS256 JWT pinned
  to the session.
- **Encryption/decryption — §164.312(a)(2)(iv):** ePHI is encrypted at rest via the cloud
  platform and in transit via TLS (see §3.5).

### 3.2 Audit Controls — §164.312(b)

**Policy.** Claima records and examines activity in systems that contain or use ePHI.

**Procedure.** PHI-touching operations are recorded in an audit log capturing actor, action,
resource, timestamp, IP, and user-agent. Logs are retained (see §6) and reviewed for anomalies.
Log integrity/tamper-resistance is being strengthened **(in progress)**.

### 3.3 Integrity — §164.312(c)

**Policy.** ePHI is protected from improper alteration or destruction.

**Procedures.** Input validation and error handling (that never exposes PHI) apply on all
data-entry points; multi-tenant scoping prevents cross-practice writes; TLS protects data in
transit; encrypted backups support recovery of authentic data. Additional integrity controls
(e.g., checksums / log-integrity verification) are **in progress**.

### 3.4 Person or Entity Authentication — §164.312(d)

**Policy.** Claima verifies that a person or entity seeking access is who they claim to be.

**Procedure.** Users authenticate with unique credentials (bcrypt cost 12) or Microsoft Entra
ID SSO; sessions use HS256 JWTs pinned to the session. **MFA for password-based logins is
not yet implemented (in progress); SSO with MFA via Entra ID conditional access is available**
and is the recommended login method.

### 3.5 Transmission Security — §164.312(e)

**Policy.** ePHI is protected against unauthorized access while transmitted over a network.

**Procedure.** All transport uses **TLS 1.2+ with HSTS**. The global TLS-verification-disable
flag (`NODE_TLS_REJECT_UNAUTHORIZED=0`) is prohibited process-wide and enforced by the
automated audit (CRITICAL); any CA exception is scoped to the specific database connection only.
PHI in AI processing is transmitted only to BAA-covered providers (fail-closed).

---

## 4. Privacy & Business Associate Obligations (§164.502–.514, §164.504(e))

**Policy.** As a Business Associate, Claima uses and discloses PHI only as permitted by its BAAs
and the HIPAA Rules, applies minimum necessary, and supports Covered Entities' privacy
obligations.

**Procedures.**
- **Permitted uses & disclosures — §164.504(e):** Claima uses/discloses PHI only to perform the
  contracted services, for its proper management and administration or legal responsibilities,
  and for data aggregation to the Covered Entity where permitted. Claima will not use/disclose
  PHI in a manner that would violate the Privacy Rule if done by the Covered Entity.
- **Minimum necessary — §164.502(b), §164.514(d):** only the data needed for the task is
  requested, used, and disclosed.
- **Individuals' rights (via the Covered Entity) — §164.524, .526, .528:** Claima makes PHI
  available and cooperates so the Covered Entity can fulfill access, amendment, and accounting-
  of-disclosures requests; Claima routes any individual request it receives to the relevant
  Covered Entity.
- **No secondary use without authorization:** Claima does not use PHI for its own product,
  marketing, or cross-practice purposes without authorization or a permitted basis. One
  practice's data is never exposed to another.
- **De-identification — §164.514(a)–(b) (Safe Harbor):** if/when Claima produces de-identified
  data, it applies the HIPAA Safe Harbor method (removal of the 18 identifiers with no actual
  knowledge of re-identification); properly de-identified data is no longer PHI.
- **Return or destruction at termination — §164.504(e)(2)(ii)(J):** on termination, Claima
  returns or securely destroys all PHI (including PHI held by subcontractors); where infeasible,
  protections are extended and further use limited. Claima performs **full destruction of a
  practice's PHI on offboarding**, while **retaining the audit trail for six years** (§6).

---

## 5. Sanction Policy (§164.308(a)(1)(ii)(C))

**Policy.** Workforce members who violate these policies or the HIPAA Rules are subject to
disciplinary action appropriate to the severity of the violation.

**Procedure.** Suspected violations are reported to the Security & Privacy Officer and
investigated using audit-log and system evidence. Sanctions range from retraining and written
warning to suspension of access, termination of employment/engagement, and — where required —
referral to authorities. Sanctions and their basis are documented and retained (§6). Reporting a
concern in good faith is not itself a sanctionable act.

---

## 6. Documentation & Retention (§164.316)

**Policy.** Required policies, procedures, and records of required actions/activities/assessments
are maintained in writing and retained for the required period.

**Procedures.**
- Policies and procedures are documented and made available to the workforce (§164.316(a)).
- Documentation is **retained for six (6) years** from the date of its creation or the date it
  was last in effect, whichever is later (§164.316(b)(2)(i)); reviewed and updated as needed and
  in response to environmental/operational change (§164.316(b)(2)(iii)).
- Records covered include this manual, the risk assessment, training records (once conducted),
  incident/breach records, sanction records, executed BAAs, and audit logs. Audit trails for an
  offboarded practice are retained for six years even after that practice's PHI is destroyed.

---

## Version / Effective Date / Approval

| Field | Value |
|---|---|
| Document | HIPAA Policies & Procedures Manual (Business Associate) |
| Entity | Claima LLC (New York) |
| Version | 0.1 (initial draft) |
| Effective date | [FILL IN: effective date] |
| Last reviewed | 2026-07-13 |
| Next scheduled review | 2027-07-13 (or upon significant change) |
| Owner / Approved by | George Nagib, Security & Privacy Officer — support@claima.io, [FILL IN: phone] |
| Approval signature / date | ______________________  Date: __________ |

*Draft for internal review; not legal advice — have healthcare counsel review before use.*
