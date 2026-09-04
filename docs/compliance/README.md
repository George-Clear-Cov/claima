# Compliance — claima

HIPAA compliance evidence pack. **These are internal drafts, not legal advice and not final.**
The BAA and all policies must be reviewed by a healthcare attorney before use. Fields in
`[FILL IN: ...]` / `[BRACKETS]` need real values (dates, phone, signatures).

There is **no government "HIPAA certification."** Compliance is demonstrated through this evidence
trail, sized to the buyer:
- **SMB pilot** → signed BAA + security overview + risk analysis + policies + incident-response plan. *(this pack)*
- **Mid-market / PE** → + security-questionnaire responses + SOC 2 (not started).
- **Enterprise / payer EDI** → SOC 2 Type II and/or HITRUST.

## Documents
| File | Purpose | Audience | Status |
|---|---|---|---|
| `security-overview.md` | 1-page HIPAA posture for prospects | **Prospects** | DRAFT — do not send until entity + BAAs land |
| `hipaa-security-risk-analysis.md` | §164.308(a)(1) risk analysis + risk register | Internal / auditors / OCR | Draft — the legally load-bearing doc |
| `hipaa-policies-and-procedures.md` | Admin / Physical / Technical safeguards + BA/privacy + sanction | Internal / due diligence | Draft |
| `incident-response-and-breach-notification.md` | IR lifecycle + §164.410 breach notification | Internal / due diligence | Draft |
| `officer-designation-and-training.md` | Security/Privacy Officer designation + workforce training log | Internal | Draft |
| `baa-template.md` | Business Associate Agreement (HHS-model + Claima-specific AI/subprocessor terms, w/ Exhibits A–C) | **Sign with each client** | Execution-ready draft — **attorney review required**; fill brackets |
| ~~`security-risk-assessment.md`~~ | Earlier internal assessment | — | **Superseded** by `hipaa-security-risk-analysis.md` |

> Consistency TODO: standardize the officer contact address across all docs (some use
> `george@claima.io`, some `support@claima.io`) and the internal incident channel
> (`[FILL IN: security@claima.io]`).

## What still gates "we are compliant" (updated 2026-07-13)
1. **Legal entity — ⚠️ CORRECTION (2026-08-08).** "Claima LLC" was **never formed.** The NY DOS
   registry shows **PATHFINDER PROJECTS LLC** (DOS ID 7249876, Active) — the $60 Certificate of
   Amendment was decided on 2026-07-11 but never filed. The entity is real and usable, but every
   BAA, marketplace, bank, and insurance form must carry the name **Pathfinder Projects LLC**
   until the amendment is filed and confirmed. Re-check the registry before signing anything.
2. **Execute subprocessor BAAs** — AWS (self-serve/Artifact), Microsoft/Azure (Product Terms), Claim.MD, Stripe. *In progress — entity now unblocks signing.*
3. ~~Close the Anthropic-direct AI gap~~ — ✅ code now **fail-closed** (PHI blocked from any non-BAA AI provider); flip `AI_PROVIDER=bedrock` at cutover.
4. ~~Adopt written policies + designate officer~~ — ✅ **drafted (this pack)**; George Nagib designated Security & Privacy Officer. Needs attorney review + effective dates.
5. **Complete the Azure migration** — retire Vercel/Supabase (no BAA on current tiers) onto Azure (host + DB + secrets under the Microsoft BAA). Runbook: `docs/azure-migration.md`.
6. **Rotate exposed secrets + disable Supabase Data API** (interim, pre-migration).
7. **Conduct + document workforce HIPAA training** (before any PHI access).
8. **Bind cyber + E&O insurance.**
9. **Attorney review** of the BAA, service agreement, and the %-of-collections model (Anti-Kickback/Stark).
10. Optional: stand up **Vanta/Drata** to automate evidence and start the SOC 2 runway.

Last updated: 2026-07-13.

## BAA: two versions, keep them in sync
| Where | What it is | Use |
|---|---|---|
| `docs/compliance/baa-template.md` | Full negotiated agreement + Exhibits A–C | Wet/e-signature with a named practice; what counsel and PE diligence will read |
| `src/app/baa/page.tsx` (`/baa`) | Click-through version accepted at signup (`BaaGate`, timestamp + IP stored) | Self-serve signup |

**Known drift in the click-through version (`/baa` v1.0, eff. 2026-06-16) — fix before real clients:**
- Business Associate is named as "claima.io," not a legal entity. Must read **Pathfinder Projects LLC d/b/a Claima**.
- Subprocessor list is stale: names Vercel (being retired) and Stripe (§1179 — receives no PHI), and **omits AWS Bedrock and Claim.MD**.
- **No AI clause at all** — the full agreement's §3 (BAA-covered inference, no model training on PHI, no provider retention, human oversight) is the single most-asked question in diligence and the license for the de-identified data moat (§2.5). Missing here.
- Breach notice is **30 days**; the full agreement says **5 business days**. A 30-day vendor notice eats half the covered entity's own 60-day clock and reads as unserious.
- §9 lets Claima **amend the BAA unilaterally** ("continued use constitutes acceptance"). Counsel will strike it; it is also weak under §164.504(e).
- Missing: minimum-necessary-on-request timelines, US-only processing, return/destroy timeline, insurance, de-identification authorization.
