-- CreateEnum
CREATE TYPE "MaintenanceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "site" TEXT,
    "weighbridgeId" TEXT,
    "template" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "frequency" "MaintenanceFrequency" NOT NULL,
    "intervalDays" INTEGER,
    "assignedName" TEXT,
    "assignedEmail" TEXT,
    "lastDoneAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "lastReportSerial" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_nextDueAt_idx" ON "Schedule"("nextDueAt");
CREATE INDEX "Schedule_clientId_idx" ON "Schedule"("clientId");
CREATE INDEX "Schedule_template_idx" ON "Schedule"("template");
CREATE INDEX "Schedule_active_idx" ON "Schedule"("active");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
