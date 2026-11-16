-- Material Requisition Form (QSL-A2) header fields on a purchase request.
ALTER TABLE "PurchaseRequest"
  ADD COLUMN "projectName" TEXT,
  ADD COLUMN "projectNumber" TEXT,
  ADD COLUMN "storeName" TEXT,
  ADD COLUMN "checkedByName" TEXT;
