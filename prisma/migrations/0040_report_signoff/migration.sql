-- Billing sign-off on maintenance reports: Qalibrated signs first, then the
-- client signs and stamps. Images stored as data URLs. All nullable so existing
-- approved reports are unaffected.
ALTER TABLE "Report" ADD COLUMN "qslSignatureImage"    TEXT;
ALTER TABLE "Report" ADD COLUMN "qslSignedByName"      TEXT;
ALTER TABLE "Report" ADD COLUMN "qslSignedAt"          TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "clientSignatureImage" TEXT;
ALTER TABLE "Report" ADD COLUMN "clientStampImage"     TEXT;
ALTER TABLE "Report" ADD COLUMN "clientSignedByName"   TEXT;
ALTER TABLE "Report" ADD COLUMN "clientSignedAt"       TIMESTAMP(3);
