-- Noble HR — Notification Preferences (ported from Noble Task)
-- IMPORTANT: Use TEXT columns for IDs — NOT UUID (matches existing schema, avoids type mismatch crash)

-- Per-employee notification preference overrides
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  notification_type TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'immediate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, notification_type)
);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_emp ON notification_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_org ON notification_preferences(organization_id);

-- Org-wide notification defaults (admin configurable)
CREATE TABLE IF NOT EXISTS org_notification_defaults (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  notification_type TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'immediate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, notification_type)
);
CREATE INDEX IF NOT EXISTS idx_org_notif_defaults_org ON org_notification_defaults(organization_id);
