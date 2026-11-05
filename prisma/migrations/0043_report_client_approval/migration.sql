-- New report statuses for the client-approval step. PENDING_CLIENT: a manager
-- approved the report and sent it to the client for external approval.
-- CLIENT_RETURNED: the client returned it with a comment, back to the manager.
-- Adding enum values is safe and idempotent; existing rows are untouched.
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'PENDING_CLIENT';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'CLIENT_RETURNED';
