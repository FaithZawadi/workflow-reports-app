-- CreateTable
CREATE TABLE "Weighbridge" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "site" TEXT,
    "label" TEXT NOT NULL,
    "makeModel" TEXT,
    "serialNo" TEXT,
    "capacity" TEXT,
    "deckLength" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Weighbridge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Weighbridge_clientId_idx" ON "Weighbridge"("clientId");
CREATE INDEX "Weighbridge_active_idx" ON "Weighbridge"("active");

-- AddForeignKey
ALTER TABLE "Weighbridge" ADD CONSTRAINT "Weighbridge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (implicit many-to-many User <-> Weighbridge, relation "UserWeighbridges")
CREATE TABLE "_UserWeighbridges" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserWeighbridges_AB_unique" ON "_UserWeighbridges"("A", "B");
CREATE INDEX "_UserWeighbridges_B_index" ON "_UserWeighbridges"("B");

-- AddForeignKey
ALTER TABLE "_UserWeighbridges" ADD CONSTRAINT "_UserWeighbridges_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_UserWeighbridges" ADD CONSTRAINT "_UserWeighbridges_B_fkey" FOREIGN KEY ("B") REFERENCES "Weighbridge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
