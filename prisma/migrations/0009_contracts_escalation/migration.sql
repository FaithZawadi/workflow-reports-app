-- Maintenance/service contracts with multi-stage service reminders, plus a
-- flag to record when an overdue pending approval was auto-escalated.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "technicalManagerEmail" TEXT,
    "frequency" "MaintenanceFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "intervalDays" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3) NOT NULL,
    "lastServiceAt" TIMESTAMP(3),
    "remindersSent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");
CREATE INDEX "Contract_active_idx" ON "Contract"("active");
CREATE INDEX "Contract_nextServiceAt_idx" ON "Contract"("nextServiceAt");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
