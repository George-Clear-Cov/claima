-- AiUsage: per-practice AI usage tracking for quota enforcement (Layer 2).
-- Apply with: bunx prisma db push   (or fold into a prisma migrate migration)
-- Until applied, the quota code fails open (logs a warning, allows the call).

CREATE TABLE "AiUsage" (
  "id"            TEXT NOT NULL,
  "practiceId"    TEXT NOT NULL,
  "day"           TEXT NOT NULL,
  "calls"         INTEGER NOT NULL DEFAULT 0,
  "inputTokens"   INTEGER NOT NULL DEFAULT 0,
  "outputTokens"  INTEGER NOT NULL DEFAULT 0,
  "estCostMicros" INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUsage_practiceId_day_key" ON "AiUsage"("practiceId", "day");
CREATE INDEX "AiUsage_practiceId_day_idx" ON "AiUsage"("practiceId", "day");

ALTER TABLE "AiUsage"
  ADD CONSTRAINT "AiUsage_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
