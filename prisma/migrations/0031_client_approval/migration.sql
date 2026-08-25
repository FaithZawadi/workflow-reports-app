-- Client registration approval (technician-added clients await a chosen manager).
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "approverId" TEXT,
  ADD COLUMN IF NOT EXISTS "registeredById" TEXT,
  ADD COLUMN IF NOT EXISTS "registeredByName" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT;

CREATE INDEX IF NOT EXISTS "Client_approverId_idx" ON "Client"("approverId");
CREATE INDEX IF NOT EXISTS "Client_approvalStatus_idx" ON "Client"("approvalStatus");

DO $$ BEGIN
  ALTER TABLE "Client"
    ADD CONSTRAINT "Client_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
