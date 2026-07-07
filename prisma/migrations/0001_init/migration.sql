-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TECHNICIAN', 'ENGINEER', 'SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TECHNICAL_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING_SUPERVISOR', 'PENDING_MANAGER', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "site" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "site" TEXT,
    "weighbridgeId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "supervisorEmail" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsAcc" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "byUserId" TEXT,
    "comment" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Counter_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_clientId_idx" ON "User"("clientId");
CREATE UNIQUE INDEX "Report_serial_key" ON "Report"("serial");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_template_idx" ON "Report"("template");
CREATE INDEX "Report_clientId_idx" ON "Report"("clientId");
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Photo_reportId_idx" ON "Photo"("reportId");
CREATE INDEX "TrailEvent_reportId_idx" ON "TrailEvent"("reportId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrailEvent" ADD CONSTRAINT "TrailEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrailEvent" ADD CONSTRAINT "TrailEvent_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
