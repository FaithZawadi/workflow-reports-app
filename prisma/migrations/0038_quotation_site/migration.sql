-- 0038 — Quotation site/location.
--
-- A quotation may optionally name a Site (location) belonging to its client.
-- The form shows the picker only when the client has registered sites; a client
-- with none omits it. siteName is denormalised (like clientName) so the PDF is
-- stable if the site is later renamed or removed. FK is ON DELETE SET NULL so
-- removing a site never deletes the quote — it just clears the link.

ALTER TABLE "Quotation" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "siteName" TEXT;

ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Quotation_siteId_idx" ON "Quotation"("siteId");
