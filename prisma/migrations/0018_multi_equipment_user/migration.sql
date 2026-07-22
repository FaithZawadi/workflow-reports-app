-- Multiple Equipment Users per report: any one may review; first to act decides.
ALTER TABLE "Report" ADD COLUMN "supervisorEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Backfill: seed the array from the existing single supervisor so old reports
-- keep routing to that reviewer.
UPDATE "Report" SET "supervisorEmails" = ARRAY["supervisorEmail"] WHERE "supervisorEmail" IS NOT NULL AND "supervisorEmail" <> '';
