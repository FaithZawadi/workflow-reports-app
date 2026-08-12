-- Track quotation amendments / revisions.
ALTER TABLE "Quotation"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "amendments" JSONB;
