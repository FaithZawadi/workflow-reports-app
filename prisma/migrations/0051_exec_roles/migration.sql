-- Add the executive offices to the Role enum so a user can actually hold them.
-- Without these the CFO / Managing Director roles (used by the LPO approval
-- chain and assigned by an admin) can't be saved — the column is typed Role.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CFO';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGING_DIRECTOR';
