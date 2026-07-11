-- Customer service feedback / enquiry collected after a service.

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('MONTHLY_SERVICE', 'QUARTERLY_SERVICE', 'ANNUAL_CALIBRATION', 'BREAKDOWN_SERVICE');

-- CreateTable
CREATE TABLE "ServiceFeedback" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "weighbridge" TEXT,
    "serviceDate" TIMESTAMP(3),
    "rating" INTEGER,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceFeedback_serviceType_idx" ON "ServiceFeedback"("serviceType");
CREATE INDEX "ServiceFeedback_createdAt_idx" ON "ServiceFeedback"("createdAt");
