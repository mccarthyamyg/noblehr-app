-- Migration 002: Support account deletion (app store requirement)
-- Adds deleted_at to users table for soft delete capability

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TEXT;

-- Allow null organization_id in system_events for account-level events (e.g. account deletion)
ALTER TABLE system_events ALTER COLUMN organization_id DROP NOT NULL;
