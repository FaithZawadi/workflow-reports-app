-- Purchase Requests: a technician (or any staffer) asks for something to be
-- bought; a manager approves/declines; an approved request is raised as an LPO.
CREATE TYPE "PrStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CONVERTED', 'CANCELLED');

CREATE TABLE "PurchaseRequest" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "PrStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByName" TEXT NOT NULL,
  "requestedById" TEXT,
  "title" TEXT,
  "justification" TEXT,
  "items" JSONB,
  "suggestedSupplier" TEXT,
  "requiredBy" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "estTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewedByName" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewComment" TEXT,
  "lpoId" TEXT,
  "lpoNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");
CREATE INDEX "PurchaseRequest_createdAt_idx" ON "PurchaseRequest"("createdAt");
CREATE INDEX "PurchaseRequest_requestedById_idx" ON "PurchaseRequest"("requestedById");

-- Link an LPO back to the request it was raised from.
ALTER TABLE "Lpo"
  ADD COLUMN "fromRequestId" TEXT,
  ADD COLUMN "fromRequestNumber" TEXT;
