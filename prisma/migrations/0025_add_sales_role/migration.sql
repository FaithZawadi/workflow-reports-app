-- Add the SALES role to the Role enum (Sales staff raise/prepare their own quotations).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES';
