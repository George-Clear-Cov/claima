# Data Moat Foundation — payer-contract intelligence

Forward-looking design (not built yet). Goal: lay the cheap, irreversible-if-skipped data foundation **now**, as practices onboard, so the Phase 2 plays (payer-contract intelligence, underpayment recovery, cross-practice benchmarks) are possible later. See `phase2_moat_strategy.md` in the knowledge base for the why.

## The core insight
You **cannot reconstruct line-level payment history retroactively**. The single highest-leverage move the day Claim.MD goes live: **capture line-level 835 remittance detail + a canonical payer identity from claim #1.** Everything else builds on that.

## What's missing today
- `ERA` is **claim-level** only (chargeAmount, insurancePaid, adjustments, patientResponsibility, carcCodes) — no per-CPT allowed/paid.
- `ClaimLine` has the **billed** side (cptCode, modifier, units, chargeAmount) but no paid/allowed.
- Payer is **free-text** (`payerName`) + a Claim.MD id (`payerId`) scattered on Patient/Claim/ERA — **no canonical payer dimension**, so "Aetna" can't aggregate across practices.

## Foundation to add (Phase 2.0 — capture only)

```prisma
// Canonical payer across all practices — enables cross-practice benchmarking.
model Payer {
  id            String   @id @default(uuid())
  canonicalName String   @unique          // "Aetna"
  aliases       String[]                  // raw payerNames / Claim.MD ids seen in the wild
  payerType     String?                   // commercial | medicare | medicaid | MA
  createdAt     DateTime @default(now())
  remitLines    RemittanceLine[]
  contractRates ContractRate[]
}

// Line-level 835 detail — parsed from the 835 SVC loop, one row per paid service line.
model RemittanceLine {
  id                    String   @id @default(uuid())
  practiceId            String
  eraId                 String
  claimLineId           String?              // matched billed line, when resolvable
  payerId               String               // → canonical Payer
  cptCode               String
  modifier              String?
  units                 Int      @default(1)
  billedAmount          Decimal  @db.Decimal(10,2)
  allowedAmount         Decimal  @db.Decimal(10,2)   // the contractual "allowed" — key signal
  paidAmount            Decimal  @db.Decimal(10,2)
  contractualAdjustment Decimal  @db.Decimal(10,2)   // CO-45 etc.
  carcCodes             String[]
  serviceDate           DateTime?
  region                String?              // practice state — for geo benchmarks
  createdAt             DateTime @default(now())

  practice Practice @relation(fields: [practiceId], references: [id])
  payer    Payer    @relation(fields: [payerId], references: [id])
  @@index([payerId, cptCode, region])
}

// Known contracted rates (uploaded by practice, or inferred from steady allowedAmount).
model ContractRate {
  id             String   @id @default(uuid())
  practiceId     String
  payerId        String
  cptCode        String
  contractedRate Decimal  @db.Decimal(10,2)
  source         String   // "uploaded" | "inferred"
  effectiveDate  DateTime?
  @@unique([practiceId, payerId, cptCode])
}

// De-identified aggregate — NO practice attribution. Pricing data, not PHI. The moat.
model RateBenchmark {
  id         String   @id @default(uuid())
  payerId    String
  cptCode    String
  region     String?
  p25        Decimal  @db.Decimal(10,2)
  p50        Decimal  @db.Decimal(10,2)
  p75        Decimal  @db.Decimal(10,2)
  sampleSize Int
  updatedAt  DateTime @updatedAt
  @@unique([payerId, cptCode, region])
}
```

## Feature evolution
1. **Phase 2.0 — Foundation (now, as practices onboard):** parse the 835 **SVC loop** into `RemittanceLine`; map each raw payer → canonical `Payer`. Invisible to users, cheap, accrues from claim #1.
2. **Phase 2.1 — Per-practice variance (Play #2):** compare `paidAmount` vs `allowedAmount` vs `ContractRate` → flag underpayments + auto-build appeal/recovery. Works with one practice's data.
3. **Phase 2.2 — Cross-practice benchmark (Plays #1 + #4 — the moat):** roll `RemittanceLine` up into `RateBenchmark` (payer × CPT × region percentiles). Surface "you're paid at the 30th percentile for 99214 with Aetna." **Needs ~20–50 practices for statistical power.**
4. **Phase 2.3 — Renegotiation engine (Play #1):** payer-mix simulation + AI-generated negotiation brief with dollar-quantified asks.
5. **Separate track — HCC/risk capture (Play #3):** read chart text → uncaptured HCC conditions + documentation/quality-measure gaps. Different competency; own design doc later.

## Compliance guardrails
- `RateBenchmark` is **aggregate, de-identified pricing data with no practice attribution** → not PHI, safe to share across tenants. Enforce a minimum `sampleSize` (e.g. ≥5 practices) before a benchmark is exposed, so no single practice's rates are reverse-engineerable.
- `RemittanceLine` **is** practice-scoped PHI-adjacent data → all queries scoped by `practiceId` (per CLAUDE.md); only the aggregate escapes the tenant boundary.

## The one thing to do at Claim.MD go-live
Wire the 835 parser to persist `RemittanceLine` + canonical `Payer` mapping. That's the foundation; everything in Phase 2 is impossible without it and trivial-ish with it.
