# Claima — Inbound-Only Marketing Plan

> Objective: build a demand engine so strong that practices, PE platforms, and RCM firms
> reach out to us. No cold outreach. Marketing does the job sales would have done.
> Author: strategy session 2026-07-11.

---

## 0. The strategic problem, stated honestly

We are asking marketing to do something hard: generate inbound demand for a company with
**zero customers, zero brand, no case study, and no registered entity.** Standard inbound
playbooks (blog + SEO + nurture) assume you already have proof. We don't.

So we can't market the product. **We have to market the problem — and prove it exists using
the prospect's own data, for free, in ten minutes.**

Everything below follows from that one decision.

---

## 1. Positioning

### Category
Do **not** compete in "medical billing software." That's a red ocean owned by Tebra, Kareo,
Waystar, AdvancedMD — all with budget and incumbency.

Create and own a new category:

> **Revenue Yield Management for outpatient medicine.**

"Yield management" is a term finance buyers (PE operating partners, platform CFOs) already
respect from airlines and hotels. It reframes the conversation from *cost of billing* to
*optimization of revenue* — a category where nobody is currently standing, and where a
payments/banking operator is the credible person to plant the flag.

### The villain
Every category needs an enemy. Ours is structural and true:

> **The RCM industry is paid a percentage of what it collects. Which means it is paid to
> process claims — and never paid to find the money it failed to collect. Nobody in the
> value chain is paid to notice that your payer quietly underpaid you 12% on 97110 for
> eight months.**

That is the indictment. It's not a competitor attack, it's an incentive critique — which is
far more durable and far more shareable.

### Lines
- **One-liner:** Claima is the revenue-yield layer for outpatient practices — AI that audits
  every payment against what you should have been paid, and recovers the difference.
- **Hero:** *You didn't lose the money. Nobody looked for it.*
- **Alt:** *Your biller submits claims. We audit the payer.*

### Message ladder by buyer
| Buyer | The message |
|---|---|
| Physician-owner | "You are being underpaid and you cannot see it. Find out in 10 minutes, free." |
| Practice manager | "Every denial worked, every appeal drafted — without hiring anyone." |
| PE operating partner / platform CFO | "3–7% net collections lift across the portfolio. No system migration. Here's the diagnostic." |
| RCM firm owner | "Your clients will eventually ask why you didn't catch this. Run our engine underneath your service." |

---

## 2. The wedge product change (most important strategic point)

**Do not lead with "switch your billing to Claima."** That's a migration, a switching cost,
a committee, and a sales cycle. It is structurally incompatible with inbound-only.

**Lead with recovery.**

> "Let us find and recover the money you've already lost. Contingency fee — we're paid only
> from money we recover that you were never going to get. No system change. No migration.
> No risk."

That is a yes-in-one-conversation offer. It requires no trust we haven't earned, no
switching cost, and no demo. Once we've delivered found money and we hold their AR and
payment history, converting them to the full billing platform is a formality.

- **Land:** recovery (contingency, zero-risk, no migration)
- **Expand:** full RCM → prior auth → CCM → credentialing → MIPS → payer intelligence

---

## 3. The centerpiece: The Claima Leak Report

**A free, no-signup, browser-based diagnostic that tells a practice exactly how much money
it is losing — using its own remittance data.**

### How it works
1. Practice drags in their last 90 days of 835/ERA files (they already have these; every
   clearinghouse produces them).
2. **The file is parsed entirely in the browser. It never leaves their machine.** We
   transmit only de-identified rate facts (CPT, payer, allowed, paid, adjustment codes) —
   no patient identifiers, no PHI.
3. Instant report, four leakage buckets:
   - **Denials never reworked** — count × average allowed amount (industry: ~65% never reworked)
   - **Underpayments** — actual paid vs. peer/benchmark allowed for the same CPT + payer + geography
   - **Under-coding** — their E/M distribution vs. specialty peers (the 99213 vs. 99214 curve)
   - **Uncaptured recurring revenue** — CCM-eligible patients, PA-preventable denials
4. Headline output: **"You are leaving $184,000 a year on the table."** One number. A
   shareable, branded PDF.

### Why this is the whole strategy
- **It replaces the sales team.** The report qualifies, diagnoses, quantifies, and pitches —
  which is exactly what an SDR and an AE would have done.
- **It manufactures the proof we don't have.** We have no case study. So we use the
  prospect's own data as the case study.
- **It is inherently viral inside the buying unit.** The office manager forwards it to the
  physician-owner. The platform CFO forwards it to the PE operating partner. That forward
  *is* the inbound.
- **It bootstraps the data moat pre-revenue.** Every ERA a *prospect* uploads improves our
  cross-practice rate benchmark. Our moat compounds on prospects, not just customers — which
  means the demand engine and the moat are the same machine.
- **The privacy architecture is itself a marketing message.** "Your file never leaves your
  browser" is a trust unlock in a market that is terrified of PHI.

> ⚠️ **Compliance gate:** the client-side-parse design is what keeps this out of PHI scope.
> It must be reviewed and confirmed before launch, and the de-identification boundary
> documented. Do not ship a version that uploads raw 835s.

---

## 4. The five demand engines

### Engine 1 — The Leak Report *(the conversion layer)*
See above. Every other engine exists to drive traffic into it.

### Engine 2 — The Knowledge Graph *(programmatic SEO + AI-answer optimization)*

We already own the raw material: 251 CPT codes across 25 specialties, a full CARC/RARC
reference, payer IDs, modifier rules, NCCI edit pairs, timely-filing limits, prior-auth
rules. That's a content moat sitting unused in a database.

Publish it as the best free reference on the internet:
- `/denial-codes/co-97` — what it means, why it fired, exactly how to appeal, template letter
- `/cpt/97110` — reimbursement by payer and geography, common denials, modifier rules
- `/payers/cigna` — denial rate, average days to pay, known behavioral quirks

Every page ends with the same CTA: *run the free Leak Report on your own data.*

This is the long tail a biller actually searches at 4pm on a Tuesday. Two channels at once:

- **Google:** thousands of high-intent, low-competition long-tail queries.
- **AI assistants (the 2026 channel that matters):** billers now ask ChatGPT and Claude "why
  was my claim denied CO-197." Being the source the models cite is the new #1 ranking. It
  favors us: clean structure, direct factual answers up top, and citations to CMS/NCCI make
  a page trustworthy to a model — and the incumbents have not adapted.

> **Quality bar is non-negotiable.** A coding audience will destroy us for one wrong modifier
> rule, and a wrong page poisons model trust permanently. Budget for a certified coder to
> review. **300 excellent pages beat 5,000 mediocre ones.**

### Engine 3 — The Index *(data PR / earned media)*

Publish the **Outpatient Payer Performance Index**, quarterly.

- **v1 runs on public data** — CMS fee schedules, CMS marketplace denial-rate data, and
  critically the **Transparency in Coverage machine-readable files**: payers are legally
  required to publish their negotiated rates, the files are enormous, and essentially no
  practice can parse them. We can.
- Rank payers by denial rate, days to pay, and negotiated-rate spread, cut by specialty and
  metro.
- **v2+ adds our first-party claims corpus** — at which point it becomes uncopyable.

Three jobs at once: it earns press and backlinks (Becker's, Fierce Healthcare, HFMA,
MedPage, specialty-society newsletters all run data-driven stories for free); it is the
artifact a PE operating partner forwards internally; and it establishes Claima as the
authority in the category we're naming. An annual **Payer Report Card** becomes a recurring
news event we own.

> Never publish a benchmark we don't actually have. Transparent sourcing or nothing — in a
> compliance-sensitive market, one fabricated stat is fatal.

### Engine 4 — Founder-led point of view *(LinkedIn + essays)*

The unfair asset is the founder profile: **an AmEx payments and banking operator building
the money layer for outpatient medicine.** That is a completely different voice from every
RCM vendor, and it's the same credibility that makes the fundraising narrative work.

- Cadence: 3 LinkedIn posts/week, one deep essay every two weeks.
- Pillars:
  1. **Teardowns** — "I parsed Cigna's public rate file for New Jersey physical therapy.
     Here's the spread between the best- and worst-paid practice for 97110."
  2. **The villain thesis** — why RCM's incentive structure guarantees leakage.
  3. **Building in public** — shipping, learning, the honest parts.
  4. **PE-facing analysis** — physician roll-up economics, revenue quality in diligence.
- Why it produces inbound with zero outreach: **the teardown post *is* the outreach.** We
  publicly analyze the exact payer, specialty, and metro our ICP lives in — and they
  self-identify in the comments.

### Engine 5 — Ecosystem distribution *(channels that market for us passively)*

- **Microsoft AppSource** — effectively ready; ship it.
- **AWS Marketplace** — code complete; finish seller registration.
- **Claim.MD partner/vendor directory** — free, high-intent, and we're already a customer.
- **athenahealth marketplace** — 2027, but start the application early.
- **Specialty societies** (APTA, AAFP, ACP, APA) — offer the free specialty benchmark report
  as a public good. An endorsement reaches 10K–100K physicians in one motion.
- **State MGMA chapters** — they actively need speakers with real data. Presenting the Index
  is inbound, not outbound: the room self-selects.

---

## 5. The funnel (stranger → signed client, zero outreach)

1. **Discover** — SEO page, LinkedIn teardown, Index press, marketplace listing, society newsletter
2. **Diagnose** — free Leak Report. No signup. No PHI leaves the browser. The aha is a dollar figure.
3. **Prove** — email to unlock the full PDF + 12-month recovery projection. Now we have a lead
   who has *already seen their own number*.
4. **Convert** — contingency recovery offer. "We're paid only from money we find that you
   weren't going to get." Nobody needs a demo to say yes to that.
5. **Expand** — recovery → full billing → prior auth → CCM → credentialing → MIPS.

---

## 6. Sequencing

### Days 0–30 — build the asset, clear the gates
- [ ] **Rename the entity — ~$70, essentially unblocked.** *(Resolved 2026-07-11.)* Pathfinder
      Projects LLC (NY, Feb 2024, Active, **newspaper publication already completed**, dormant —
      no revenue/debt/contracts) gets reused. File the past-due $9 Biennial Statement, then a $60
      Certificate of Amendment → **Claima LLC**. No republication triggered. Then run the name +
      EIN cascade across Stripe, Partner Center, AWS Seller, insurance, and the BAAs — mismatches
      are what fail marketplace verification. See [[entity-setup]].
- [ ] Build the **Leak Report** (browser-side 835 parser — we already have 835 parsing code).
      Compliance review of the de-identification boundary before launch.
- [ ] Rewrite claima.io around the yield narrative and the Leak Report. Kill the feature list.
- [ ] Ship the first **100 knowledge-graph pages** (highest-volume CARC codes + top 50 CPTs).
- [ ] Start the LinkedIn cadence.

### Days 30–90 — make noise, capture demand
- [ ] Ship **Payer Performance Index v1** from public TiC + CMS data. Pitch to Becker's,
      Fierce Healthcare, HFMA, specialty press.
- [ ] Knowledge graph to **500+ pages**. Track AI-assistant citations, not just Google rank.
- [ ] Publish 2–3 public payer teardowns (one per ICP specialty).
- [ ] AppSource live. Claim.MD partner directory listed.
- [ ] **Target: first 3 design partners, sourced entirely from the Leak Report funnel.**

### Months 3–6 — compound
- [ ] **First quantified case study** — "recovered $61K in 90 days for a 4-provider PT group."
      This becomes the single most valuable marketing asset we will ever own. Everything above
      exists to produce it.
- [ ] **Index v2** with first-party data — the moment it carries our own corpus, it's uncopyable.
- [ ] Specialty-society outreach with the free benchmark as a public good.
- [ ] **PE channel:** publish a public "revenue diligence" teardown of physician roll-up
      economics. Operating partners find *us*.
- [ ] Start SOC 2 observation period (a marketing asset — badge goes up the day it's real,
      never before).

### Months 6–12 — become the reference
- [ ] The Index gets quoted by other people. **That is the leading indicator inbound is working.**
- [ ] Conference talks: MGMA Annual (Oct), HIMSS (March), McGuireWoods Healthcare PE
      conference (the PE channel's watering hole).
- [ ] Formalize the referral loop — every practice with a Leak Report can co-brand and send
      it to peers.

---

## 7. Metrics

**Leading (watch weekly)**
- Leak Reports run
- % of reports revealing >$50K in leakage
- Email-unlock rate on the report
- Organic sessions on knowledge-graph pages
- **Number of AI-assistant answers citing Claima** (new-channel leading indicator)
- Inbound "how do I get this?" messages

**Lagging**
- Inbound-qualified conversation → client conversion
- CAC (near-zero cash; high time)
- **Dollars recovered per client** — this is the case-study fuel and the real product metric
- NRR (target >150%, per the fundraising narrative)

**The single number that says the strategy is working:**
> Inbound qualified conversations per week, with zero outbound sent.
> If that's flat 90 days after the Index and knowledge graph ship, the content is not
> quantifying pain sharply enough. Fix the sharpness, not the volume.

---

## 8. Budget

This is a near-zero-cash plan by design, which fits a pre-raise founder.

| Item | Cost |
|---|---|
| Entity + E&O/cyber + attorney | $5–10K *(already required)* |
| Certified coder to fact-check the knowledge graph | ~$2–3K |
| Design pass on the Leak Report PDF | ~$1–2K |
| Fractional healthcare PR (only once the Index has traction) | $3–5K/mo |
| **Paid ads** | **$0 — do not.** |

Paid search in RCM is expensive and converts badly against incumbents with real budget. Our
unfair advantage is proprietary data and a point of view, not a media budget. Spending on ads
would be competing on their terms.

---

## 9. Honest constraints

1. **Inbound-only is slower to start and faster to compound.** Expect ~90–120 days of near-
   silence before the flywheel turns. If a client is needed in 30 days, the compromise is to
   put the Leak Report directly in front of 20 reachable practices — technically outreach, but
   you're delivering an artifact, not a pitch.
2. **The missing case study is the biggest gap.** The Leak Report is designed specifically to
   paper over it by substituting the prospect's own data. But we must convert that into one
   real, quantified case study by month 6 or the plan stalls.
3. **Marketing cannot outrun the legal gates.** Entity, BAAs, E&O, PECOS. Demand we can't
   sign is demand we burn.
4. **The knowledge graph must be correct.** One wrong modifier rule and a professional
   audience is gone. Budget for coding review.
5. **Never publish data we don't have.** v1 Index is public-data-sourced and transparently
   labeled as such.

---

## 10. If you only do three things

1. **Ship the free Leak Report.** It is the sales team, the proof, and the data moat in one
   artifact.
2. **Change the wedge from "switch to us" to "let us recover what you already lost."**
   Contingency, no migration, no risk — the only offer that closes without a sales motion.
3. **Publish the Payer Performance Index.** It's what makes PE firms and journalists come to
   you instead of the reverse.

---

Related: [[phase2-moat-strategy]] · [[gtm-appsource]] · [[pe-target-list]] · [[fundraising]] · [[client-readiness]]
