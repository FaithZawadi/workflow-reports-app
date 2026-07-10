-- Add a multi-role column. Each user may now hold more than one role; their
-- access is the union across all of them. `role` stays as the primary role.

-- AddColumn
ALTER TABLE "User" ADD COLUMN "roles" "Role"[] DEFAULT ARRAY[]::"Role"[];

-- Backfill: every existing user starts with their current single role.
UPDATE "User" SET "roles" = ARRAY["role"]::"Role"[] WHERE "roles" IS NULL OR array_length("roles", 1) IS NULL;
