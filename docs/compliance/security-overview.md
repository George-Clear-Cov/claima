# Claima — Security & HIPAA Overview

> ⚠️ **DRAFT — NOT FOR EXTERNAL DISTRIBUTION.** Do not share until the legal entity is formed and
> subprocessor BAAs are executed. Controls marked *(in progress)* below are not yet in place.

*For prospective practice partners. Summarizes how Claima protects Protected Health
Information (PHI). A signed Business Associate Agreement (BAA) is executed with every
practice before any PHI is processed.*

---

## Summary
Claima is built HIPAA-first. All PHI is encrypted in transit and at rest, access is
role-based and isolated per practice, and every access to PHI is logged. When AI processes PHI,
it runs only on BAA-covered cloud infrastructure (AWS Bedrock / Microsoft Azure). We sign a BAA
with your practice as part of the pilot agreement.

## Safeguards

### Administrative
- Designated Privacy Officer and Security Officer.
- Documented security risk assessment, reviewed at least annually.
- Written Privacy, Security, and Breach Notification policies.
- Workforce access on a least-privilege, need-to-know basis; access reviewed and revoked on role change.
- Incident response and breach notification procedures.

### Physical
- No PHI stored on local/office hardware — all PHI resides in HIPAA-eligible cloud infrastructure (see Subprocessors).
- Cloud data centers maintain SOC 2 / ISO 27001 physical-security controls.
- Workforce devices use full-disk encryption and automatic screen lock.

### Technical
- **Encryption:** TLS 1.2+ in transit; AES-256 at rest.
- **Tenant isolation:** every record is scoped to a single practice; users can never access another practice's data. Verified by recurring automated security audits.
- **Access control:** unique per-user credentials, JWT sessions, role-based access, and Microsoft Entra (Azure AD) single sign-on. *(MFA for password logins and idle-session timeout: in progress.)*
- **Audit logging:** every PHI access (who, what, when, IP) is recorded in an audit log, retained per our retention policy.
- **Monitoring:** application error monitoring with PHI automatically stripped before capture.
- **Input validation** on all data-entry points; rate limiting on public endpoints.

## Data handling
- **Minimum necessary:** for a denial-recovery pilot, Claima processes only the data needed to work denied claims (claim, denial/CARC, payer, and the patient identifiers required for appeals). No broader PHI is ingested.
- **No secondary use without authorization.** Any future de-identified benchmarking will use HIPAA Safe-Harbor de-identification and will never expose one practice's data to another.
- **Return/destruction:** on termination, PHI is returned or securely destroyed per the BAA.

## Subprocessors
*A signed BAA with each PHI-processing subprocessor is executed before any production PHI is
processed. Status below reflects current progress.*

| Subprocessor | Role | BAA status |
|---|---|---|
| Amazon Web Services (Bedrock) | AI processing | Pending — self-serve BAA via AWS Artifact |
| Microsoft Azure | Hosting, database, AI | Pending — Microsoft BAA (Product Terms) |
| Claim.MD | Clearinghouse (claims/ERA/eligibility) | Pending — BAA requested |
| Stripe | Patient payments (conduit) | Pending — BAA requested |

*(BAA status current as of the date above; updated as infrastructure evolves. The stack is
consolidating onto Azure + AWS Bedrock — Vercel/Supabase are being retired.)*

## Incident response
Security incidents are triaged immediately. In the event of a breach of unsecured PHI,
Claima notifies the affected practice without unreasonable delay and no later than the
timeframe required by our BAA and 45 CFR §164.410.

## Compliance posture
- HIPAA Security Rule risk assessment: documented and maintained.
- SOC 2 Type II: planned (not yet started; ~6-month observation period once begun).
- Note: HIPAA has no government "certification"; compliance is demonstrated through the
  controls, documentation, and BAAs above, which we make available on request.

**Contact:** George Nagib, Privacy & Security Officer — [george@claima.io]

*This overview is provided for informational purposes and does not modify the terms of any
executed Business Associate Agreement or service agreement.*
