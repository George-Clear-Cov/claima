# Anthropic + NVIDIA Inception — Application Drafts (Tasks #21, #22)

> Both non-dilutive, apply now. Reuse the company/problem/solution narrative from
> `aws-accelerator-application.md`. Positioning = full AI-native RCM platform ([[feedback-positioning]]).
> Fill the team `[FILL IN]`s before submitting.

---

## A. Anthropic — "Claude for Startups" (claude.com/programs/startups)

**Eligibility check:** founded <4 yrs (entity Feb 2024 ✓), first-time Anthropic credits (✓), equity funding
from an institutional investor (⚠️ pre-seed *in progress* — apply at the base tier now; if a **partner
VC/accelerator** refers you, note it for the higher tier). Credits valid 12 months.

**Company / one-liner:**
Claima (claima.io) — an AI-native revenue cycle management (RCM) platform for outpatient medical
practices. Automates the full billing lifecycle and recovers denied/underpaid claims; priced on a % of
what it collects.

**What are you building?**
An AI-native RCM platform that verifies eligibility, scrubs and submits claims, recovers denials with
AI-drafted appeals, posts remittances, and manages patient billing — plus prior auth, credentialing,
CCM, OIG, and payer intelligence. Denial recovery ("found money") is the wedge into full RCM.

**How do you use Claude? (the key question — be specific)**
Claude (Sonnet for reasoning-heavy tasks, Haiku for the fast tier) is the core of the product:
1. **Claim scrubbing** — reasons over CPT/ICD/modifiers + medical necessity to flag denials pre-submission.
2. **Denial recovery** — classifies each denial (CARC/RARC) and **drafts payer-ready appeal letters**
   grounded in the claim + payer rules. (Appeals are a reasoning + medical-writing task Claude excels at.)
3. **Clinical note / natural language → structured, coded 837P claim.**
4. **Eligibility interpretation** (plain-English benefits) + a **data-grounded billing assistant.**
5. **Autonomous agent** that runs daily per-practice workflows (ERA posting, appeals, A/R aging).
**Why Claude specifically:** best-in-class reasoning + medical-writing quality for coding/appeals, strong
instruction-following for structured extraction, and HIPAA coverage under a BAA. Usage scales with every
practice and every claim/denial — inference grows as we onboard practices.

**Deployment / HIPAA:** currently Claude via **Amazon Bedrock** (AWS BAA) for PHI, fail-closed. Anthropic
credits would fund non-PHI dev/eval + let us evaluate the direct Anthropic API (with Anthropic's BAA) as a path.

**Traction:** full platform built + deployed; clearinghouse validated live; first pilot verbally secured
(denial recovery); pre-seed raise in progress (~$1.5M SAFE). **Team:** [FILL IN — founder background + AI depth].

---

## B. NVIDIA Inception (nvidia.com/startups)

**Eligibility:** incorporated ✓, <10 yrs ✓, active development + live website (claima.io) ✓. **Apply as an
AI PRODUCT company** — NVIDIA excludes consulting/services shops. (Note: our AI is API-based (Claude), not
self-hosted GPU; Inception still accepts AI product companies and the AWS-credit/network benefits apply.)

**Company:** Claima LLC · claima.io · Founded 2024 · [FILL IN: HQ, team size].

**What does your company do? / AI focus:**
Claima is an **AI-native RCM platform** for outpatient medical practices — it automates the full revenue
cycle (eligibility, AI claim scrubbing, submission, AI-driven denial recovery + appeals, remittance
posting, patient billing) and is priced on a % of collections. AI (LLM reasoning + agentic workflows)
is the core: claim scrubbing, denial classification + appeal generation, note→claim extraction, an
autonomous billing agent, and a roadmap toward end-to-end agentic denial-working + a cross-practice data
moat for revenue-yield optimization.

**Industry / market:** Healthcare (revenue cycle / medical billing) — a ~$740B admin market, ~3% software
penetration, no dominant SMB winner. Buyer = outpatient practice administrators, all specialties.

**Stage / product:** MVP well beyond prototype — full platform built + deployed, HIPAA-compliant, ~25K LOC,
clearinghouse integration validated live, athenahealth integration validated in sandbox.

**Traction:** first pilot verbally secured (denial recovery); BAAs executed (AWS/Azure/Claim.MD); AppSource
+ AWS marketplace listings initiated; pre-seed raise in progress.

**Funding:** pre-seed (~$1.5M SAFE) in progress. **Website:** claima.io. **Use of benefits:** cloud credits
for AI inference at scale + the data warehouse; NVIDIA/partner VC + BD network for GTM and fundraising.

**Team:** [FILL IN — founder background, technical depth, advisors].
