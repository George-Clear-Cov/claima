# Claima — Incident Response & Breach Notification Plan

> **Draft for internal review; not legal advice — have healthcare counsel review before use.**
> Some controls referenced below are marked *(pending)* and are not yet fully in place.

**Entity:** Claima LLC (New York limited liability company)
**HIPAA role:** Business Associate (BA) — Claima processes Protected Health Information (PHI)
on behalf of provider practices (Covered Entities, "CE").
**Security Officer AND Privacy Officer:** George Nagib — support@claima.io, [FILL IN: phone].

---

## 1. Purpose & Scope

This plan defines how Claima detects, responds to, contains, and reports security incidents
and breaches of Unsecured PHI. It exists to satisfy Claima's obligations as a Business
Associate under the HIPAA Security Rule (45 CFR §164.308(a)(6) — Security Incident Procedures)
and the Breach Notification Rule (45 CFR Part 164, Subpart D, §§164.400–414), and to honor the
notification commitments in each executed Business Associate Agreement (BAA).

**Scope.** This plan covers all systems, subprocessors, and workforce members that create,
receive, maintain, or transmit PHI on behalf of a Covered Entity, including Claima's
application, database, AI processing path, and all subprocessors listed in §4 of the Security
Overview.

**Relationship to other documents.** This plan is one component of Claima's HIPAA Policies &
Procedures. It should be read together with:
- `security-overview.md` — administrative, physical, and technical safeguards, and the
  current subprocessor list.
- `baa-template.md` — Claima's contractual reporting obligations to each CE (§3(c) requires
  reporting any impermissible use/disclosure, Security Incident, and Breach of Unsecured PHI
  without unreasonable delay and no later than the number of business days stated in that BAA).
- The HIPAA Security Risk Assessment (maintained separately) — identifies the risks this plan
  is designed to respond to.

Where a specific executed BAA imposes a **shorter** notification deadline than this plan's
default, the BAA controls.

---

## 2. Definitions

Terms not defined here have the meaning given in the HIPAA Rules (45 CFR Parts 160 and 164).

- **Security Incident** (45 CFR §164.304): the attempted or successful unauthorized access,
  use, disclosure, modification, or destruction of information or interference with system
  operations in an information system. *Not every security incident is a breach.* Routine,
  unsuccessful probes (e.g., blocked port scans, failed logins, rate-limited requests) are
  security incidents that are logged and reviewed but generally do not require CE notification;
  see §7 for how the BAA addresses these.

- **PHI / ePHI:** Protected Health Information (45 CFR §160.103); ePHI is PHI in electronic
  form. Claima handles ePHI.

- **Unsecured PHI** (45 CFR §164.402): PHI that is **not** rendered unusable, unreadable, or
  indecipherable to unauthorized persons through encryption or destruction meeting the HHS
  Guidance (encryption per NIST standards; destruction per NIST 800-88). PHI properly
  encrypted at rest (AES-256) and in transit (TLS 1.2+), with keys not compromised, is
  **secured** — a compromise of secured PHI is generally **not** a reportable breach.

- **Breach** (45 CFR §164.402): the acquisition, access, use, or disclosure of **Unsecured
  PHI** in a manner not permitted by the Privacy Rule that **compromises the security or
  privacy** of the PHI. An impermissible use or disclosure of Unsecured PHI is **presumed to
  be a breach** unless Claima demonstrates a **low probability that the PHI has been
  compromised** through the four-factor risk assessment in §6.

- **Breach exceptions** (45 CFR §164.402(1)): the definition of breach excludes (i) unintentional
  good-faith access by a workforce member acting within scope, with no further impermissible
  use/disclosure; (ii) inadvertent disclosure between authorized persons at the same CE/BA/OHCA,
  with no further impermissible use/disclosure; and (iii) a disclosure where the BA has a good-faith
  belief the unauthorized recipient could not reasonably have retained the information.

- **Security incident vs. breach — the difference:** every breach begins as a security incident,
  but most security incidents are not breaches. A breach requires (a) **Unsecured** PHI,
  (b) an **impermissible** use/disclosure under the Privacy Rule, and (c) **compromise** of
  security/privacy that is not rebutted by the four-factor assessment.

---

## 3. Roles & Responsibilities

| Role | Person | Responsibilities |
|---|---|---|
| **Incident Lead / Security Officer / Privacy Officer** | George Nagib (support@claima.io, [FILL IN: phone]) | Owns this plan. Declares an incident, sets severity, directs containment, performs the four-factor risk assessment, decides and executes CE notification, signs the incident record. |
| **Backup Incident Lead** | [FILL IN: name/contact] | Acts with full authority when the Incident Lead is unavailable. Until filled, escalation goes to outside counsel/consultant [FILL IN]. |
| **Technical responder** | [FILL IN — currently George Nagib] | Executes containment/eradication steps in §5 (key rotation, session invalidation, disabling the AI path, backup restore). |
| **Legal counsel** | [FILL IN: healthcare counsel] | Advises on breach determination, notification content, and multi-state law. Consulted on any suspected breach. |
| **Subprocessor liaison** | George Nagib | Point of contact for subprocessor breach notifications (Azure, AWS Bedrock, Claim.MD, Stripe, email provider, Sentry, Microsoft Entra ID) and for opening support/security tickets with them. |

> Because Claima is a small organization, one person (George Nagib) currently holds multiple
> roles. Filling the Backup Incident Lead placeholder is a priority so incident response does
> not depend on a single individual's availability.

---

## 4. Detection & Reporting Sources

Claima detects potential incidents through the following channels. All are routed to the
Incident Lead.

- **Sentry error monitoring** — application error/anomaly alerts (PHI is stripped before
  capture). Spikes in errors, auth failures, or unexpected exceptions on PHI-handling routes
  are treated as potential incidents.
- **Audit-log review** — every PHI access is logged (actor, action, resource, timestamp, IP)
  and retained. Reviewed on a recurring cadence and on-demand during any investigation to
  detect unauthorized or anomalous access (e.g., cross-practice access attempts, off-hours bulk
  reads).
- **Subprocessor notifications** — breach/security notices from Azure, AWS Bedrock, Claim.MD,
  Stripe, the email provider (Azure Communication Services), Sentry, or Microsoft
  Entra ID. Each subprocessor BAA obligates the subprocessor to notify Claima; Claima monitors
  the security contact/inbox and status pages for these.
- **User / practice reports** — a Covered Entity, its workforce, or a Claima user reporting a
  suspected issue (e.g., seeing another practice's data, receiving a misdirected statement).
- **Internal report channel** — any Claima workforce member must report a suspected incident
  immediately to [FILL IN: security@claima.io] (and directly to the Incident Lead). No
  retaliation for good-faith reporting.
- **Automated security audits** — `scripts/audit.ts` and recurring tenant-isolation checks that
  flag control regressions (e.g., a route missing practiceId scoping, the global TLS-verification
  flag being set).

**Discovery date.** For notification-clock purposes (§7), an incident is "discovered" on the
first day it is known, **or by exercising reasonable diligence would have been known**, to
Claima or any workforce member other than the person who committed the breach
(45 CFR §164.410(a)(2)). Record this date precisely in the incident log.

---

## 5. Response Lifecycle

### (a) Identify & Triage — Assign Severity
1. Log the report in the incident log (§8): assign an ID, record date/time discovered and
   reporter. **Start the clock** — note the discovery date.
2. Confirm whether PHI is (or may be) involved and whether it was **secured** (encrypted) or
   **Unsecured**.
3. Assign severity:

   | Severity | Definition | Examples |
   |---|---|---|
   | **SEV-1 Critical** | Confirmed or likely exposure/exfiltration of Unsecured PHI; cross-practice data leak; compromised subprocessor key/credential; ransomware. | Attacker with DB access; another practice's PHI shown to a user; leaked API key. |
   | **SEV-2 High** | Meaningful risk to PHI without confirmed exposure. | Suspicious admin access pattern; subprocessor incident potentially touching Claima data; auth bypass with no confirmed access. |
   | **SEV-3 Medium** | Security incident with low PHI risk. | Isolated misdirected non-PHI email; single anomalous but authorized access. |
   | **SEV-4 Low** | Routine/unsuccessful incident, no PHI risk. | Blocked scans, rate-limited abuse, failed logins. Logged; no CE notice. |

4. For SEV-1/SEV-2, notify legal counsel and the Backup Lead immediately.

### (b) Contain
Take the least-destructive actions that stop the harm while **preserving evidence**. Concrete
options for Claima's stack:

- **Invalidate sessions (global):** rotate `JWT_SECRET` to immediately invalidate all active
  JWT sessions and force re-authentication. **Note:** instant, per-user token revocation is
  **pending** — today, invalidation is global (all users) via secret rotation. Choose global
  invalidation when a session/token compromise is suspected and the disruption is acceptable.
- **Rotate the affected subprocessor keys** via Azure Key Vault (post-migration) or the current
  secret store: database credentials, AWS Bedrock keys, Claim.MD account/API keys, Stripe keys —
  rotate whichever is implicated (or all, for a broad compromise).
- **Disable the AI path (fail-closed):** turn off the Bedrock AI processing path so PHI stops
  flowing to the AI subprocessor while under investigation.
- **Isolate / revoke access:** disable the affected workforce or user account(s); remove access
  in Microsoft Entra ID; if a host or service is compromised, isolate it (restrict network,
  take it out of rotation) rather than immediately wiping it.
- **Preserve evidence:** **do not delete** audit logs, application logs, or Sentry events.
  Snapshot/export the relevant audit-log entries (actor/action/resource/timestamp/IP),
  database state, and any relevant configuration before making changes. Record who did what and
  when. Preserve subprocessor notices and support-ticket threads.
- **Block the vector:** apply the immediate fix that closes the entry point (e.g., patch the
  vulnerable route, tighten a firewall/rule, revoke a leaked token).

### (c) Eradicate
- Identify and remove the **root cause** (vulnerable code path, misconfiguration, leaked
  credential, compromised dependency, missing practiceId scoping).
- Deploy the fix; add a regression check (e.g., to `scripts/audit.ts` / the tenant-isolation
  suite) so the same issue is caught automatically going forward.
- Confirm no attacker persistence remains (rotated all potentially exposed secrets, invalidated
  sessions, reviewed access grants).

### (d) Recover
- Restore any affected data from a known-good **backup**; verify **data integrity** after
  restore (record counts, spot-check, tenant-isolation check that no cross-practice data was
  introduced).
- Re-enable the AI path and any disabled services only after eradication is confirmed.
- Monitor closely (Sentry + audit-log review) for recurrence for a defined watch period.

### (e) Post-Incident Review & Documentation
- Complete the incident log entry (§8): root cause, containment actions, resolution.
- Within **[FILL IN: e.g., 10 business days]** of resolution, hold a post-incident review:
  what happened, timeline, what worked, what to improve, and follow-up actions with owners/dates.
- Update this plan, safeguards, and the risk assessment as needed.
- Retain the full incident record for at least **6 years** (45 CFR §164.316(b)(2) /
  §164.530(j)) — HIPAA documentation retention.

---

## 6. Breach Risk Assessment (Four-Factor) — 45 CFR §164.402

When Unsecured PHI has been (or may have been) impermissibly used or disclosed, a breach is
**presumed** unless Claima documents a **low probability that the PHI has been compromised**,
based on **at least** these four factors. Document the analysis and conclusion for each factor
in the incident record.

1. **Nature and extent of the PHI involved** — including the types of identifiers and the
   likelihood of re-identification. (Claima commonly processes claim, denial/CARC, payer, and
   the patient identifiers needed for appeals — e.g., name, DOB, member ID, diagnosis/CPT.
   Clinical/diagnosis data and financial identifiers weigh toward higher risk.)
2. **The unauthorized person who used the PHI or to whom the disclosure was made** — e.g., another
   HIPAA-covered entity (lower risk) vs. an unknown external actor (higher risk).
3. **Whether the PHI was actually acquired or viewed** — vs. merely a theoretical opportunity
   (e.g., audit logs showing a record was rendered vs. a laptop recovered forensically clean).
4. **The extent to which the risk to the PHI has been mitigated** — e.g., confirmed deletion,
   attestations/assurances from the recipient, keys rotated before use, PHI was encrypted.

**Outcome:**
- If the assessment does **not** demonstrate a low probability of compromise → treat as a
  **breach** and proceed to §7 notification.
- If it **does** demonstrate low probability → document the determination (and rationale); no
  breach notification required, but the incident record is still retained. When in doubt, or on
  counsel's advice, notify.

---

## 7. Notification Obligations — Claima as a Business Associate

### 7.1 Notify the Covered Entity (Claima's primary obligation)
As a Business Associate, upon **discovery** of a Breach of Unsecured PHI, Claima must notify the
affected Covered Entity (and any other affected CEs) **without unreasonable delay and no later
than 60 calendar days after discovery** (45 CFR §164.410(b)).

> **The BAA may — and often does — require faster.** Claima's BAA template (§3(c)) requires
> reporting a Breach, Security Incident, or impermissible use/disclosure within the number of
> **business days** stated in that BAA (e.g., 5). **The applicable executed BAA's deadline
> controls whenever it is shorter than 60 days.** Default to the BAA deadline.

**Notification to the CE must include, to the extent known (45 CFR §164.410(c)):**
- Identification of each individual whose Unsecured PHI has been, or is reasonably believed to
  have been, accessed, acquired, used, or disclosed.
- A description of what happened, including the date of the breach and the date of discovery, if
  known.
- The types of Unsecured PHI involved (e.g., name, DOB, member ID, diagnosis/CPT, claim/financial
  data).
- Any steps individuals should take to protect themselves.
- What Claima is doing to investigate, mitigate harm, and protect against further breaches.
- Claima contact for follow-up (George Nagib, support@claima.io, [FILL IN: phone]).

Claima must provide information available at the time and **supplement** it promptly as more is
learned (§164.410(c)(2)). Deliver notice in a documented manner (secure email plus a signed
letter), and record the CE(s) notified and the date in the incident log (§8).

### 7.2 The Covered Entity's downstream obligations (for context — not Claima's to perform)
Once notified, the **Covered Entity** is responsible for the individual, HHS, and (where
applicable) media notifications:
- **Individual notice** — without unreasonable delay, no later than **60 days** after discovery
  (§164.404).
- **HHS notice** — for breaches affecting **500+ individuals**, to the HHS Secretary
  **without unreasonable delay and within 60 days**; for breaches affecting **fewer than 500**,
  logged and reported to HHS **annually within 60 days after the end of the calendar year**
  (§164.408).
- **Media notice** — for breaches affecting **500+ residents of a State/jurisdiction**, to
  prominent media outlets within 60 days (§164.406).

Claima will **cooperate with and support** the CE's downstream notifications (e.g., providing the
individual list and breach details) and may, if the BAA/service agreement so provides, assist
with or perform notifications on the CE's behalf **only where expressly agreed in writing**.
Claima does **not** unilaterally notify individuals, HHS, or media unless a CE delegates that in
writing — the CE, not the BA, holds those obligations. State breach-notification laws may also
apply; consult counsel.

### 7.3 If Claima ever acts as a Covered Entity
Claima's current role is **Business Associate only**. If Claima ever becomes a Covered Entity
(e.g., it directly furnishes/bills for health care), it would then owe the **individual, HHS, and
media** notifications in §7.2 directly and must update this plan and its risk assessment
accordingly. [FILL IN if/when this changes.]

### 7.4 Reporting Security Incidents that are not breaches
Per the BAA (§3(c)) and §164.308(a)(6), Claima reports Security Incidents to the CE as required by
the applicable BAA. Routine, unsuccessful, immaterial incidents (e.g., blocked scans, pings, failed
logins) may be satisfied by a general acknowledgment in the BAA rather than case-by-case reports —
confirm each BAA's terms. Material Security Incidents affecting a CE's PHI are reported.

---

## 8. Incident Log Template

Maintain a running incident log (retained ≥6 years). One row per incident.

| ID | Date discovered | Reporter | Description | PHI involved (type / secured? / # individuals) | Severity | Containment actions | Root cause | CE(s) notified + date | Resolution |
|---|---|---|---|---|---|---|---|---|---|
| INC-2026-001 | YYYY-MM-DD | [name/source] | [what happened] | [e.g., name+DOB+claim; Unsecured; ~N individuals] | SEV-# | [keys rotated / JWT_SECRET rotated / AI path disabled / account disabled] | [vuln/misconfig/leaked cred] | [CE name — YYYY-MM-DD, or "N/A — not a breach"] | [fixed + verified; four-factor outcome] |

**Supporting record for each entry (kept with the log):** the four-factor risk assessment and
conclusion (§6), evidence snapshots (audit-log export, screenshots), subprocessor notices, copies
of CE notifications sent, and the post-incident review notes.

---

## 9. Testing & Plan Review

- **Tabletop exercise:** conduct a tabletop test of this plan **at least annually**
  [FILL IN: cadence — e.g., annually each Q1], walking through a realistic scenario (e.g., leaked
  Claim.MD API key; cross-practice data exposure reported by a practice; Azure/subprocessor breach
  notice). Record participants, scenario, gaps found, and remediation owners/dates.
- **Plan review:** review and update this plan **at least annually** and after any SEV-1/SEV-2
  incident, any material change to the stack/subprocessors (e.g., completion of the Azure
  migration, adding a subprocessor), or any relevant regulatory change.
- **Control validation:** confirm detection sources (§4) are live — Sentry alerting, audit-log
  retention, subprocessor security contacts current, and the internal report channel monitored.
- **Contact accuracy:** verify all [FILL IN] contacts (Backup Lead, counsel, phone) at each review.

---

## Version / Effective Date / Approval

| Field | Value |
|---|---|
| Document | Incident Response & Breach Notification Plan |
| Version | 0.1 (draft) |
| Effective date | [FILL IN — upon approval] |
| Last reviewed | 2026-07-13 |
| Next review due | [FILL IN — at least annually] |
| Owner | George Nagib, Security & Privacy Officer |
| Approved by | George Nagib, Security & Privacy Officer — Claima LLC — Date: ____________ |

*Draft for internal review; not legal advice — have healthcare counsel review before use.*
