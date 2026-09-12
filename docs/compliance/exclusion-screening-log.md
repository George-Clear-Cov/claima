# Federal Exclusion Screening Log

> **Entity name change — 2026-09-09.** NY DOS accepted the Certificate of Amendment
> (App DOS2120-2026-001821). The entity formerly named **Pathfinder Projects LLC** is now
> **CLAIMA LLC** — same DOS ID **7249876**, same EIN, unbroken good standing. Records dated
> before this line were executed under the prior name and remain valid.

Satisfies the representation at **BAA §11(c)** — that neither Business Associate nor any
person with an ownership or control interest in, or employed or contracted by, Business
Associate is excluded, debarred, or otherwise ineligible to participate in a federal health
care program — and the corresponding obligation to notify Covered Entity within five (5)
business days if that ceases to be true.

**Screen before granting any workforce member access to PHI, and monthly thereafter.**
Monthly is the OIG's own recommended cadence (OIG Special Advisory Bulletin on the Effect of
Exclusion, May 2013), because the LEIE is updated monthly and an excluded party's claims are
non-payable from the date of exclusion regardless of when you discover it.

---

## Screening — 2026-08-31

**Source:** OIG List of Excluded Individuals/Entities (LEIE), full downloadable database
`https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv`
**LEIE file last modified:** Mon, 10 Aug 2026 13:18:45 GMT
**Records screened:** 83842
**Method:** full-file field match on LASTNAME / FIRSTNAME (individuals) and BUSNAME (entities).
**Screened by:** George Nagib, Security & Privacy Officer

| Subject | Role | Search terms | Result |
|---|---|---|---|
| George Nagib | Founder; Security & Privacy Officer; sole workforce member | LASTNAME `NAGIB` (any first name); LASTNAME `NAGIB` + FIRSTNAME `GEORGE` | ✅ **No match** |
| CLAIMA LLC | Business Associate (legal entity) | BUSNAME contains `PATHFINDER` | ✅ **No match** |
| Claima | Trade name | BUSNAME contains `CLAIMA` | ✅ **No match** |

**Result: CLEAR.** No excluded individual or entity identified.

### Still to complete for a full screen
- [ ] **SAM.gov exclusions** (government-wide debarment, beyond OIG healthcare exclusions) —
      search at `https://sam.gov/search/?index=ex` for "Nagib" and "Pathfinder Projects".
      The bulk extract requires a SAM.gov account/API key; the web search is public and free.
      Record the result in the table above as a second source.
- [ ] **State Medicaid exclusion lists** — required in many states in addition to the LEIE.
      Applies per state once you enroll with that state's Medicaid program; not yet applicable.

---

## Log

| Date | Screened by | Sources | Subjects | Result |
|---|---|---|---|---|
| 2026-08-31 | George Nagib | OIG LEIE (83842 records) | Nagib, George · CLAIMA LLC · Claima | ✅ Clear |
|  |  |  |  |  |

*Retain each screening result for six (6) years per 45 CFR §164.316(b)(2)(i).*
