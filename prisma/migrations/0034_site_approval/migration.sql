-- Site registration approval (sites a technician adds to an existing client).
ALTER TABLE "Site" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Site" ADD COLUMN "registeredById" TEXT;
ALTER TABLE "Site" ADD COLUMN "registeredByName" TEXT;
ALTER TABLE "Site" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Site" ADD COLUMN "approvalNote" TEXT;
CREATE INDEX "Site_approvalStatus_idx" ON "Site"("approvalStatus");
