-- External client report signing (capability token) + per-site clocking.
ALTER TABLE "Report" ADD COLUMN "signToken" TEXT;
CREATE UNIQUE INDEX "Report_signToken_key" ON "Report"("signToken");
ALTER TABLE "ClockEvent" ADD COLUMN "site" TEXT;
