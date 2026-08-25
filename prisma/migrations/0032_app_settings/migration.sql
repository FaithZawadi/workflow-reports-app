-- Application-wide settings edited by admins in System Settings.
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
