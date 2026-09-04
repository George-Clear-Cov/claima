-- CreateEnum
CREATE TYPE "FeeSource" AS ENUM ('MANUAL', 'DERIVED', 'IMPORTED');

-- AlterTable
ALTER TABLE "PatientStatement" ADD COLUMN     "coinsurance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "copay" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deductible" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EligibilityCheck" ADD COLUMN     "claimId" TEXT,
ADD COLUMN     "deductibleRemaining" DECIMAL(10,2),
ADD COLUMN     "outOfPocketRemaining" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ERA" ADD COLUMN     "coinsurance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "copay" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deductible" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherPatientResp" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RemittanceLine" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "eraId" TEXT NOT NULL,
    "claimId" TEXT,
    "cptCode" TEXT NOT NULL,
    "modifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "units" INTEGER NOT NULL DEFAULT 1,
    "serviceDate" TIMESTAMP(3),
    "chargeAmount" DECIMAL(10,2) NOT NULL,
    "allowedAmount" DECIMAL(10,2),
    "insurancePaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "contractualAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "patientResponsibility" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductible" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "coinsurance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "copay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherPatientResp" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "carcCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleEntry" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "cptCode" TEXT NOT NULL,
    "modifier" TEXT,
    "payerId" TEXT,
    "payerName" TEXT,
    "expectedCharge" DECIMAL(10,2) NOT NULL,
    "expectedAllowed" DECIMAL(10,2),
    "source" "FeeSource" NOT NULL DEFAULT 'MANUAL',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodFaithEstimate" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT,
    "providerId" TEXT,
    "payerId" TEXT,
    "payerName" TEXT,
    "insured" BOOLEAN NOT NULL DEFAULT false,
    "totalCharge" DECIMAL(10,2) NOT NULL,
    "totalAllowed" DECIMAL(10,2) NOT NULL,
    "patientEstimate" DECIMAL(10,2) NOT NULL,
    "lines" JSONB NOT NULL,
    "diagnosisCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disclaimer" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodFaithEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemittanceLine_practiceId_idx" ON "RemittanceLine"("practiceId");

-- CreateIndex
CREATE INDEX "RemittanceLine_eraId_idx" ON "RemittanceLine"("eraId");

-- CreateIndex
CREATE INDEX "RemittanceLine_claimId_idx" ON "RemittanceLine"("claimId");

-- CreateIndex
CREATE INDEX "FeeScheduleEntry_practiceId_cptCode_idx" ON "FeeScheduleEntry"("practiceId", "cptCode");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScheduleEntry_practiceId_cptCode_modifier_payerId_effect_key" ON "FeeScheduleEntry"("practiceId", "cptCode", "modifier", "payerId", "effectiveDate");

-- CreateIndex
CREATE INDEX "GoodFaithEstimate_practiceId_createdAt_idx" ON "GoodFaithEstimate"("practiceId", "createdAt");

-- CreateIndex
CREATE INDEX "GoodFaithEstimate_patientId_idx" ON "GoodFaithEstimate"("patientId");

-- CreateIndex
CREATE INDEX "EligibilityCheck_patientId_idx" ON "EligibilityCheck"("patientId");

-- CreateIndex
CREATE INDEX "EligibilityCheck_claimId_idx" ON "EligibilityCheck"("claimId");

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceLine" ADD CONSTRAINT "RemittanceLine_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceLine" ADD CONSTRAINT "RemittanceLine_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "ERA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceLine" ADD CONSTRAINT "RemittanceLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleEntry" ADD CONSTRAINT "FeeScheduleEntry_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodFaithEstimate" ADD CONSTRAINT "GoodFaithEstimate_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodFaithEstimate" ADD CONSTRAINT "GoodFaithEstimate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

