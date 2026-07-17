-- CLIENT role, calibration requests, quotations and one-click email approval tokens.

-- AlterEnum: add the restricted CLIENT login role.
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- CreateEnum
CREATE TYPE "CalibrationType" AS ENUM ('IN_SITU', 'LAB');
CREATE TYPE "CalibrationRequestStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "QuotationStatus" AS ENUM ('REQUESTED', 'QUOTED', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "CalibrationRequest" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "address" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "equipment" JSONB NOT NULL,
    "calibrationType" "CalibrationType",
    "preferredDate" TIMESTAMP(3),
    "additionalRequests" TEXT,
    "declarationName" TEXT,
    "declarationDesignation" TEXT,
    "declarationDate" TIMESTAMP(3),
    "status" "CalibrationRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewChecklist" JSONB,
    "decisionReason" TEXT,
    "reviewedByName" TEXT,
    "approvedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalibrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestNote" TEXT,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "calibrationRequestId" TEXT,
    "items" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "freight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "preparedByName" TEXT,
    "quotedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reportSerial" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationRequest_serial_key" ON "CalibrationRequest"("serial");
CREATE INDEX "CalibrationRequest_clientId_idx" ON "CalibrationRequest"("clientId");
CREATE INDEX "CalibrationRequest_status_idx" ON "CalibrationRequest"("status");
CREATE INDEX "CalibrationRequest_createdAt_idx" ON "CalibrationRequest"("createdAt");

CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");
CREATE INDEX "Quotation_clientId_idx" ON "Quotation"("clientId");
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

CREATE UNIQUE INDEX "ApprovalToken_tokenHash_key" ON "ApprovalToken"("tokenHash");
CREATE INDEX "ApprovalToken_reportSerial_idx" ON "ApprovalToken"("reportSerial");

-- AddForeignKey
ALTER TABLE "CalibrationRequest" ADD CONSTRAINT "CalibrationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_calibrationRequestId_fkey" FOREIGN KEY ("calibrationRequestId") REFERENCES "CalibrationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
