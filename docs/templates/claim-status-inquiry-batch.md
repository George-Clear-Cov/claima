# Establishing claim status before appealing

> ⚠️ **Revised 2026-09-02.** The original version of this template assumed a batch 276/277
> through Claim.MD. **Claim.MD's API does not expose 276/277.** Verified against a live
> account: no service endpoint exists under `claimstatus`, `status`, `276`, or
> `statusinquiry` (all return `Unknown service type`), and the per-payer capability flags
> cover eligibility, ERA, attachments, secondary, UB, dental and workers-comp — there is no
> claim-status flag. A control call to `payerlist` returns normally, so this is a capability
> gap, not an auth problem.
>
> **Use the practice's 835 remittance history instead — it is strictly better.** A 277
> returns status; an 835 returns status *and* the CARC/RARC codes that tell you how to
> appeal. Import via `src/lib/import/from835.ts`, which sets `status` from CLP02 and
> populates both `carcCodes` and `rarcCodes`.
>
> Remaining use for a true 276: claims with **no remittance at all** (payer never
> adjudicated). Those need a payer portal or a phone call until a clearinghouse that
> supports 276 is added.

**Why first:** aged A/R with no worklog is *status unknown*, not *denied*. Appealing a
claim the payer never received wastes the appeal and misses the real fix
(resubmission inside timely filing). One electronic batch answers this for every
account at once, instead of N phone calls.

## Procedure
1. Export open A/R: patient, member ID, DOS, billed amount, CPT, payer.
2. Submit a **276** batch through Claim.MD for every open claim.
3. Parse the **277** responses and route:

| 277 status | Meaning | Action |
|---|---|---|
| **A** accepted / in process | Payer has it, still adjudicating | Diary 14 days; escalate if it ages further |
| **F** finalized, paid | Paid — likely unposted | Reconcile against the remit; posting error, not A/R |
| **F** finalized, denied | Real denial | Pull the EOB, categorize the CARC, appeal |
| **R** rejected / **no record** | Payer never received it | **Resubmit now** if inside timely filing |
| **P** pended | Awaiting info | Supply the requested documentation |

4. Only claims confirmed **denied** proceed to the appeal templates.

## Why it matters most for Medicare
Medicare timely filing is **1 year from DOS**. A January 2026 date is filable through
January 2027. If a 276/277 shows no record, that claim is not a lost appeal — it is a
live claim that simply needs submitting.
