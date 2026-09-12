# Outreach pipeline — the repeatable loop

Last run 2026-09-09. Everything below is scripted or a documented API call.

---

## Daily loop

**1. Source (free).** Apollo people search — no credits.
- **Billing companies (Model A):** titles CEO/President/Owner/Founder/COO · US ·
  11–200 employees · keyword tags `revenue cycle management`, `medical billing services`,
  `denial management`, `accounts receivable management` · email status `verified`.
  **~4,000–5,000 available.** Page through with `page`.
- **Practices (Model B):** titles billing manager / revenue cycle manager / practice
  administrator · NY/NJ/CT · keyword tags `orthopedics`, `spine`, `oncology`, `neurosurgery`.

**2. Filter before spending a credit.** Drop:
- Offshore firms (Pakistan/India-based billing shops — different buyer, different economics)
- Competitors and vendors (Zentist, Dental-X AI, RCM software companies)
- Academic/health-system addresses (Weill Cornell, Columbia, Mount Sinai campuses)
- Non-fits that slip through keyword matching (vet clinics, device makers)

**3. Enrich (1 credit each).** `apollo_people_bulk_match`, max 10 per call.
⚠️ **Check the returned employer.** Apollo returns their *current* job — Kevin Babb came back
at a geriatrics practice, not the billing company he was listed under. Wrong pitch if unchecked.

**4. Create contacts.** `apollo_contacts_bulk_create`, max 100 per call.
**Enrichment alone does NOT create a contact** — and `emailer_messages_create` needs a
`contact_id`. Label them: `Claima - Billing Companies` / `Claima - Practices Tier A|B`.

**5. Draft.** `~/claima/scripts/billing_company_drafts.py` or `practice_drafts.py`.
Target **~85 words**: firm-specific hook → the 68% / $65,287 finding → leak-report link → ask.
**Never** include a signature — Apollo appends its own. End with the CAN-SPAM line only.

**6. Queue.** `emailer_messages_create` → `emailer_messages_send_now`.
Apollo throttles at the mailbox hourly limit (~6/hr) and returns `status: "scheduled"`
rather than failing. **That throttle is the scheduler — there is no schedule parameter.**

---

## Capacity

| | |
|---|---|
| Apollo credits | **2,500/cycle** → **~90 enrichments/day** sustainable (cycle resets Oct 7) |
| Sends, claima.io | ~6/hour, ramping 15–20/day → 30 → 50 |
| Sends at 100+/day | **Requires secondary domains** — see below |

## ⚠️ The infrastructure gap
**Cold email should not go from claima.io.** It carries client replies, BAAs, the leak report
and investor contact. Buy 2–3 secondary domains (~$12/yr each), 2–3 mailboxes on each, forward
replies to george@claima.io. That is the unlock for 100+/day and it protects the domain that
actually matters.

## Bounce watch
Catch-all domains can't be verified by Apollo and bounce risk is real. Currently flagged:
`healthbilling.net` · `synhs.com` · `healthquist.com` · `mountainvalleyortho.com` ·
`comcllc.com` · `coastalspine.com` · `bergenmed.com` · `hhsnj.org`.

---

## Status

**Sent 2026-09-09 (6):** Sumii · Saunders · Freund · Gruber · Turner · Nathe
**Queued 2026-09-09 (4):** Muradyan · Buchell · Tomas · Steffen

**Ready for 2026-09-10 — 29 contacts created, drafts written, nothing queued yet:**
- **9 billing companies** — `drafts-billing-batch2.md`
  Keele · Young · Knight · Barai · Morgan · Romney · Scott · Caspar · Runyeon
- **20 practices** — `drafts-ALL.md` (11 Tier A with dollar figures, 9 Tier B without)

**To send tomorrow:** queue them with `emailer_messages_create` → `send_now`; Apollo's hourly
limit spreads them out on its own.

## Reply handling — the actual gap
There is no process for what happens when someone answers. At 30/day and a 3% reply rate that
is roughly one live conversation a day. **Decide the next step before the first reply lands:**
what you send when they say "sure, tell me more," and what the first paid engagement looks like.
