-- Invoicing: a client invoice mirroring the quotation shape, plus retention and
-- a due date, optionally linked to the quotation it was raised from.
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'UNPAID', 'PAID', 'CANCELLED');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "clientId" TEXT,
  "clientName" TEXT NOT NULL,
  "siteName" TEXT,
  "contactPerson" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  "subject" TEXT,
  "ref" TEXT,
  "fileNo" TEXT,
  "quotationId" TEXT,
  "items" JSONB,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 16,
  "retentionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "retentionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountInWords" TEXT,
  "notes" TEXT,
  "paymentDetails" TEXT,
  "terms" TEXT,
  "dueDate" TIMESTAMP(3),
  "issuedByName" TEXT,
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "shareToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_shareToken_key" ON "Invoice"("shareToken");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
