# HIPAA Security Risk Analysis — Claima LLC

> **Draft for internal review; not legal advice — have healthcare counsel review before use.**
>
> This document supersedes the prior `security-risk-assessment.md` and is the load-bearing HIPAA
> risk-analysis artifact required under **45 CFR §164.308(a)(1)(ii)(A)**. Its *absence* is the
> single most-cited finding in OCR enforcement actions.

**Business Associate:** Claima LLC (New York limited liability company), operating claima.io ("Claima")
**HIPAA role:** Business Associate — processes Protected Health Information (PHI/ePHI) on behalf of
provider practices ("Covered Entities") for claim submission, denial management, eligibility
verification, and patient billing.
**Security Officer & Privacy Officer:** George Nagib — support@claima.io, [FILL IN: phone]
**Framework:** HIPAA Security Rule (45 CFR §§164.302–318), conducted per **NIST SP 800-30 Rev. 1**
(Guide for Conducting Risk Assessments) and aligned with **HHS OCR** "Guidance on Risk Analysis
Requirements under the HIPAA Security Rule" and the HHS Security Risk Assessment (SRA) Tool.
**Effective date:** [FILL IN: effective date]  ·  **Version:** 1.0 (draft)
**Review cadence:** at least annually and upon any significant environmental or operational change
(e.g., completion of the Azure migration, new subprocessor, security incident).

---

## 1. Purpose, Scope & Methodology

### 1.1 Purpose
This Security Risk Analysis (SRA) provides "an accurate and thorough assessment of the potential
risks and vulnerabilities to the confidentiality, integrity, and availability of electronic
protected health information" held by Claima, as required by 45 CFR §164.308(a)(1)(ii)(A). It
identifies where ePHI lives and moves, enumerates reasonably anticipated threats and
vulnerabilities, assesses current safeguards, rates residual risk, and drives a prioritized
remediation roadmap under the risk-management standard §164.308(a)(1)(ii)(B).

### 1.2 Scope
The analysis covers **all ePHI created, received, maintained, or transmitted** by Claima in its
role as Business Associate, across the full application stack, its cloud infrastructure, its
subprocessors, and its workforce endpoints. It is technology-agnostic as to specialty: Claima
serves outpatient practices across specialties, so scope includes the superset of ePHI processed
for revenue-cycle services. For any **denial-recovery pilot**, the *minimum necessary* subset
(denied/underpaid claims and the identifiers required to appeal them) applies operationally, but
this SRA assesses the platform's full ePHI-handling capability.

**In scope:** the Claima web application and API (Next.js), the primary PostgreSQL datastore,
subprocessor integrations (clearinghouse, AI provider, payments, email, monitoring, identity),
backups, application logs, and workforce administrative access.

**Out of scope:** the internal environments of Covered Entities (their EHR/PM systems), and the
internal security programs of subprocessors beyond the assurances obtained via BAA and their
published attestations (SOC 2 / ISO 27001 / HITRUST).

### 1.3 Methodology (NIST SP 800-30 model)
1. **System characterization** — inventory ePHI and map data flows (Section 2).
2. **Threat identification** — enumerate threat sources reasonably anticipated for a cloud-hosted
   healthcare BA (Section 3).
3. **Vulnerability identification** — pair threats with weaknesses, incorporating findings from
   Claima's recent code + infrastructure security audit (Sections 3–4).
4. **Control analysis** — document safeguards already implemented (Section 4.1) and map them to the
   Security Rule (Appendix A).
5. **Likelihood and impact determination** — rate each risk Low / Medium / High.
6. **Risk determination** — combine likelihood × impact into a residual-risk rating after existing
   controls (Section 4.2 risk register).
7. **Control recommendations & remediation** — prioritized roadmap with owners and target dates
   (Section 5).
8. **Documentation & review** — this document, reviewed on the cadence in Section 6.

**Rating scale.** Likelihood and Impact are each rated **Low / Medium / High**. Residual risk is the
level remaining *after* current controls: High = act now / gates production PHI; Medium = remediate
on a defined near-term schedule; Low = monitor and address in normal course.

> **Overall posture (honest top line):** Claima's *application-layer* controls are strong and
> audit-verified (tenant isolation, access control, audit logging, encryption in transit, AI
> fail-closed). However, **residual risk is currently ELEVATED** because (a) subprocessor BAAs are
> still being executed, (b) the Azure migration is in progress (production still runs on
> Vercel + Supabase, which are being retired), (c) MFA is not yet enforced for password logins,
> (d) formal workforce HIPAA training is not yet documented, and (e) cyber/E&O insurance is not yet
> bound. **No production PHI should be processed for a live Covered Entity until the BAA and Azure
> gating items in Section 5 are complete.** Policy/target statements below describe commitments
> Claima enforces *before* PHI is processed; current-status statements are factual as of the
> effective date.

---

## 2. ePHI Inventory & Data-Flow Map

### 2.1 ePHI data elements processed
Patient name; date of birth; address; contact details; member/subscriber and group IDs; payer
identifiers; diagnoses (ICD-10); procedures (CPT/HCPCS) and modifiers; dates and place of service;
rendering/billing provider identifiers (NPI, TIN); claim, denial (CARC/RARC), and remittance detail;
eligibility responses (270/271); patient account balances and statement data; and payment metadata.

### 2.2 Systems and data flows
Every location where ePHI is created, received, stored, or transmitted:

| # | System / channel | Role | ePHI handling | Persistence | Current transport | BAA status |
|---|---|---|---|---|---|---|
| DF1 | **PostgreSQL database** (Supabase today → Azure Database for PostgreSQL target) | Primary datastore: patients, claims, eligibility (271), remittance (835/ERA), statements, audit logs | Creates & **stores** ePHI | Persistent, encrypted at rest | TLS to DB; app scopes every query to `practiceId` | ⏳ Supabase BAA/HIPAA plan N/A — **being retired**; Azure BAA via Microsoft Product Terms (in progress) |
| DF2 | **Claima app / API** (Next.js on Vercel today → Azure App Service/Container target) | All business logic; serverless compute for every API route | **Receives & transmits** ePHI in request/response | Transient (no PHI written to disk beyond DB) | TLS 1.2+ inbound with HSTS | ⏳ Vercel **being retired**; Azure hosting BAA (in progress) |
| DF3 | **Claim.MD** (clearinghouse) | 837 claim submission, 835 remittance retrieval, 270/271 eligibility | **Transmits** ePHI outbound/inbound (X12 EDI) | Claim.MD retains per its terms | TLS | ⏳ BAA requested (in progress) |
| DF4 | **AI provider — AWS Bedrock (Claude)** | AI features (appeal letters, denial triage, eligibility interpretation, assistant) — **prompts contain PHI** | **Transmits** ePHI in prompts; responses may echo PHI | Not retained for training (Bedrock) | TLS | ⏳ AWS BAA via AWS Artifact (in progress) |
| DF5 | **Email — Resend or Azure Communication Services** | Delivery of patient statements / billing notices | **Transmits** limited ePHI (name, balance, practice) | Provider retains send logs per terms | TLS/opportunistic TLS | ⏳ BAA required before PHI (in progress); minimize PHI in message bodies |
| DF6 | **Stripe** (payments; HIPAA conduit) | Patient payment processing (Stripe Connect, 5% platform fee) | Limited ePHI (name, amount, practice linkage); card data tokenized by Stripe | Stripe retains payment records | TLS | ⏳ Stripe BAA (conduit) requested (in progress) |
| DF7 | **Error monitoring — Sentry (PHI-stripped) or Azure Application Insights** | Application error and performance telemetry | **Should contain NO PHI** — stripped in `beforeSend`; scrubbing hardening pending | Provider retains events per plan | TLS | N/A if no PHI; treat as BA if PHI could leak → BAA/scrub |
| DF8 | **Identity — Microsoft Entra ID** | SSO / authentication | Identifiers only (email, name, IDs); no clinical PHI | Microsoft (identity data) | TLS | Covered by Microsoft Product Terms |
| DF9 | **Backups** (managed DB backups; Azure Backup / provider snapshots post-migration) | Disaster recovery copies of DF1 | **Stores** ePHI (full DB copy) | Persistent, encrypted at rest | Provider-internal | Inherits DF1 platform BAA; DR restore testing pending |
| DF10 | **Application logs / audit log** | Audit trail of PHI access (actor / action / resource / timestamp / IP / user-agent) | Audit log stored **in DB (DF1)**; app diagnostic logs PHI-sanitized | Audit retained ≥6 years; retained on offboarding | TLS | Inherits DF1/DF2 |

### 2.3 Data-flow narrative
```
Covered Entity user ──TLS/HSTS──▶ Claima app/API (DF2)
        │                               │
        │   authenticated session       ├──scoped query──▶ PostgreSQL (DF1) ──▶ Backups (DF9)
        │   (JWT, RBAC, tenant-scoped)  │                         │
        │                               │                         └──▶ Audit log (DF10, ≥6 yr)
        │                               │
        │                               ├──X12 EDI──▶ Claim.MD (DF3) ──▶ Payers
        │                               ├──PHI prompt──▶ AWS Bedrock / Claude (DF4)  [fail-closed]
        │                               ├──statement──▶ Email provider (DF5) ──▶ Patient
        │                               └──payment──▶ Stripe (DF6) ──▶ Patient card
        │
        └──error telemetry (PHI stripped)──▶ Sentry / App Insights (DF7)

Authentication: Microsoft Entra ID SSO (DF8) / email+password (bcrypt)
```
**AI fail-closed control (DF4):** PHI is blocked from being sent to any AI provider that is not
covered by a signed BAA. If the BAA-covered route is unavailable, the request fails closed rather
than sending PHI to a non-covered endpoint.

---

## 3. Threat & Vulnerability Identification

Reasonably anticipated threat sources for a cloud-hosted healthcare Business Associate, paired with
the vulnerabilities each could exploit:

| Threat source | Representative threat event | Relevant vulnerabilities in Claima's environment |
|---|---|---|
| **External attacker** | Exploit an internet-facing endpoint to reach the DB or app | Public API surface; dependency vulnerabilities; misconfiguration of managed services |
| **Credential theft / phishing** | Reuse of stolen workforce or user password to authenticate | **MFA not yet enforced for password logins** (SSO available); no instant server-side session revocation yet |
| **Malicious or negligent insider** | Workforce member accesses PHI beyond need, or exfiltrates data | Small workforce; **formal HIPAA training not yet documented**; least-privilege enforced by RBAC + tenant scoping |
| **Cloud / service misconfiguration** | A managed-service default exposes data (e.g., an auto-generated data API, over-broad network access, public storage) | **Supabase Data API / PostgREST exposure** (verify disabled); platform defaults during migration; secrets handling |
| **Subprocessor breach** | Compromise at Claim.MD, AI provider, Stripe, email, or hosting exposes ePHI | **Subprocessor BAAs not all executed yet**; reliance on providers' own controls |
| **Man-in-the-middle (MITM)** | Interception of ePHI in transit | Prior global TLS-verification bypass (`NODE_TLS_REJECT_UNAUTHORIZED=0`) — **now scoped to the DB connection only** |
| **Lost / stolen device** | Workforce laptop with cached session or credentials is lost | Endpoint hardening (full-disk encryption, auto-lock) not yet formally documented/attested |
| **Ransomware / destructive malware** | Encryption or destruction of the datastore | Backup/restore (DR) not yet formally tested; contingency plan not yet documented |
| **Accidental disclosure** | PHI leaked via logs, error reports, misaddressed statement, or wrong-tenant view | **PHI-in-logs — now sanitized**; Sentry scrubbing hardening pending; tenant isolation mitigates wrong-tenant access |
| **Data-integrity failure** | Unauthorized or erroneous alteration of claims/remittance | Input validation present; audit log detects; no cryptographic integrity/WORM on audit log yet |
| **Availability loss** | Provider outage or dependency failure interrupts service | Single-region posture during migration; contingency plan pending |

---

## 4. Control Analysis & Risk Register

### 4.1 Safeguards already implemented (current controls)
Verified by Claima's recurring deterministic pre-commit security audit and code-review gate. Cited
as current safeguards throughout the risk register.

**Access control & authentication (§164.312(a), §164.308(a)(5))**
- Unique per-user credentials; passwords hashed with **bcrypt (cost 12)**.
- **RBAC** (Admin / Biller roles), least-privilege.
- **Microsoft Entra ID SSO** available.
- **Failed-login lockout** (5 attempts → 15-minute lockout); password-strength rules.
- **Automatic logoff**: 30-minute client idle timeout with warning, plus an 8-hour sliding server
  session; HS256 JWT pinned. (§164.312(a)(2)(iii))

**Tenant isolation & authorization**
- **Strict multi-tenant isolation** — every DB query scoped to the practice; `practiceId` is always
  derived from the authenticated session, never from the request body; no cross-practice access.

**Audit controls (§164.312(b))**
- **Audit logging of all PHI access**: actor / action / resource / timestamp / IP / user-agent,
  retained (audit trail retained **6 years**, including after a practice is offboarded).

**Transmission security (§164.312(e))**
- **TLS 1.2+** for inbound traffic with **HSTS**.
- Global TLS-verification bypass **removed**; the self-signed-CA exception is **scoped to the DB
  connection only** (to be replaced with full CA verification post-Azure-migration).

**AI safeguard**
- **AI fail-closed**: PHI is blocked from any non-BAA AI provider; requests fail rather than send PHI
  to a non-covered endpoint. AI cost logging is PHI-safe (tokens/labels only).

**Encryption at rest (§164.312(a)(2)(iv))**
- **Encryption at rest** via the cloud platform (AES-256, cloud-managed keys).

**Integrity & error handling**
- **Input validation** on all writes; **error handling that does not expose PHI**; application
  diagnostic logs sanitized of PHI.

**Data lifecycle (§164.310(d), §164.316)**
- **Full destruction** of a practice's PHI on offboarding, with the **audit trail retained 6 years**.

**Secrets management**
- **Secrets rotation** and **Azure Key Vault** (post-migration); plaintext-secret findings being
  remediated by rotation.

**Governance**
- Designated Security & Privacy Officer (George Nagib).
- **Deterministic pre-commit security audit + code-review gate on every change** (e.g., enforces
  absence of the global TLS-bypass flag as CRITICAL).

### 4.2 Risk Register

Residual risk reflects the level remaining **after** the current controls above. Findings from
Claima's recent code + infrastructure security audit are incorporated inline with their status.

| # | Risk | Threat / Vulnerability | Likelihood | Impact | Current controls | Residual risk | Remediation | Owner | Target date |
|---|---|---|---|---|---|---|---|---|---|
| R1 | PHI sent to an AI provider **without a BAA** | Subprocessor breach; regulatory non-compliance (§164.308(b), §164.502(e)) | Low | High | **Audit finding — REMEDIATED:** AI is now **fail-closed**; PHI blocked from non-BAA providers. Bedrock BAA in progress. | **Medium** (until AWS Bedrock BAA signed) | Execute AWS BAA via AWS Artifact; confirm Bedrock is the sole PHI AI route | George / Eng | [FILL IN] |
| R2 | **No signed subprocessor BAAs** yet (Azure hosting/DB, Bedrock, Claim.MD, Stripe, email) | Subprocessor breach; unlawful disclosure (§164.308(b)) | High | High | Fail-closed AI; subprocessor list maintained; overview names all subprocessors | **High** | Execute each BAA **before any production PHI**; track in subprocessor register | George | [FILL IN] |
| R3 | **Azure migration in progress** — production still on Vercel + Supabase (being retired) | Misconfiguration; transitional gaps; unverified DB CA | Med | High | App-layer controls intact; TLS scoped to DB; migration plan defined | **High** (until cutover complete) | Complete migration to Azure (App Service + Azure Database for PostgreSQL + Key Vault); enable full CA verification (`rejectUnauthorized: true` with Azure CA) | George / Eng | [FILL IN] |
| R4 | **Supabase Data API / PostgREST exposure** | Cloud misconfiguration → direct data access bypassing app authz | Med | High | **Audit finding — CONFIG:** app enforces tenant scoping at query layer | **Medium** (verify/disable; superseded at Azure cutover) | Verify the auto-generated Data API is disabled / not internet-exposed on Supabase; confirmed removed after Azure migration | Eng | [FILL IN] |
| R5 | **Broken PHI deletion** on offboarding | Data retained beyond permitted scope; return/destruction failure (§164.310(d)) | Low | High | **Audit finding — FIXED:** offboarding now fully destroys practice PHI; audit trail retained 6 years | **Low** | Add periodic verification test that deletion is complete; document procedure | Eng | [FILL IN] |
| R6 | **Plaintext / static secrets** | Credential theft; secret leakage | Low | High | **Audit finding — IN PROGRESS:** rotation + Azure Key Vault post-migration | **Medium** (until rotation + Key Vault live) | Rotate all secrets; move to Azure Key Vault; remove any secrets from code/config | George / Eng | [FILL IN] |
| R7 | **PHI written to logs / error monitoring** | Accidental disclosure via telemetry | Low | Med | **Audit finding — SANITIZED:** app logs PHI-stripped; Sentry `beforeSend` strips PHI | **Medium** (Sentry scrubbing hardening pending) | Complete Sentry PHI-scrubbing hardening or move to Azure App Insights with PHI filters; add scrub tests | Eng | [FILL IN] |
| R8 | **Global TLS verification disabled** (`NODE_TLS_REJECT_UNAUTHORIZED=0`) | MITM on all outbound HTTPS (AI, Claim.MD, Stripe) | Low | High | **Audit finding — REMEDIATED:** flag removed; exception **scoped to the DB connection only**; audit enforces absence as CRITICAL | **Low** | On Azure, verify DB cert against Azure CA (`rejectUnauthorized: true`) to close the last scoped exception | Eng | [FILL IN] |
| R9 | **No automatic logoff** | Unattended-session hijack; lost device | Low | Med | **Audit finding — ADDED:** 30-min client idle timeout + warning; 8-hr sliding server session; pinned JWT | **Low** | Add **instant server-side session revocation** (pending) to complement idle timeout | Eng | [FILL IN] |
| R10 | **MFA not enforced for password logins** | Credential theft / phishing (§164.312(d)) | Med | High | SSO (Entra ID) available with MFA; lockout + strong passwords for password logins | **High** | Enforce MFA for all password logins (or require SSO); Entra conditional access for privileged accounts | George | [FILL IN] |
| R11 | **No documented workforce HIPAA training** | Insider error; security-awareness gap (§164.308(a)(5)) | Med | Med | Solo/small workforce; Security Officer designated; policies drafted | **Medium** | Complete and **retain** HIPAA security-awareness training records for all workforce; repeat annually | George | [FILL IN] |
| R12 | **No instant session revocation** | Compromised/terminated-user session remains valid until expiry | Low | Med | 8-hr sliding session; idle timeout; account disable at IdP for SSO | **Medium** | Implement server-side token revocation / short-lived tokens + refresh with revocation list | Eng | [FILL IN] |
| R13 | **Backup / disaster-recovery not formally tested** | Ransomware; data loss; availability failure (§164.308(a)(7)) | Low | High | Managed encrypted DB backups (platform) | **Medium** | Document contingency plan; perform and log a **test restore**; define RTO/RPO | Eng | [FILL IN] |
| R14 | **Workforce endpoint hardening not formalized** | Lost/stolen device; local credential exposure | Low | Med | Cloud-only PHI (no PHI on local disk by design); dev practices | **Medium** | Document + attest full-disk encryption, auto-lock, screen timeout; add MDM at scale | George | [FILL IN] |
| R15 | **Written policy set not fully adopted** (Privacy / Security / Breach / sanction) | Governance gap; §164.316 documentation | Med | Med | Risk analysis (this doc); overview; BAA template | **Medium** | Adopt and version the full policy set (optionally via a compliance platform); assign sanction policy | George | [FILL IN] |
| R16 | **Audit-log tamper resistance / retention integrity** | Insider alteration of audit trail (§164.312(b), (c)) | Low | Med | Audit log in DB; 6-yr retention; RBAC restricts access | **Low** | Add integrity controls (append-only / WORM / hash chaining or export to immutable store) | Eng | [FILL IN] |
| R17 | **Cyber liability + E&O insurance not yet bound** | Uninsured financial exposure on breach/error | Med | High | None (transfer control absent) | **High** | Bind cyber + E&O policies before first production PHI | George | [FILL IN: carrier] |
| R18 | **SOC 2 not started** | No third-party attestation for enterprise/marketplace buyers | High | Low | Strong internal controls; audit gate | **Low** (business risk, not PHI-safety risk) | Begin SOC 2 Type II (~6-month observation once started); interim: share this SRA + controls on request | George | [FILL IN] |

---

## 5. Prioritized Remediation Roadmap

Ordered to unblock lawful processing of production PHI first, then reduce residual risk.

**Priority 1 — Gates before any production PHI for a live Covered Entity**
1. **Execute all subprocessor BAAs** (R2): Azure (Microsoft Product Terms), AWS Bedrock (AWS
   Artifact), Claim.MD, Stripe, and email provider. Maintain a subprocessor register with signed
   dates. — *George*
2. **Confirm Bedrock is the sole PHI AI route** and its BAA is signed (R1). — *George / Eng*
3. **Enforce MFA** for all password logins, or require SSO with MFA; conditional access on
   privileged accounts (R10). — *George*
4. **Bind cyber liability + E&O insurance** (R17). — *George*
5. **Verify/disable the Supabase Data API** exposure while still on Supabase (R4). — *Eng*
6. **Rotate all secrets** and move to Azure Key Vault (R6). — *George / Eng*

**Priority 2 — Complete concurrently / immediately after**
7. **Complete the Azure migration** (R3): Azure App Service/Container + Azure Database for
   PostgreSQL + Key Vault; enable full DB CA verification (`rejectUnauthorized: true`), closing the
   last scoped TLS exception (R8). — *George / Eng*
8. **Complete and document workforce HIPAA training** and retain records (R11). — *George*
9. **Adopt the written policy set** — Privacy, Security, Breach Notification, sanction, contingency
   (R15). — *George*
10. **Finish Sentry PHI-scrubbing hardening** or move to Azure App Insights with PHI filters (R7). — *Eng*

**Priority 3 — Near-term hardening**
11. **Instant server-side session revocation** / short-lived tokens (R9, R12). — *Eng*
12. **Document contingency plan and run a tested restore**; define RTO/RPO (R13). — *Eng*
13. **Formalize endpoint hardening** attestation (R14). — *George*
14. **Audit-log integrity controls** (append-only / hash chaining / immutable export) and a
    verification test for complete PHI deletion (R16, R5). — *Eng*

**Priority 4 — Maturity**
15. **Begin SOC 2 Type II** and consider a compliance-automation platform (R18). — *George*

---

## 6. Review Cadence & Approval

### 6.1 Ongoing risk management (§164.308(a)(1)(ii)(B))
This is a living document. Risk analysis and risk management are continuous, not one-time. The
Security Officer will:
- **Review this SRA at least annually**, and upon any **significant change** — completion of the
  Azure migration, onboarding a new subprocessor, a material architecture change, a security
  incident or breach, or a relevant regulatory change.
- Update the risk register as remediation items close and as new findings arise from the recurring
  code + infrastructure security audit.
- Track remediation to completion with the owners and target dates above.

**Next scheduled review:** [FILL IN: one year from effective date, or upon significant change,
whichever is earlier].

### 6.2 Relationship to other documents
- **BAA (`baa-template.md`)** — the contractual instrument executed with each Covered Entity and,
  via flow-down, with subprocessors.
- **Security & HIPAA Overview (`security-overview.md`)** — the partner-facing summary; this SRA is
  the internal, defensible basis for the claims made there.
- This SRA **supersedes** the prior `security-risk-assessment.md`.

### 6.3 Approval

| Field | Value |
|---|---|
| Document | HIPAA Security Risk Analysis — Claima LLC |
| Version | 1.0 (draft for internal review) |
| Effective date | [FILL IN: effective date] |
| Prepared by | George Nagib, Security & Privacy Officer |
| Approved by | ______________________________ (George Nagib, Security & Privacy Officer) |
| Approval date | [FILL IN: date] |
| Next review | [FILL IN: date — at least annually or on significant change] |

---

## Appendix A — Security Rule Safeguards Crosswalk (§§164.308–316)

Legend: ✅ implemented · ◑ partial / in progress · ⏳ planned / gating

**Administrative safeguards (§164.308)**
- Security management process — risk analysis §164.308(a)(1)(ii)(A): ✅ (this document)
- Risk management §164.308(a)(1)(ii)(B): ◑ (roadmap in Section 5)
- Sanction policy §164.308(a)(1)(ii)(C): ⏳ (R15)
- Information-system activity review §164.308(a)(1)(ii)(D): ✅ (audit logging) / ◑ (regular review cadence)
- Assigned security responsibility §164.308(a)(2): ✅ (George Nagib)
- Workforce security / clearance / termination §164.308(a)(3): ◑ (RBAC + IdP disable; procedure to document)
- Information access management §164.308(a)(4): ✅ (least-privilege RBAC, tenant isolation)
- Security awareness & training §164.308(a)(5): ⏳ (R11); log-in monitoring ✅; password mgmt ✅
- Security incident procedures §164.308(a)(6): ◑ (breach-notification per BAA / §164.410; formalize IR plan)
- Contingency plan §164.308(a)(7): ⏳ (R13 — backups exist; test/document)
- Evaluation §164.308(a)(8): ◑ (recurring security audit + annual SRA review)
- Business associate contracts §164.308(b): ⏳ (R2 — subprocessor BAAs in progress)

**Physical safeguards (§164.310)**
- Facility access controls §164.310(a): N/A (cloud data centers — inherited SOC 2 / ISO 27001)
- Workstation use & security §164.310(b),(c): ◑ (R14 — cloud-only PHI; formalize endpoint policy)
- Device & media controls §164.310(d): ✅ destruction on offboarding / ◑ (media reuse, DR testing R13)

**Technical safeguards (§164.312)**
- Access control §164.312(a): ✅ (unique IDs, RBAC, automatic logoff, encryption at rest)
- Audit controls §164.312(b): ✅ (audit log) / ◑ (tamper-resistance R16)
- Integrity §164.312(c): ◑ (input validation, error handling; audit-log integrity pending)
- Person/entity authentication §164.312(d): ◑ (bcrypt + lockout + SSO; ⏳ MFA for password logins R10)
- Transmission security §164.312(e): ✅ (TLS 1.2+ / HSTS; DB CA verification completes at Azure cutover)

**Organizational & documentation (§§164.314, 164.316)**
- BA / subcontractor contracts §164.314(a): ⏳ (R2)
- Policies & procedures / documentation retained 6 years §164.316: ◑ (this SRA; policy set R15)

---

*Prepared under 45 CFR §164.308(a)(1)(ii)(A). Draft for internal review; not legal advice — have
healthcare counsel review before use.*
