# HIPAA Security Risk Assessment — Claima

**Business Associate:** [LEGAL ENTITY NAME] ("Claima")
**Prepared by:** George Nagib, Security Officer
**Date:** 2026-07-11 · **Review cadence:** at least annually and on material change
**Framework:** HIPAA Security Rule (45 CFR §164.308–316), guided by NIST SP 800-30 and the HHS Security Risk Assessment Tool.

> Required under 45 CFR §164.308(a)(1)(ii)(A). This is the load-bearing HIPAA document —
> its *absence* is OCR's most-cited finding. First internal draft; refine with counsel /
> a compliance platform (Vanta/Drata).

---

## 1. Scope & ePHI inventory
Claima is an AI-native medical billing / revenue-cycle platform for outpatient practices.
ePHI processed: patient name, DOB, address, member/subscriber ID, diagnoses (ICD-10),
procedures (CPT/HCPCS), claim/denial/remittance detail, eligibility responses, patient
balances. For the initial **denial-recovery pilot**, scope is limited to denied/underpaid
commercial claims and the identifiers needed to appeal them (minimum necessary).

## 2. System & data-flow inventory
| System | Role | ePHI? | BAA status | Encryption |
|---|---|---|---|---|
| Vercel | App hosting / serverless compute (all API routes) | Transits ePHI | ⏳ HIPAA add-on to enable | TLS + at-rest |
| Supabase (PostgreSQL) | Primary datastore | Stores ePHI | ⏳ HIPAA plan or migrate to Azure DB | AES-256 at rest |
| Claim.MD | Clearinghouse (837/835/270-271) | Transmits ePHI | ⏳ request BAA | TLS |
| Anthropic (direct) | AI (current) | Sends ePHI in prompts | ❌ **no BAA — gap** | TLS |
| AWS Bedrock / Azure OpenAI | AI (target) | Sends ePHI in prompts | ✅ self-serve / standard BAA | TLS |
| Stripe | Patient payments | Limited ePHI | ✅ BAA available | TLS |
| Sentry | Error monitoring | PHI stripped pre-capture | N/A (no PHI) | TLS |
| Microsoft Entra (Azure AD) | SSO | Identifiers only | Covered by MS terms | TLS |

## 3. Existing safeguards (strengths — audit-verified)
Recurring automated security audits report **0 CRITICAL / 0 HIGH** on the core controls:
- **Tenant isolation** — every DB query scoped to `practiceId`; no cross-practice access (verified).
- **Access control** — unique per-user auth, JWT sessions + timeout, 401 on all protected routes, optional Azure AD SSO, MFA-capable.
- **Audit logging** — immutable `AuditLog` on PHI-touching routes (who/what/resource/IP/UA).
- **Encryption** — TLS 1.2+ in transit; AES-256 at rest (cloud-managed).
- **Monitoring** — Sentry with PHI stripped in `beforeSend`.
- **Input validation** — zod/manual on all writes; rate limiting on public + auth routes.
- **AI minimization** — cost logging is PHI-safe (tokens/labels only, no patient data).

## 4. Risk register (threats × vulnerabilities → risk)
| # | Risk | Likelihood | Impact | Level | Remediation | Owner |
|---|---|---|---|---|---|---|
| R1 | AI subprocessor (Anthropic direct) processes PHI with **no BAA** | Med | High | **HIGH** | Route PHI AI to Bedrock/Azure (BAA-covered); `ai.ts` ready | George/Eng |
| R2 | No signed BAAs with Vercel / Supabase / Claim.MD | High | High | **HIGH** | Execute each before first PHI | George |
| R3 | No legal entity → cannot sign client BAA | High | High | **HIGH (blocking)** | Register entity | George |
| R4 | No documented written policies (Privacy/Security/Breach) | High | Med | **MED** | Adopt policy set (or via Vanta) | George |
| R5 | MFA not enforced on admin/privileged accounts | Med | High | **MED** | Enforce MFA (Azure AD conditional access) | George |
| R6 | Workforce device / endpoint hardening not formalized | Med | Med | **MED** | Full-disk encryption + auto-lock + (MDM at scale) | George |
| R7 | Backup / disaster-recovery not formalized | Med | Med | **MED** | Documented, encrypted, tested backups (Azure/S3) | Eng |
| R8 | No formal workforce HIPAA training records | Low | Med | **LOW** | Complete + retain training (solo now) | George |
| R9 | `NODE_TLS_REJECT_UNAUTHORIZED=0` disables TLS verification globally | Low | Med | **LOW** | Scope narrowly / fix when Supabase CA chain or DB host changes | Eng |
| R10 | Audit-log tamper-resistance / retention policy | Low | Med | **LOW** | Retention policy + integrity controls | Eng |

## 5. Safeguards checklist (Security Rule)
**Administrative (§164.308):** risk analysis ✅(this doc) · risk management ⏳ · sanction policy ⏳ · info-system activity review ✅(audit logs) · assigned security responsibility ✅(George) · workforce clearance/termination ⏳ · access authorization ✅ · security awareness training ⏳ · incident procedures ⏳ · contingency plan ⏳(R7) · BA contracts ⏳(R2).
**Physical (§164.310):** facility access N/A(cloud) · workstation use/security ⏳(R6) · device/media controls ⏳.
**Technical (§164.312):** access control ✅ · audit controls ✅ · integrity ⏳ · person/entity authentication ✅ · transmission security ✅.
**Documentation (§164.316):** policies retained 6 yrs ⏳.

## 6. Prioritized remediation (gates first PHI)
1. R3 register entity → R2 subprocessor BAAs → R1 AI-to-Bedrock/Azure → client BAA executable.
2. R4 policies + R5 MFA + R6 endpoint (fast, low-cost).
3. R7 backups, R8 training, R9/R10 hardening (post-pilot).

## 7. Sign-off
Reviewed and approved by: ______________________ (Security Officer) Date: __________
Next scheduled review: 2027-07-11 (or upon material change).
