-- Distinguish a person's HOME organisation from the client they are SERVING.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "orgType" TEXT NOT NULL DEFAULT 'QSL',
  ADD COLUMN IF NOT EXISTS "servingClientId" TEXT;

CREATE INDEX IF NOT EXISTS "User_servingClientId_idx" ON "User"("servingClientId");

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_servingClientId_fkey"
    FOREIGN KEY ("servingClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: client-role accounts belong to a client (home = CLIENT); everyone
-- else is QSL staff. For QSL staff, any client that was recorded against them
-- was really "who they serve", so move it to servingClientId and clear the
-- employer link so `clientId` cleanly means "the person's employer client".
UPDATE "User" SET "orgType" = 'CLIENT'
  WHERE "role" = 'CLIENT' OR 'CLIENT' = ANY("roles");

UPDATE "User" SET "servingClientId" = "clientId", "clientId" = NULL
  WHERE "orgType" = 'QSL' AND "clientId" IS NOT NULL;
