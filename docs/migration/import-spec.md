# claima Migration & Import Spec

How external billing data is ingested into claima during a practice migration. The goal: accept the **three formats every PM/EHR and clearinghouse can export** — so we never build per-EHR integrations.

## Principle

One pipeline, three source adapters:

```
CSV/XLSX  ┐
837P      ├─►  Staging (raw, source-agnostic)  ─►  Validate / dry-run preview  ─►  Commit → Prisma models
835/ERA   ┘
```

- **CSV/XLSX** → full patient roster + demographics (the only reliable source for *inactive* patients with no recent claim).
- **837P** → claims **and insurance/subscriber data**. Lead with this for insurance — demographics CSV exports routinely omit payer/member ID.
- **835/ERA** → payment + denial (CARC) history; seeds open-AR, Payer Intelligence, and analytics from day one. Reuse the existing parser in `src/app/api/era/parse`.

---

## 1. Patient roster — CSV/XLSX → `Patient`

**Template header (one patient per row):**

```csv
first_name,last_name,dob,gender,member_id,group_number,payer_name,payer_id,relationship_to_subscriber,address_line1,city,state,zip,email,phone
Sarah,Johnson,1985-03-12,F,W123456789,GRP0042,Aetna,60054,18,123 Main St,Brooklyn,NY,11201,sarah@example.com,7185551234
```

| CSV column | `Patient` field | Req | Notes / transform |
|---|---|---|---|
| first_name | firstName | ✅ | |
| last_name | lastName | ✅ | |
| dob | dob | ✅ | normalize to ISO `YYYY-MM-DD` |
| gender | gender | ✅ | `M` / `F` / `U` |
| member_id | memberId | ✅ | subscriber/member ID |
| group_number | groupNumber | – | |
| payer_name | payerName | ✅ | free text from source |
| payer_id | payerId | ✅ | **crosswalk** free-text payer → Claim.MD payer ID at validate step |
| relationship_to_subscriber | relationshipToSubscriber | – | default `18` (self) |
| address_line1 | addressLine1 | ✅ | |
| city | city | ✅ | |
| state | state | ✅ | 2-letter |
| zip | zip | ✅ | 5 or 9 digit |
| email | email | – | |
| phone | phone | – | 10-digit |

**Dedup key:** `memberId + lastName + dob` (Patient has no SSN field).

---

## 2. Claims — 837P → `Claim` + `ClaimLine` (+ backfill `Patient`)

| 837P segment / loop | claima field |
|---|---|
| 2010BA `NM1*IL` (NM103/04 name, NM109 member ID) | Patient.firstName/lastName, memberId |
| 2010BA `DMG` (DMG02 dob, DMG03 gender) | Patient.dob, gender |
| 2010BA `N3`/`N4` | Patient.addressLine1, city, state, zip |
| 2000B `SBR` (SBR02 rel, SBR03 group) | Patient.relationshipToSubscriber, groupNumber |
| 2010BB `NM1*PR` (NM103 name, NM109 id) | Patient.payerName, payerId |
| 2010AA `NM1*85` (billing provider NPI) | match → Provider/Practice by NPI |
| 2310B `NM1*82` (rendering provider NPI) | Claim.providerId (match by NPI) |
| 2310A `NM1*DN` (referring NPI) | Claim.referringProviderNpi |
| 2300 `CLM01` (patient control #) | Claim.stediClaimId |
| 2300 `CLM02` (total charge) | Claim.totalCharge |
| 2300 `CLM05-1` (place of service) | Claim.placeOfService |
| 2300 `DTP*472` (service date) | Claim.serviceDate |
| 2300 `REF*G1` (prior auth) | Claim.priorAuthId (match) |
| 2300 `HI` (diagnosis codes) | ClaimLine.icd10Codes[] |
| 2400 `SV101-2` (CPT) | ClaimLine.cptCode |
| 2400 `SV101-3..6` (modifiers) | ClaimLine.modifier |
| 2400 `SV102` (line charge) | ClaimLine.chargeAmount |
| 2400 `SV104` (units) | ClaimLine.units |

**Imported claims land as historical** (status reflects whatever the 837 + any matched 835 say). **Dedup key:** `stediClaimId`, else `patientId + serviceDate + totalCharge`.

---

## 3. Remittance history — 835 → `ERA`

| 835 segment | `ERA` field |
|---|---|
| `TRN02` (trace/check #) | checkNumber |
| `N1*PR` (payer) | payerName (+ payer id) |
| `CLP01` (patient control #) | claimMdClaimId (match key to Claim) |
| `CLP03` (total charge) | chargeAmount |
| `CLP04` (paid) | insurancePaid |
| `CLP05` (patient responsibility) | patientResponsibility |
| `CAS` (adjustment group/reason/amt) | carcCodes[] + adjustments (sum) |
| `NM1*QC` (patient) | patientFirstName / patientLastName |
| `DTM*472` (service date) | serviceDate |
| full segment | rawData (JSON) |

Match to `Claim` via `claimMdClaimId` ↔ `Claim.stediClaimId`; unmatched → manual-review queue (`/api/era/unmatched`).

---

## Validation & commit

1. **Parse** → staging rows (no writes to live tables).
2. **Dry-run preview** → counts, per-row errors, dedup collisions, unmatched payers/providers, payer-crosswalk gaps. Operator reviews.
3. **Commit** → transactional insert scoped to `practiceId` (always from session, never file).
4. **Report** → imported / skipped / errored, with a downloadable error file for re-submission.

**Build vs buy (UI):** use `react-spreadsheet-import` (MIT) for the CSV map/validate wizard — don't hand-build the mapping UI. 837/835 parsing reuses existing claima EDI schemas.

**Two source realities:**
- **In-house practice** → runs its own exports (clean).
- **Outsourced practice** → data held by the incumbent billing company; obtain via the data-retrieval request (`data-retrieval-request.md`). PDF-only AR reports fall back to concierge manual entry.
