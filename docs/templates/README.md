# Appeal & escalation templates

De-identified, reusable correspondence templates for A/R recovery. `[BRACKETS]` are
merge fields. Written for Claima's own billing operations; these should graduate into
generated output (AI-drafted, human-reviewed) once the AI layer is live.

**Never commit a filled-in template** — completed letters contain PHI and belong in the
practice's document store, not in git.

| File | Use when |
|---|---|
| `claim-status-inquiry-batch.md` | Aged A/R with no worklog — establish status before appealing |
| `medicare-reopening-request.md` | Medicare claim past the 120-day redetermination window |
| `payer-escalation-no-response.md` | Claim submitted, payer never adjudicated |
| `prior-auth-retro-appeal.md` | Denied for no prior authorization, service medically necessary |
| `corrected-claim-screening-colonoscopy.md` | Screening colonoscopy billed as diagnostic (missing PT/33) |
