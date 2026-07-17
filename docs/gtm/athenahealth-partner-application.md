# athenahealth Marketplace — Partner Application Draft

> Purpose: ready-to-send materials for **task #11**. Start with the inquiry email, then
> the intake answers (athenahealth's partner form asks for these topics; wording is drafted —
> fill the `[FILL IN]` placeholders with current numbers before sending).
>
> **Positioning rule (important):** athenahealth sells its *own* full RCM (athenaOne). Do **not**
> pitch Claima as a replacement biller — pitch the **AI denial-recovery + billing-intelligence
> layer** that *augments* collections for practices billing in-house or with a third party. This
> is additive to athenahealth, not competitive, which is what gets a listing approved.

---

## 1. Inquiry email (to Marketplace@athenahealth.com)

**Subject:** Marketplace partner inquiry — Claima (AI denial recovery for athenaOne practices)

Hello athenahealth Marketplace team,

I'm George Nagib, founder of **Claima** (claima.io) — an AI-native platform that helps outpatient
practices **recover denied and underpaid claims**. We'd like to join the athenahealth Marketplace as
an integrated partner.

Claima reads a practice's claims and remittances, automatically classifies denials (CARC/RARC),
drafts appeal letters, and surfaces underpayments — turning "found money" back into collections
without adding staff. It complements athenaOne: it's an intelligence + recovery layer for practices
that manage billing in-house or want to lift collections beyond their current process.

We're HIPAA-compliant (BAAs executed with AWS, Microsoft Azure, and our clearinghouse Claim.MD;
verified TLS, MFA, full audit logging), and our AI runs on Claude via Amazon Bedrock under a signed
BAA. We integrate read-mostly via your API (claims, remittances, eligibility) with optional
write-back of appeal status/notes.

Could you point me to the partner application and Developer Portal onboarding? Happy to share a demo
and our security overview.

Thanks,
George Nagib · Founder, Claima LLC · [email] · [phone] · claima.io

---

## 2. Intake answers (draft)

**Company:** Claima LLC · claima.io · HQ: [FILL IN — New York, NY] · Founded: 2026 · Team: [FILL IN]

**Product name / category:** Claima — Revenue Cycle Management → *Denial Management & Billing Intelligence*

**One-line value proposition:**
AI-native denial recovery for outpatient practices — automatically finds, appeals, and recovers
denied and underpaid claims, priced on a percentage of what it collects.

**What it does (for the listing):**
- **Denial recovery:** parses 835 remittances, classifies every denial by CARC/RARC into the right
  action (appeal / resubmit / write-off / patient-responsibility), and generates appeal letters with
  AI grounded in the claim + payer rules.
- **Eligibility & scrubbing:** real-time 270/271 eligibility and pre-submission claim scrubbing to
  prevent denials up front.
- **Billing intelligence:** payer-level denial/collection benchmarking so practices see which payers
  and codes are costing them.
- **Adjacent automation:** prior-auth tracking, patient statements, credentialing, OIG screening, CCM.

**Target customer:** SMB/mid outpatient practices across all specialties (family medicine,
cardiology, physical therapy, psychiatry, etc.) — especially those billing in-house or via a
third-party biller who want to lift collections. Sweet spot: [FILL IN — e.g., 1–25 providers].

**How it integrates with athenaOne:**
- **Reads (primary):** claims, charges, remittances/ERAs, patient + insurance, appointments — to
  detect denials/underpayments and drive the recovery workflow.
- **Writes (optional):** appeal status, notes/tasks back to the chart so staff have one source of truth.
- **Mechanism:** athenahealth API (developer portal), OAuth-scoped, least-privilege, sandbox-tested,
  read-mostly. No PHI stored beyond what's needed for the recovery workflow; deletion on offboarding.

**Existing athenahealth customers using it:** None yet — [FILL IN once a pilot practice is on athenaOne].
First pilot secured (denial-recovery engagement).

**Differentiation:** outcome-aligned (% of collections, not per-seat); AI-native appeals; works across
all specialties; complements rather than replaces the practice's billing.

**Security / compliance:** HIPAA Business Associate. BAAs executed with AWS, Microsoft Azure, and
Claim.MD. Verified TLS in transit, AES-256 at rest, MFA, per-practice data isolation, 6-year audit
logging, fail-closed AI (PHI only to BAA-covered providers — Claude on Amazon Bedrock). SOC 2 Type II
in progress. Security overview available on request.

**Commercial model:** percentage of collections (contingency on recovered/collected dollars). Open to
athenahealth's standard Marketplace partner revenue-share terms.

**Why athenahealth:** athenaOne's connected ambulatory network (160k+ providers) is exactly our
target buyer, and denial recovery is additive to every practice's collections regardless of who does
the billing.

---

## 3. Before sending — fill these in
- [ ] HQ, team size, founding specifics
- [ ] Target practice-size band
- [ ] Contact email + phone
- [ ] Any pilot metrics once available (recovery %, first practice on athenaOne)
- [ ] Attach the security overview (docs/compliance/security-overview.md — only after BAAs, already done)
