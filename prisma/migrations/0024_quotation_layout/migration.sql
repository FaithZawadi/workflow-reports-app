-- Invoice-style quotation fields: subject line, file reference, editable payment
-- details and terms-of-sale.
ALTER TABLE "Quotation" ADD COLUMN "subject" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "fileNo" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "paymentDetails" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "terms" TEXT;
