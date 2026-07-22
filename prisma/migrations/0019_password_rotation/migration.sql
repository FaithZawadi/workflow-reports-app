-- Bimonthly password rotation: track when each password was last set, and start
-- the clock "today" for everyone already registered.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
UPDATE "User" SET "passwordChangedAt" = CURRENT_TIMESTAMP;
