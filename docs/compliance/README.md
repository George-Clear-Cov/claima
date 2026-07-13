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
| `baa-template.md` | Business Associate Agreement (HHS-model based) | Sign with each client | **Draft — attorney review required** |
| ~~`security-risk-assessment.md`~~ | Earlier internal assessment | — | **Superseded** by `hipaa-security-risk-analysis.md` |

> Consistency TODO: standardize the officer contact address across all docs (some use
> `george@claima.io`, some `support@claima.io`) and the internal incident channel
> (`[FILL IN: security@claima.io]`).

## What still gates "we are compliant" (updated 2026-07-13)
1. ~~Register the legal entity~~ — ✅ **DONE. Claima LLC formed.**
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
