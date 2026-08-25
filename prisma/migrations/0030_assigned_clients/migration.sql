-- Explicit many-to-many: which clients a user may file reports for.
-- Prisma implicit relation "AssignedClients": A -> Client, B -> User.
CREATE TABLE IF NOT EXISTS "_AssignedClients" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_AssignedClients_AB_unique" ON "_AssignedClients"("A", "B");
CREATE INDEX IF NOT EXISTS "_AssignedClients_B_index" ON "_AssignedClients"("B");

DO $$ BEGIN
  ALTER TABLE "_AssignedClients"
    ADD CONSTRAINT "_AssignedClients_A_fkey" FOREIGN KEY ("A") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "_AssignedClients"
    ADD CONSTRAINT "_AssignedClients_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
