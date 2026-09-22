-- Technician/Sales quotations require PM/TM/Manager/Admin approval before they can
-- be shared with the client. Existing rows default to APPROVED so nothing already
-- issued is retroactively blocked.
ALTER TABLE "Quotation" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Quotation" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "approvedAt" TIMESTAMP(3);
