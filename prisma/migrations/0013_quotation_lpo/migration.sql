-- Client Local Purchase Order (LPO) image attached to a quotation.
ALTER TABLE "Quotation" ADD COLUMN "lpoImage" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "lpoName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "lpoUploadedAt" TIMESTAMP(3);
