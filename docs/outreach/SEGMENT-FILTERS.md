# Verified Apollo segment filters, 2026-09-10

Every count below was observed, not estimated. Every sample was eyeballed.
Nothing has been enriched; no lead credits spent building these.

## The filter shape that works for PRACTICES
```
organization_naics_codes:      ["62111"]            # offices of physicians (2-5 digits ONLY)
not_organization_naics_codes:  ["6113","6221","8139"] # universities, hospitals, associations
q_organization_keyword_tags:   [specialty terms]
organization_num_employees_ranges: ["11,50","51,200","201,500"]
organization_locations:        ["United States"]
```
⚠️ `organization_naics_codes` rejects 6 digits. "621111" returns `Invalid params`.
Use "62111"; matching is by prefix so it still hits 621111.
⚠️ Cannot combine include + exclude of overlapping NAICS prefixes.

| Segment | Companies | Sample quality |
|---|---:|---|
| Spine / neurosurgery | 880 | Clean. NSPC, Mayfield $63.3M, Jagannathan $6.2M |
| Orthopedics | 1,157 | Clean EXCEPT academics, see below |
| Oncology / hematology | 685 | Clean. Maryland Oncology $112.1M, OHC $16.4M |
| GI / endoscopy | 458 | Clean. Albany GI $41.1M, US Digestive $76M |
| Medical billing firms | 5,004 | Real firms, but many small/offshore shops. Needs a revenue floor |
| MSOs | 1,128 | ⛔ **BROKEN**. See below |

## ⛔ The academic filter does NOT work by NAICS alone
`not_organization_naics_codes: ["6113"]` removed WashU Medicine Orthopedics
(it carries 611310) but did NOT remove **University of Minnesota, Department of
Orthopedic Surgery**, which carries ONLY 621111.

**Required post-filter step**, applied to results before enrichment:
- drop any org whose domain ends `.edu`  (UMN was med.umn.edu)
- drop any org whose name matches: University, College, School of Medicine,
  Department of, Health System, Medical Center, Hospital, Faculty Practice
There is no single Apollo filter for this. It must be a post-filter.

## ⛔ MSO segment is broken on keyword tags
`["MSO","practice management","management services organization"]` returned, in the
top 5: Accounting Today (trade magazine), CareStack (dental software vendor), and
**ABA Journal** (American Bar Association magazine). "MSO" as an acronym matches
anything. Do not use this segment as built. Options not yet tested:
NAICS 561110 + a healthcare constraint, or reaching MSOs through `owned_by_chain`
on the practices they own.

## ⭐ owned_by_chain is the PE / platform detector
US Digestive Health ($76M) returns `owned_by_organization: SCA Health` and a
4-deep `owned_by_chain`. Panorama Orthopedics returns `owned_by: Remedy Medical
Properties` (a landlord, so the field needs reading, not trusting blindly).
This is a real data field and beats the AI-research route Apollo proposed for
identifying PE-backed platforms.

## ⭐ Already-saved accounts with contacts, zero enrichment cost
Surfaced in the `accounts` bucket, saved 2026-09-04:
| Account | Contacts already saved |
|---|---:|
| Connecticut GI | 11 |
| Albany Gastroenterology Consultants | 5 |
| Manhattan Gastroenterology | 2 |
Work these before spending a credit on anything new.
⚠️ In the `accounts` bucket the row's `id` is an ACCOUNT id; the organization id is
the separate `organization_id` field. Do not pass an account id to an org filter.

## Dedupe requirement
These raw searches do NOT carry the 47-org exclusion list. Hunterdon Hematology
Oncology appeared in the oncology sample and was emailed today. Dedupe by
organization_id against everything already contacted before any enrichment.
