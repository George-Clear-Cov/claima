-- Migration: add ERA and PracticePayerEnrollment tables
-- Run this in the Supabase SQL editor at:
-- https://supabase.com/dashboard/project/cocfvcqmwnvuxqzmngpy/sql/new

-- 1. EnrollmentStatus enum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- 2. ERA table
CREATE TABLE "ERA" (
  "id"                    TEXT NOT NULL,
  "practiceId"            TEXT NOT NULL,
  "claimId"               TEXT,
  "claimMdEraId"          TEXT NOT NULL,
  "checkNumber"           TEXT,
  "payerId"               TEXT NOT NULL,
  "payerName"             TEXT NOT NULL,
  "claimMdClaimId"        TEXT,
  "patientFirstName"      TEXT,
  "patientLastName"       TEXT,
  "serviceDate"           TIMESTAMP(3),
  "chargeAmount"          DECIMAL(10,2),
  "insurancePaid"         DECIMAL(10,2) NOT NULL,
  "adjustments"           DECIMAL(10,2) NOT NULL,
  "patientResponsibility" DECIMAL(10,2) NOT NULL,
  "carcCodes"             TEXT[] NOT NULL DEFAULT '{}',
  "rawData"               JSONB NOT NULL,
  "matchedAt"             TIMESTAMP(3),
  "processedAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ERA_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ERA_claimId_key" UNIQUE ("claimId"),
  CONSTRAINT "ERA_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ERA_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ERA_practiceId_createdAt_idx" ON "ERA"("practiceId", "createdAt");

-- updatedAt trigger for ERA
CREATE OR REPLACE FUNCTION update_era_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER era_updated_at
BEFORE UPDATE ON "ERA"
FOR EACH ROW EXECUTE FUNCTION update_era_updated_at();

-- 3. PracticePayerEnrollment table
CREATE TABLE "PracticePayerEnrollment" (
  "id"               TEXT NOT NULL,
  "practiceId"       TEXT NOT NULL,
  "payerId"          TEXT NOT NULL,
  "payerName"        TEXT NOT NULL,
  "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
  "claimMdPayerId"   TEXT,
  "enrolledAt"       TIMESTAMP(3),
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PracticePayerEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PracticePayerEnrollment_practiceId_payerId_key" UNIQUE ("practiceId", "payerId"),
  CONSTRAINT "PracticePayerEnrollment_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- updatedAt trigger for PracticePayerEnrollment
CREATE OR REPLACE FUNCTION update_ppe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppe_updated_at
BEFORE UPDATE ON "PracticePayerEnrollment"
FOR EACH ROW EXECUTE FUNCTION update_ppe_updated_at();
