-- Fuller worker registration: identity details + ID document, and an assigned
-- site (reassignable, audited). Identity is fixed once registered.
ALTER TABLE "Worker"
  ADD COLUMN "idNumber" TEXT,
  ADD COLUMN "idPhoto" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "nextOfKin" TEXT,
  ADD COLUMN "nextOfKinPhone" TEXT,
  ADD COLUMN "siteId" TEXT,
  ADD COLUMN "siteName" TEXT;

CREATE INDEX "Worker_siteId_idx" ON "Worker"("siteId");
CREATE INDEX "Worker_idNumber_idx" ON "Worker"("idNumber");

ALTER TABLE "Worker" ADD CONSTRAINT "Worker_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
