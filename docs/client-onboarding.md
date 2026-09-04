# Client Onboarding Runbook — per-practice

The operational checklist for taking a signed practice live on claima. Designed around
the hard constraint: **payer EDI/ERA enrollment takes 3–30 days per payer and ERA can
only point at ONE clearinghouse.** We don't fight the wait — we fill it.

Strategy in one line: *go live on day 1 with the payers that need no enrollment + their
aged AR, while the slow enrollments process payer-by-payer in the background.*

---

## Phase 0 — At contract signing (day 0)

- [ ] **Send the data-retrieval request the same day** (template: `docs/migration/data-retrieval-request.md`).
      If they outsource, the incumbent's 30–90-day notice period is the real clock — start it now.
- [ ] **Collect:** NPI(s), Tax ID, taxonomy, payer list ranked by revenue (from their PM
      system or last 90 days of remits), portal logins for their top payers, CAQH ID.
- [ ] **Tell them to keep the incumbent/portal access alive** through cutover — we need it
      for remits that haven't flipped yet. Do NOT cancel anything on day 0.
- [ ] Add practice NPI + Tax ID to the Claim.MD account.

## Phase 1 — Payer triage (day 0–1)

- [ ] Run every payer through Claim.MD's payer list (`lookupPayer` / portal payer search).
      Bucket into:
      | Bucket | Meaning | Action |
      |---|---|---|
      | **Wave 1 — no enrollment** | claims can transmit immediately | live on day 1 |
      | **Wave 2 — enrollment required** | forms/portal + 3–30 days | initiate day 0, sequence by revenue |
      | **Unavailable** | payer not supported for that type | paper/portal workaround; flag |
- [ ] **Initiate ALL Wave 2 enrollments on day 0** — `POST /api/practices/payers/{payerId}/enroll`
      (or portal). Top-5 revenue payers first; they are the long poles.
- [ ] **Provider validation call** — Claim.MD requires an on-demand call at first enrollment.
      Schedule the practice contact, click "Call Now" together. Do this day 0–1; it gates everything.
- [ ] ERA enrollment per payer (quick-enroll where offered). ERA re-points **per payer** as
      each one lands — never all at once.
- [ ] Activate eligibility per payer.

## Phase 2 — Fill the enrollment window (day 1–30) ← the value bridge

While Wave 2 processes, the practice should already be making money with us:

- [ ] **Wave 1 payers live:** submit new claims to no-enrollment payers immediately.
- [ ] **Found-money sweep:** import their aged AR + denied claims (837/835 import,
      `docs/migration/import-spec.md`) and start AI appeals + recovery on write-offs.
      Goal: recovered dollars they can see in week 1–2.
- [ ] **Patient balances:** load open statements; start payment links + outreach cadence.
- [ ] **Eligibility + scrubbing live** for all visits (no enrollment needed).
- [ ] Weekly status email: per-payer enrollment progress + dollars recovered so far.

## Phase 3 — Payer-by-payer go-live (rolling)

For each Wave 2 payer as its enrollment clears:
- [ ] Flip new-claim submission to claima.
- [ ] Confirm first ERA lands with us; until then, pull remits from the incumbent/payer
      portal and post manually (concierge).
- [ ] Mark payer ACTIVE in the app (Payers tab) — the practice sees the board go green.

## Phase 4 — Cutover complete

- [ ] All top payers ACTIVE; last incumbent remit older than 30 days.
- [ ] Practice confirms incumbent termination (their contract, their call).
- [ ] Consider flipping Claim.MD **"Transmit Approval Required" OFF** (Settings → Account
      Settings) once we trust the scrub pipeline for this practice — default ON until then.
- [ ] Retro: days-to-first-dollar, days-to-full-cutover, enrollment stalls → feed the playbook.

---

## Ops notes

- **The ERA single-clearinghouse rule is the bottleneck AND the moat.** Painful coming in;
  equally painful for anyone trying to leave us later.
- **Never big-bang.** Every step above is per-payer and reversible; the practice always has
  a working path to get paid.
- **Comms beat speed.** A practice that sees "Medicare: day 12 of ~21" stays calm. Silence
  reads as stalled — send the weekly status every week even when nothing changed.
- Escalation: enrollment stuck >21 days → Claim.MD support ticket + payer EDI desk call.
