-- Force-change-password flag for invited users.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- First-party analytics events (page views + clicks).
CREATE TABLE "VisitEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "ref" TEXT,
  "label" TEXT,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "role" TEXT,
  "device" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisitEvent_type_idx" ON "VisitEvent"("type");
CREATE INDEX "VisitEvent_path_idx" ON "VisitEvent"("path");
CREATE INDEX "VisitEvent_sessionId_idx" ON "VisitEvent"("sessionId");
CREATE INDEX "VisitEvent_createdAt_idx" ON "VisitEvent"("createdAt");
