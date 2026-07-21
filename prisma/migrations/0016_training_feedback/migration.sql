-- HR role + training feedback: HR records and reviews training evaluations and
-- downloads the feedback sheets as PDF.

-- AlterEnum: add the HR (Human Resources) role.
ALTER TYPE "Role" ADD VALUE 'HR';

-- CreateTable
CREATE TABLE "TrainingFeedback" (
    "id" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL DEFAULT 'QSL Maintenance App Training',
    "trainingDate" TIMESTAMP(3),
    "trainer" TEXT,
    "traineeName" TEXT NOT NULL,
    "traineeRole" TEXT,
    "department" TEXT,
    "criteria" JSONB,
    "overall" INTEGER,
    "didWell" TEXT,
    "improve" TEXT,
    "recommend" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingFeedback_createdAt_idx" ON "TrainingFeedback"("createdAt");
