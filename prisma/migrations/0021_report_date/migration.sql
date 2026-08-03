-- The date the work was actually performed (the date the report is "for").
-- Nullable; backfilled to the submission date for existing rows so period
-- filtering keys off it uniformly.
ALTER TABLE "Report" ADD COLUMN "reportDate" TIMESTAMP(3);

UPDATE "Report" SET "reportDate" = "createdAt" WHERE "reportDate" IS NULL;

CREATE INDEX "Report_reportDate_idx" ON "Report"("reportDate");
