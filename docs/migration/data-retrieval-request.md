# Data Retrieval Request — Template

Sent by the practice (or by claima on the practice's behalf) to the **incumbent billing company or prior PM/EHR vendor** to obtain billing data in formats claima can ingest cleanly. Fill in the bracketed fields.

A covered entity has the right to its PHI, and a business associate must return or provide access to PHI on contract termination — **45 CFR §164.504(e)(2)(ii)** and the BAA. Citing this in writing materially speeds up cooperation.

---

**To:** [Billing company / vendor name], [contact]
**From:** [Practice name], [NPI / Tax ID], [authorized signer]
**Date:** [date]
**Re:** Transition of records and data — [Practice name]

[Practice name] is transitioning revenue-cycle operations. Under our agreement and the Business Associate Agreement between us (and consistent with 45 CFR §164.504(e)(2)(ii)), please provide the following no later than **[deadline — e.g., 15 business days]**, via secure encrypted transfer (SFTP or encrypted media):

1. **Patient roster** — all active and inactive patients: demographics **and** insurance (member ID, payer, group #, relationship to subscriber). Format: **CSV or XLSX**.
2. **Claim history** — all claims for the last **[24] months** (or full history). Format preference, in order: **837P batch files**, else a structured **CSV** claim export with line-level CPT/ICD-10/modifier/units/charge.
3. **Remittance history** — all payments/adjustments for the same period. Format: **835/ERA files** (preferred), else structured CSV.
4. **Open accounts receivable** — current aged A/R at the **claim level** (DOS, payer, billed, paid, balance, status). Format: **CSV** (not PDF, if possible).
5. **Patient balances** — outstanding patient-responsibility balances, statement level. Format: **CSV**.
6. **Fee schedule / charge master** — CPT → charge amounts currently in use.
7. **Payer list** — all payers billed, with **payer IDs** and any active EDI/ERA/EFT enrollment or credentialing records.

Please also confirm:
- The **effective date** electronic claim/remittance routing (EDI/ERA/EFT) will be released so it can be re-pointed, and
- Any **claims in flight** as of the transition date and who is responsible for working them through adjudication.

Direct questions and the secure-transfer link to **[claima migration contact / email]**. Thank you for your prompt cooperation in ensuring continuity of care and billing for our patients.

[Authorized signer name / title / signature]

---

### Internal notes (not part of the letter)
- **Best case:** 837 batch + 835 batch + roster CSV → straight into the claima import pipeline.
- **Common case:** CSV claim/AR exports → map via the import spec.
- **Worst case:** PDF-only AR aging → concierge manual entry of open balances; still request 837/835 for everything else.
- Send the request **the day notice is given** to the incumbent; enrollment re-pointing and contract notice periods (30–90 days) gate the timeline regardless of how fast data arrives.
