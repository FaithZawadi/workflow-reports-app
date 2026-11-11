-- Local Purchase Orders: an order QSL issues to a supplier. Suppliers are
-- free-text snapshots (no Supplier entity), mirroring how invoices snapshot a
-- client. The Conditions of Purchase live in the HTML document template.
CREATE TYPE "LpoStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'CANCELLED');

CREATE TABLE "Lpo" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "LpoStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "supplierName" TEXT NOT NULL,
  "supplierContact" TEXT,
  "supplierTel" TEXT,
  "supplierEmail" TEXT,
  "supplierPin" TEXT,
  "deliverTo" TEXT,
  "deliveryDate" TIMESTAMP(3),
  "requiredBy" TIMESTAMP(3),
  "paymentTerms" TEXT,
  "supplierQuoteRef" TEXT,
  "buyerName" TEXT,
  "subject" TEXT,
  "items" JSONB,
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 16,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountInWords" TEXT,
  "notes" TEXT,
  "conditionsRev" TEXT NOT NULL DEFAULT 'GTB v1.0',
  "raisedByName" TEXT,
  "raisedById" TEXT,
  "approvedByName" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notedByName" TEXT,
  "issuedAt" TIMESTAMP(3),
  "shareToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lpo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lpo_number_key" ON "Lpo"("number");
CREATE UNIQUE INDEX "Lpo_shareToken_key" ON "Lpo"("shareToken");
CREATE INDEX "Lpo_status_idx" ON "Lpo"("status");
CREATE INDEX "Lpo_createdAt_idx" ON "Lpo"("createdAt");
