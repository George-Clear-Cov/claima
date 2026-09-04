# Cloud Co-Sell Playbook — MS ISV Success + AWS APN + Marketplace listings (Task #17)

> Goal: turn on the **human help** (Microsoft Engagement Manager / AWS Partner Dev Manager + SAs) and
> the **co-sell lead flow**. The trigger on both clouds = **partner-program membership + a marketplace
> listing**. Most of this is free. See [[gtm-channels]] · [[gtm-appsource]].

Two tracks, run in parallel. Prereqs you already have: Microsoft Partner Center account (owns the
AppSource offer), Azure tenant; AWS account **georgeclaima (008482603773)** with the BAA accepted.

---

## TRACK A — Microsoft

### A1. Enroll in ISV Success (free 12 months) — do first
- **What:** free program for B2B ISVs publishing to Microsoft Marketplace → Azure credits, technical
  consultations, marketplace-publishing help, and (Expanded tier) an **ISV Success Engagement Manager** +
  co-sell support.
- **How:** sign in to **Partner Center** → Membership/Benefits → **ISV Success** → enroll.
  (microsoft.com/software-development-companies/offers-benefits/isv-success)
- **Why now:** fastest path to a Microsoft human + it funds/unlocks the marketplace work below.

### A2. Publish the AppSource listing (mostly done — just finish)
Per roadmap the offer already exists ("Claima — AI Medical Billing", **list-only**, Properties done,
listing copy drafted, logos 48/90/216/512 + 5 screenshots @1280×720 staged). Remaining:
- [ ] Partner Center → the offer → **Offer listing**: paste description (use the block in section C), upload logos + screenshots.
- [ ] **Preview audience** → validate → **Review and publish**.
- [ ] Keep it **list-only** ("Get it now" → claima.io) for now; **flip to transactable/metered**
      when a deal wants marketplace procurement (unlocks Marketplace Rewards + strongest co-sell).
- **Logo URL if needed:** https://claima-web-d89893.azurewebsites.net/apple-icon.png

### A3. (Already in flight) Microsoft for Startups
Application submitted 2026-07-11 (george@claima.io). Usage-based milestones; unrelated to ISV Success —
both run in parallel. AI fast-tier can route to Azure OpenAI to build attributable Azure consumption.

---

## TRACK B — AWS

### B1. Join AWS Partner Network (APN) — free
- **How:** **AWS Partner Central** (aws.amazon.com/partners → "Become a partner" / partnercentral).
  Register the company, complete the **partner profile**, and select the **Software Path** (ISV).
- **Then:** pursue **Validated / Differentiated** Software Path status (needs the marketplace listing
  below + a technical validation). This is the on-ramp to **ISV Accelerate** co-sell (AWS AMs get paid
  to sell you) and the **Global Startup Program** (PDM + Solutions Architects).

### B2. AWS Marketplace seller registration + product listing
Code is already built (`src/lib/aws-marketplace.ts` + landing/activate/webhook). Remaining:
- [ ] **Register as a seller:** AWS Marketplace Management Portal (aws.amazon.com/marketplace/management)
      → Seller registration → add **tax + banking** (required for payouts).
- [ ] **Create a SaaS product** (SaaS subscription or contract) → fill listing (use section C copy) →
      submit for review → receive **`AWS_MARKETPLACE_PRODUCT_CODE`**.
- [ ] Set the IAM env vars for metering (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
      `AWS_MARKETPLACE_PRODUCT_CODE`) in Azure Key Vault when the product is live.

### B3. Engage the vertical + accelerators (parallel)
- Contact the **AWS Healthcare & Life Sciences startup team** — Claima's HIPAA + Bedrock posture is
  their ISV profile.
- Apply to **AWS Gen AI Accelerator** + **AWS Healthcare Accelerator** (task #18) — non-dilutive credits + SA/PDM.

---

## C — Listing copy (paste-ready, plain text)

**Short (≤100 chars):**
AI-native RCM that automates the full revenue cycle — eligibility, claims, denials, and billing.

**Long description:**
Claima is an AI-native revenue cycle management (RCM) platform that helps outpatient practices get
paid more and faster across the entire billing lifecycle. It verifies eligibility, scrubs and submits
claims, recovers denied and underpaid claims with AI-generated appeals, posts remittances, and manages
patient billing. Beyond core billing it automates prior authorization, provider credentialing, chronic
care management, OIG screening, and payer-level intelligence. Built for practices of every specialty
and priced on a percentage of what it collects, Claima is HIPAA-compliant with executed Business
Associate Agreements, encryption in transit and at rest, multi-factor authentication, per-practice data
isolation, and full audit logging.

**Categories:** Healthcare, Financial/RCM, AI + Machine Learning
**Logo:** https://claima-web-d89893.azurewebsites.net/apple-icon.png

---

## Sequence / what needs you
1. **Microsoft:** enroll ISV Success (A1) → finish + publish AppSource (A2). *~1–2 hrs of portal work.*
2. **AWS:** join APN (B1) → seller registration + product listing (B2, needs tax/banking). *~1–2 hrs + review time.*
3. Watch for a **Microsoft Engagement Manager** (post-ISV-Success) and pursue **AWS ISV Accelerate**
   once the marketplace listing is live — that's when co-sell leads start.

**Needs your input:** tax + banking (AWS seller payouts), final logos/screenshots upload (AppSource),
and the go/no-go on list-only vs transactable for AppSource (recommend list-only now).
