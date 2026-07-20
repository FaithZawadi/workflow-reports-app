-- Correlate each weighbridge with its Client/Manager (approval routing).
ALTER TABLE "Weighbridge" ADD COLUMN "clientManagerId" TEXT;
CREATE INDEX "Weighbridge_clientManagerId_idx" ON "Weighbridge"("clientManagerId");
ALTER TABLE "Weighbridge" ADD CONSTRAINT "Weighbridge_clientManagerId_fkey" FOREIGN KEY ("clientManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
