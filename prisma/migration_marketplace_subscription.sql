-- MarketplaceSubscription — Azure/AWS marketplace fulfillment records.
-- Matches prisma/schema.prisma `model MarketplaceSubscription`.
-- Run in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run),
-- or equivalently: `bunx prisma db push`. Prisma supplies id (uuid) + updatedAt at write time.
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS "MarketplaceSubscription" (
  "id"          TEXT NOT NULL,
  "practiceId"  TEXT,
  "marketplace" TEXT NOT NULL,
  "externalId"  TEXT NOT NULL,
  "productCode" TEXT,
  "planId"      TEXT,
  "status"      TEXT NOT NULL,
  "quantity"    INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "rawPayload"  JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceSubscription_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceSubscription_externalId_key"
  ON "MarketplaceSubscription" ("externalId");

CREATE INDEX IF NOT EXISTS "MarketplaceSubscription_marketplace_externalId_idx"
  ON "MarketplaceSubscription" ("marketplace", "externalId");
