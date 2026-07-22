-- Opaque share link for quotations. Adds a nullable, unique slug used in the
-- public /d/<token> URL so a shared quotation reveals neither the record id nor
-- the API path. Tokens are minted lazily when a quote is first opened by staff.
ALTER TABLE "Quotation" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Quotation_shareToken_key" ON "Quotation"("shareToken");
