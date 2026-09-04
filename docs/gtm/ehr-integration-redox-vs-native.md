# EHR Integration: Native vs. Aggregator (Redox / Health Gorilla) — Decision One-Pager

> For **task #12**. Question: to reach practices inside their EHR, do we build **native**
> integrations (one per EHR) or go through an **aggregator** (Redox, Health Gorilla) that
> normalizes many EHRs behind one API?

## What Claima actually needs from an EHR
For the denial-recovery wedge, we read: **claims/charges, remittances (835/ERA), patient +
insurance/eligibility, appointments** — and optionally write back **appeal status / notes / tasks**.
Read-mostly, moderate volume, not real-time-critical.

## The two paths

| | **Native (per-EHR API)** | **Aggregator (Redox / Health Gorilla)** |
|---|---|---|
| **Reach** | One EHR per build | Many EHRs behind one integration |
| **Build effort** | High × N (each EHR's API, auth, quirks) | One integration; aggregator maps each EHR |
| **Time-to-first-EHR** | Weeks per EHR | Weeks once, then new EHRs are config |
| **Marketplace listing** | Yes — you're *in* athenahealth/Elation/etc. Marketplace (distribution + leads) | Usually no native marketplace placement; you connect but aren't "listed" |
| **Data depth/fidelity** | Full, EHR-specific fields | Normalized (may lose some EHR-specific detail; RCM/claims coverage varies by EHR) |
| **Cost** | Eng time + each EHR's partner/rev-share terms | Aggregator platform fee (subscription + per-connection/volume) on top of your eng |
| **Coopetition risk** | You depend on each EHR's partner goodwill (some sell their own RCM) | Sidesteps single-EHR politics |
| **Ongoing maintenance** | You maintain N integrations | Aggregator maintains the connectors |

## Recommendation for Claima (this stage)

**Hybrid, in this order:**

1. **Native with athenahealth first** — but only because the **Marketplace listing is the
   distribution** (leads + credibility with 160k providers). The listing value, not just the data
   pipe, justifies the native build. (Task #11.)
2. **Aggregator (Redox) for breadth** — use Redox/Health Gorilla to cover the *long tail* of EHRs a
   pilot practice happens to use, so we're not blocked waiting on N native partner approvals. This is
   the fastest way to say "yes, we integrate with your EHR" in a sales call.
3. **Native for a second EHR only when demand pulls it** — add Elation/DrChrono natively when we have
   ≥[FILL IN] practices on that EHR and want its marketplace placement.

**Why not aggregator-only:** you lose the marketplace *listings* (a real lead channel) and claims/ERA
coverage through aggregators varies — validate that Redox/Health Gorilla expose the **remittance/claims**
data we need for each target EHR before relying on them for the core wedge.

**Why not native-only:** N× build + N× partner approvals is too slow pre-scale, and it makes every
sales conversation gated on "is your exact EHR one we've built."

## Decide by answering these
- [ ] Do Redox / Health Gorilla expose **claims + 835/ERA** (not just clinical) for our top target EHRs? (Confirm with each — this is the make-or-break for the wedge.)
- [ ] What's the aggregator pricing at our scale (base + per-connection/volume)? Get quotes.
- [ ] Which EHR is our first pilot practice actually on? (That may set the native-first choice.)
- [ ] Eng capacity: one native (athenahealth) + one aggregator onboarding in parallel — realistic this quarter?

## ✅ DECISION (2026-07-17) — athenahealth: GO NATIVE

Validated live against the athenaOne preview sandbox (practice 195900) via
`scripts/athenahealth-sandbox-test.ts`:
- OAuth `client_credentials` ✅ · 32 departments / 216 providers ✅
- **`GET /claims?patientid=…` returns the full wedge data:** per-payer adjudication
  **status + balance** (`primaryinsurancepayer.status`/`balance`, e.g. "ATHENAHOLD" / "CLOSED"),
  **procedures** (CPT + chargeamount), **diagnoses** (ICD), payers, service dates, and the
  transaction breakdown. Claim detail drill-down works.
- `/claims/changed` (bulk sync) returns 403 until a **one-time subscription** is set up
  (POST) — do that for production polling.

**Verdict:** athenahealth native covers denial recovery — build the native integration for the
MDP listing. **Redox/Health Gorilla is reserved for reaching OTHER EHRs** (Elation, DrChrono,
eCW, …) with one build, not for athenahealth.

## Next actions
- Get **Redox** + **Health Gorilla** to confirm claims/ERA data access for athenahealth, Elation, DrChrono, eCW + send pricing.
- Proceed with **athenahealth native** for the marketplace listing (task #11).
- Revisit second native EHR when a pilot cluster forms on one.
