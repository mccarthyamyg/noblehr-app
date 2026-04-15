-- Noble HR — Complete PostgreSQL Schema (consolidated from init-db.js + all SQLite migrations)
-- This is a fresh-database migration; it creates ALL tables with ALL columns.

-- ============================================================================
-- USERS & AUTH
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_type, user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_resend_log (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_verification_resend_email_sent ON verification_resend_log(email, sent_at);

-- ============================================================================
-- ORGANIZATIONS & LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  settings TEXT,
  status TEXT DEFAULT 'pending_approval',
  state TEXT,
  employee_count INTEGER,
  tos_accepted_at TEXT,
  approval_token TEXT,
  approval_token_expires_at TEXT,
  last_approval_email_sent_at TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_by_email TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EMPLOYEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_email TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  department TEXT,
  location_id TEXT REFERENCES locations(id),
  permission_level TEXT DEFAULT 'employee',
  status TEXT DEFAULT 'active',
  hire_date TEXT,
  phone_number TEXT,
  email_reminders INTEGER DEFAULT 0,
  sms_reminders INTEGER DEFAULT 0,
  tags TEXT,
  capabilities TEXT,
  email_verified_at TEXT,
  email_verification_token TEXT,
  email_verification_token_expires TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(user_email);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_by_email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  location_id TEXT,
  used_at TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POLICIES & ACKNOWLEDGMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  current_version INTEGER DEFAULT 0,
  draft_content TEXT,
  applies_to TEXT,
  acknowledgment_required INTEGER DEFAULT 1,
  handbook_category TEXT,
  handbook_id TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);

CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id),
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_locked INTEGER DEFAULT 1,
  change_summary TEXT,
  effective_date TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acknowledgments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  policy_title TEXT,
  version_number INTEGER,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  employee_email TEXT,
  employee_role_at_time TEXT,
  employee_location_at_time TEXT,
  acknowledged_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_locked INTEGER DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acknowledgments_emp ON acknowledgments(employee_id);
CREATE INDEX IF NOT EXISTS idx_acknowledgments_policy ON acknowledgments(policy_id);

CREATE TABLE IF NOT EXISTS pending_re_acknowledgments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  version_number INTEGER,
  previous_version_number INTEGER,
  due_date TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_targeting_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  override_type TEXT NOT NULL,
  employee_id TEXT,
  role TEXT,
  location_id TEXT,
  applies INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HANDBOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS handbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  policy_sections TEXT,
  source TEXT,
  created_by_email TEXT,
  created_by_name TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ONBOARDING
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboardings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  employee_email TEXT,
  assigned_policy_ids TEXT,
  completed_policy_ids TEXT,
  due_date TEXT,
  start_date TEXT,
  completed_date TEXT,
  status TEXT DEFAULT 'not_started',
  reminder_sent_count INTEGER DEFAULT 0,
  last_reminder_date TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HR RECORDS & INCIDENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  record_type TEXT DEFAULT 'write_up',
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'submitted',
  is_locked INTEGER DEFAULT 0,
  severity TEXT,
  discipline_level INTEGER,
  acknowledged_at TEXT,
  acknowledged_by_email TEXT,
  created_by_email TEXT,
  visible_to_employee INTEGER DEFAULT 1,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'submitted',
  is_locked INTEGER DEFAULT 0,
  attachments TEXT,
  admin_notes TEXT,
  incident_type TEXT,
  incident_date TEXT,
  location_id TEXT,
  severity TEXT,
  witnesses TEXT,
  acknowledged_at TEXT,
  acknowledged_by_email TEXT,
  created_by_email TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AMENDMENTS & AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS amendments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  amended_by_email TEXT,
  amendment_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_amendments_org ON amendments(organization_id);

CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_email TEXT,
  actor_name TEXT,
  summary TEXT,
  metadata TEXT,
  ip_address TEXT,
  device_id TEXT,
  app_source TEXT,
  old_value TEXT,
  new_value TEXT,
  deleted_at TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_events_org ON system_events(organization_id);

-- ============================================================================
-- COMPLIANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_checklist_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  state TEXT NOT NULL,
  industry TEXT,
  requirement_key TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  suggested_answer TEXT,
  confirmed INTEGER DEFAULT 0,
  confirmed_at TEXT,
  confirmed_by TEXT,
  notes TEXT,
  source_citation TEXT,
  source_url TEXT,
  researched_at TEXT,
  verified_at TEXT,
  verification_status TEXT DEFAULT 'current',
  employee_threshold INTEGER,
  category TEXT,
  is_federal INTEGER DEFAULT 0,
  original_requirement_text TEXT,
  original_suggested_answer TEXT,
  deleted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_org ON compliance_checklist_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_state_industry ON compliance_checklist_items(state, industry);

-- ============================================================================
-- EMPLOYEE DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_org_emp ON employee_documents(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_deleted ON employee_documents(deleted_at);

CREATE TABLE IF NOT EXISTS document_upload_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
CREATE INDEX IF NOT EXISTS idx_document_upload_log_org_time ON document_upload_log(organization_id, created_at);

-- ============================================================================
-- AUDIT SCHEMA (append-only, separate schema)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.logged_actions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_email TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logged_actions_org ON audit.logged_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_logged_actions_created ON audit.logged_actions(created_at);

-- Immutability: block UPDATE/DELETE on audit log
CREATE OR REPLACE FUNCTION audit.reject_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit.logged_actions is append-only: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'logged_actions_immutable') THEN
    CREATE TRIGGER logged_actions_immutable
      BEFORE UPDATE OR DELETE ON audit.logged_actions
      FOR EACH ROW EXECUTE FUNCTION audit.reject_update_delete();
  END IF;
END $$;
