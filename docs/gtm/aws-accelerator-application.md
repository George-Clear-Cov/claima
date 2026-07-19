# AWS Accelerator Applications (Task #18)

> Two AWS programs. **Primary = AWS Generative AI Accelerator** (up to $1M credits, 8-wk, <2% accept —
> strong architectural fit). **Hold = AWS Healthcare Accelerator** (needs existing customers + revenue;
> smaller $25K; themed cohorts) until the pilot is billing. Non-dilutive; both add SA/PDM support.
> Positioning per [[feedback-positioning]] (full RCM platform). Apply from AWS Partner Central / the
> program pages when the 2026 window is open.

---

## A. AWS Generative AI Accelerator — application draft

**They evaluate:** founding-team experience · clear industry use case + target market · product maturity ·
traction · team composition · breadth of **generative AND agentic AI** skills. So lead with the AI depth
and the healthcare use case; be honest that revenue traction is early but the wedge monetizes fast.

**Company / one-liner:**
Claima — an AI-native revenue cycle management (RCM) platform for outpatient medical practices that
automates the full billing lifecycle and recovers denied and underpaid claims. claima.io · Claima LLC.

**Problem:**
US outpatient practices lose a large share of revenue to claim denials, underpayments, and manual
billing errors. Their options are bad: expensive in-house billers, or opaque RCM firms charging 4–9%
of collections. Healthcare administration is a ~$740B market with only ~3% software penetration and no
dominant SMB winner.

**Solution:**
Claima automates the entire revenue cycle — eligibility (270/271), AI claim scrubbing, 837P submission,
AI-driven denial recovery with payer-ready appeals, ERA/835 posting, and patient billing — priced on a
percentage of what it collects, aligning incentives with the practice. Denial recovery is the wedge
("found money"), expanding to full RCM plus payer intelligence.

**Generative & agentic AI (the core):**
Claima is AI-native, built on **Anthropic Claude via Amazon Bedrock** (HIPAA-covered under the AWS BAA;
fail-closed design — PHI only goes to BAA-covered models). AI powers:
1. **Claim scrubbing** — flags coding/modifier/medical-necessity issues before submission.
2. **Denial recovery** — classifies every denial (CARC/RARC) and drafts payer-ready **appeal letters**
   grounded in the claim + payer rules.
3. **Note/natural-language → structured claim** — turns a clinical note into a coded 837P.
4. **Eligibility interpretation** + a **data-grounded billing assistant**.
5. **Autonomous agent** — runs daily per-practice workflows (ERA posting, appeals, A/R aging scans).
Roadmap: **agentic workflows that work denials end-to-end** autonomously, and a **cross-practice data
moat** powering revenue-yield optimization (which codes/payers pay what).

**Target market / use case:** SMB–mid outpatient practices, every specialty. Large, regulated, software-
underserved TAM; a concrete, high-ROI use case (recovered revenue) with a clear buyer (practice admin).

**Product maturity:** Full platform **built and deployed** — HIPAA-compliant on Azure + AWS Bedrock,
verified TLS, MFA, audit logging; clearinghouse (Claim.MD) 837P/835/270-271 **validated live**;
athenahealth integration validated in sandbox. ~25K LOC, 19 data models, 77 API routes.

**Traction:** First pilot **verbally secured** (denial-recovery engagement). Entity formed; BAAs executed
(AWS, Azure, Claim.MD); AppSource + AWS marketplace listings initiated; pre-seed raise in progress.
*(Early on revenue — the found-money wedge is designed to show ROI in weeks.)*

**Team:** George Nagib, founder — [FILL IN: AmEx Manager on the Payments/Banking digital platform;
years in payments/fintech; AI product builder]. [FILL IN any technical co-founder / advisors / AI depth.]

**Why AWS / use of credits:** Bedrock is the compliant home for Claude (AWS BAA). Credits fund AI
inference as Claima scales across practices — scrubbing, appeals, agentic denial-working — plus the
cross-practice data warehouse. Already running on Bedrock.

**Funding:** Pre-seed in progress (~$1.5M SAFE).

**Before submitting:** fill the team `[FILL IN]`s; check the live 2026 application window at
aws.amazon.com/startups/generative-ai/accelerator/ and get on the notify list if it's between cohorts.

---

## B. AWS Healthcare Accelerator — criteria + when to revisit

- **Benefits:** up to **$25K** credits, 4-week virtual program, healthcare SME + technical mentoring,
  BD/GTM/investment guidance, potential POC with (often public-sector) healthcare customers. ~15 hrs/wk.
- **Eligibility gate we don't fully meet yet:** requires a **validated solution, existing customers, AND
  revenue.** Claima is pre-revenue until the pilot bills.
- **Themed cohorts:** recent themes = healthcare **workforce** development, **health equity**, public
  sector. RCM/denial-recovery may or may not match the active call for applications.
- **Revisit when:** the pilot is generating revenue AND a cohort theme fits (a "do more with less staff"
  workforce angle could work — Claima removes billing-admin burden). Lower priority than the Gen AI one.
