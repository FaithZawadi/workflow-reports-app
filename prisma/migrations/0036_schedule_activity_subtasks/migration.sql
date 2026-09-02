-- Diverse activity on a schedule + sub-tasks linked to a schedule.
ALTER TABLE "Schedule" ADD COLUMN "activity" TEXT;
ALTER TABLE "Task" ADD COLUMN "scheduleId" TEXT;
CREATE INDEX "Task_scheduleId_idx" ON "Task"("scheduleId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
