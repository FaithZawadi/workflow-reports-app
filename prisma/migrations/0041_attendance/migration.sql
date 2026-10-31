-- Attendance / clocking: Workers (not system logins) and their clock events.
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "photo" TEXT,
    "faceDescriptor" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "registeredById" TEXT,
    "registeredByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClockEvent" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "selfie" TEXT,
    "matchScore" DOUBLE PRECISION,
    "matched" BOOLEAN,
    "byManagerId" TEXT,
    "byManagerName" TEXT,
    "deviceLabel" TEXT,
    CONSTRAINT "ClockEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Worker_active_idx" ON "Worker"("active");
CREATE INDEX "Worker_name_idx" ON "Worker"("name");
CREATE INDEX "ClockEvent_workerId_idx" ON "ClockEvent"("workerId");
CREATE INDEX "ClockEvent_at_idx" ON "ClockEvent"("at");
CREATE INDEX "ClockEvent_type_idx" ON "ClockEvent"("type");

ALTER TABLE "ClockEvent" ADD CONSTRAINT "ClockEvent_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
