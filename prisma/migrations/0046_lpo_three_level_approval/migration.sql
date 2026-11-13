-- Three-level LPO approval: Technical Manager -> Chief Finance Officer ->
-- Managing Director. Add the per-stage pending statuses and the fields that
-- record who signed off each stage (and any rejection).
ALTER TYPE "LpoStatus" ADD VALUE IF NOT EXISTS 'PENDING_TM';
ALTER TYPE "LpoStatus" ADD VALUE IF NOT EXISTS 'PENDING_CFO';
ALTER TYPE "LpoStatus" ADD VALUE IF NOT EXISTS 'PENDING_MD';

ALTER TABLE "Lpo"
  ADD COLUMN "tmApprovedByName" TEXT,
  ADD COLUMN "tmApprovedById" TEXT,
  ADD COLUMN "tmApprovedAt" TIMESTAMP(3),
  ADD COLUMN "cfoApprovedByName" TEXT,
  ADD COLUMN "cfoApprovedById" TEXT,
  ADD COLUMN "cfoApprovedAt" TIMESTAMP(3),
  ADD COLUMN "mdApprovedByName" TEXT,
  ADD COLUMN "mdApprovedById" TEXT,
  ADD COLUMN "mdApprovedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedByName" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectComment" TEXT;

-- Replaced by the structured per-stage approval fields above.
ALTER TABLE "Lpo" DROP COLUMN IF EXISTS "notedByName";
