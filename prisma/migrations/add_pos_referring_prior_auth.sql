-- Migration: POS code, referring provider, relationship to subscriber, prior auth
-- Run this in Supabase SQL editor

-- 1. New columns on Claim
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "placeOfService"       TEXT NOT NULL DEFAULT '11';
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "referringProviderNpi" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "priorAuthId"          TEXT;

-- 2. New column on Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "relationshipToSubscriber" TEXT NOT NULL DEFAULT '18';

-- 3. PAStatus enum
DO $$ BEGIN
  CREATE TYPE "PAStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. PriorAuthorization table
CREATE TABLE IF NOT EXISTS "PriorAuthorization" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "practiceId"       TEXT        NOT NULL,
  "patientId"        TEXT        NOT NULL,
  "payerId"          TEXT        NOT NULL,
  "payerName"        TEXT        NOT NULL,
  "cptCodes"         TEXT[]      NOT NULL DEFAULT '{}',
  "authNumber"       TEXT,
  "status"           "PAStatus"  NOT NULL DEFAULT 'PENDING',
  "requestedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "approvedAt"       TIMESTAMPTZ,
  "expiresAt"        TIMESTAMPTZ,
  "sessionsApproved" INTEGER,
  "sessionsUsed"     INTEGER     NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PriorAuthorization_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "PriorAuthorization_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id"),
  CONSTRAINT "PriorAuthorization_patientId_fkey"  FOREIGN KEY ("patientId")  REFERENCES "Patient"("id")
);

CREATE INDEX IF NOT EXISTS "PriorAuthorization_practiceId_idx" ON "PriorAuthorization"("practiceId");
CREATE INDEX IF NOT EXISTS "PriorAuthorization_patientId_idx"  ON "PriorAuthorization"("patientId");

-- 5. FK from Claim → PriorAuthorization
DO $$ BEGIN
  ALTER TABLE "Claim" ADD CONSTRAINT "Claim_priorAuthId_fkey"
    FOREIGN KEY ("priorAuthId") REFERENCES "PriorAuthorization"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
