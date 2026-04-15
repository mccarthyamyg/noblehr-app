/**
 * Noble HR Database Schema
 * Run: node scripts/init-db.js
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'noblehr.db');

import { mkdirSync } from 'fs';
mkdirSync(join(__dirname, '..', 'data'), { recursive: true });

const db = new Database(dbPath);

db.exec(`
-- Users (auth - email/password or Google)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Super Admins (platform-level, approves org signups)
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Organizations (multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  settings TEXT,
  status TEXT DEFAULT 'pending_approval',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Platform locations (created by super admin, available to orgs)
CREATE TABLE IF NOT EXISTS platform_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_by_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Employees (user-org link)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_email TEXT NOT NULL,
  full_name TEXT,
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
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(organization_id, user_email)
);

-- Policies
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Policy Versions (IMMUTABLE)
CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id),
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_locked INTEGER DEFAULT 1,
  change_summary TEXT,
  effective_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Acknowledgments (IMMUTABLE)
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
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pending Re-Acknowledgments
CREATE TABLE IF NOT EXISTS pending_re_acknowledgments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  version_number INTEGER,
  previous_version_number INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Handbooks
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
  created_at TEXT DEFAULT (datetime('now'))
);

-- Onboarding
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
  created_at TEXT DEFAULT (datetime('now'))
);

-- HR Records (write-ups)
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
  created_by_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Incident Reports
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
  created_by_email TEXT,
  created_at TEXT DEFAULT (datetime('now','utc')),
  updated_at TEXT DEFAULT (datetime('now','utc'))
);

-- Amendments (IMMUTABLE - change history)
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
  created_at TEXT DEFAULT (datetime('now','utc'))
);

-- System Events (IMMUTABLE - audit log)
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
  created_at TEXT DEFAULT (datetime('now'))
);

-- Policy Targeting Overrides
CREATE TABLE IF NOT EXISTS policy_targeting_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  override_type TEXT NOT NULL,
  employee_id TEXT,
  role TEXT,
  location_id TEXT,
  applies INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Invites (email invites for employees)
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_by_email TEXT,
  full_name TEXT,
  role TEXT,
  location_id TEXT,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(user_email);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_acknowledgments_emp ON acknowledgments(employee_id);
CREATE INDEX IF NOT EXISTS idx_acknowledgments_policy ON acknowledgments(policy_id);
CREATE INDEX IF NOT EXISTS idx_system_events_org ON system_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_amendments_org ON amendments(organization_id);
`);

// Migrations for existing DBs (amendments: add organization_id, amendment_note if missing)
try {
  const cols = db.prepare("PRAGMA table_info(amendments)").all();
  const hasOrgId = cols.some(c => c.name === 'organization_id');
  const hasNote = cols.some(c => c.name === 'amendment_note');
  if (!hasOrgId) {
    db.exec('ALTER TABLE amendments ADD COLUMN organization_id TEXT');
    db.exec(`UPDATE amendments SET organization_id = COALESCE(
      (SELECT organization_id FROM hr_records WHERE hr_records.id = amendments.record_id LIMIT 1),
      (SELECT organization_id FROM incident_reports WHERE incident_reports.id = amendments.record_id LIMIT 1),
      ''
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_amendments_org ON amendments(organization_id)");
  }
  if (!hasNote) db.exec('ALTER TABLE amendments ADD COLUMN amendment_note TEXT');
} catch (_) { /* table may not exist yet */ }

// Migrations for incident_reports (admin_notes, incident_type, etc.)
try {
  const irCols = db.prepare("PRAGMA table_info(incident_reports)").all();
  const irColNames = irCols.map(c => c.name);
  for (const col of ['admin_notes', 'incident_type', 'incident_date', 'location_id', 'severity', 'witnesses']) {
    if (!irColNames.includes(col)) db.exec(`ALTER TABLE incident_reports ADD COLUMN ${col} TEXT`);
  }
} catch (_) { /* table may not exist yet */ }

// Migration: users.auth_provider (email | google), allow NULL password_hash for Google
try {
  const uCols = db.prepare("PRAGMA table_info(users)").all();
  const uColNames = uCols.map(c => c.name);
  if (!uColNames.includes('auth_provider')) db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email'");
  // SQLite doesn't support ALTER COLUMN; password_hash remains NOT NULL in schema but we can store empty string for Google
} catch (_) { /* table may not exist yet */ }

// Migration: employees - phone_number, email_reminders, sms_reminders
try {
  const empCols = db.prepare("PRAGMA table_info(employees)").all();
  const empColNames = empCols.map(c => c.name);
  if (!empColNames.includes('phone_number')) db.exec("ALTER TABLE employees ADD COLUMN phone_number TEXT");
  if (!empColNames.includes('email_reminders')) db.exec("ALTER TABLE employees ADD COLUMN email_reminders INTEGER DEFAULT 0");
  if (!empColNames.includes('sms_reminders')) db.exec("ALTER TABLE employees ADD COLUMN sms_reminders INTEGER DEFAULT 0");
} catch (_) { /* */ }

// Migration: invites - full_name, role, location_id, used_at
try {
  const invCols = db.prepare("PRAGMA table_info(invites)").all();
  const invColNames = invCols.map(c => c.name);
  for (const col of ['full_name', 'role', 'location_id', 'used_at']) {
    if (!invColNames.includes(col)) db.exec(`ALTER TABLE invites ADD COLUMN ${col} TEXT`);
  }
} catch (_) { /* table may not exist yet */ }

// Migration: organizations.status (pending_approval | active | rejected)
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  if (!oColNames.includes('status')) {
    db.exec("ALTER TABLE organizations ADD COLUMN status TEXT DEFAULT 'active'");
    db.exec("UPDATE organizations SET status = 'active' WHERE status IS NULL");
  }
} catch (_) { /* table may not exist yet */ }

// Migration: super_admins table (create if not exists)
db.exec(`
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Migration: platform_locations table
db.exec(`
CREATE TABLE IF NOT EXISTS platform_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_by_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Migration: platform_locations.deleted_at (soft delete)
try {
  const plCols = db.prepare("PRAGMA table_info(platform_locations)").all();
  const plColNames = plCols.map(c => c.name);
  if (!plColNames.includes('deleted_at')) db.exec("ALTER TABLE platform_locations ADD COLUMN deleted_at TEXT");
} catch (_) { /* */ }

// Migration: organizations - approval_token, approval_token_expires_at, last_approval_email_sent_at
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  for (const col of ['approval_token', 'approval_token_expires_at', 'last_approval_email_sent_at']) {
    if (!oColNames.includes(col)) db.exec(`ALTER TABLE organizations ADD COLUMN ${col} TEXT`);
  }
} catch (_) { /* */ }

// Migration: organizations.deleted_at (soft delete / archive)
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  if (!oColNames.includes('deleted_at')) db.exec("ALTER TABLE organizations ADD COLUMN deleted_at TEXT");
} catch (_) { /* */ }

// Migration: hr_records - acknowledged_at, acknowledged_by_email (for acknowledge-hr-record)
try {
  const hrCols = db.prepare("PRAGMA table_info(hr_records)").all();
  const hrColNames = hrCols.map(c => c.name);
  if (!hrColNames.includes('acknowledged_at')) db.exec("ALTER TABLE hr_records ADD COLUMN acknowledged_at TEXT");
  if (!hrColNames.includes('acknowledged_by_email')) db.exec("ALTER TABLE hr_records ADD COLUMN acknowledged_by_email TEXT");
} catch (_) { /* */ }

// Migration: hr_records - visible_to_employee (TRUTH #159 commendation admin visibility toggle, default on)
try {
  const hrCols = db.prepare("PRAGMA table_info(hr_records)").all();
  const hrColNames = hrCols.map(c => c.name);
  if (!hrColNames.includes('visible_to_employee')) db.exec("ALTER TABLE hr_records ADD COLUMN visible_to_employee INTEGER DEFAULT 1");
} catch (_) { /* */ }

// Migration: incident_reports - same columns for consistency
try {
  const irCols = db.prepare("PRAGMA table_info(incident_reports)").all();
  const irColNames = irCols.map(c => c.name);
  if (!irColNames.includes('acknowledged_at')) db.exec("ALTER TABLE incident_reports ADD COLUMN acknowledged_at TEXT");
  if (!irColNames.includes('acknowledged_by_email')) db.exec("ALTER TABLE incident_reports ADD COLUMN acknowledged_by_email TEXT");
} catch (_) { /* */ }

// Migration: pending_re_acknowledgments.due_date (TRUTH #157 - acknowledgment window)
try {
  const praCols = db.prepare("PRAGMA table_info(pending_re_acknowledgments)").all();
  const praColNames = praCols.map(c => c.name);
  if (!praColNames.includes('due_date')) db.exec("ALTER TABLE pending_re_acknowledgments ADD COLUMN due_date TEXT");
} catch (_) { /* */ }

// Migration: organizations.state (TRUTH #153, #163 - state-aware generation and compliance)
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  if (!oColNames.includes('state')) db.exec("ALTER TABLE organizations ADD COLUMN state TEXT");
} catch (_) { /* */ }

// Migration: organizations.employee_count (state-agnostic compliance — employee count for threshold rules)
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  if (!oColNames.includes('employee_count')) db.exec("ALTER TABLE organizations ADD COLUMN employee_count INTEGER");
} catch (_) { /* */ }

// Migration: organizations.tos_accepted_at (TRUTH #57 - signup consent)
try {
  const oCols = db.prepare("PRAGMA table_info(organizations)").all();
  const oColNames = oCols.map(c => c.name);
  if (!oColNames.includes('tos_accepted_at')) db.exec("ALTER TABLE organizations ADD COLUMN tos_accepted_at TEXT");
} catch (_) { /* */ }

// Migration: employees.capabilities (Phase 4.6 — manager capability matrix)
try {
  const empCols = db.prepare("PRAGMA table_info(employees)").all();
  const empNames = empCols.map(c => c.name);
  if (!empNames.includes('capabilities')) db.exec("ALTER TABLE employees ADD COLUMN capabilities TEXT");
} catch (_) { /* */ }

// Migration: employees — email verification (TRUTH #158 legal defensibility chain)
try {
  const empCols = db.prepare("PRAGMA table_info(employees)").all();
  const empNames = empCols.map(c => c.name);
  if (!empNames.includes('email_verified_at')) db.exec("ALTER TABLE employees ADD COLUMN email_verified_at TEXT");
  if (!empNames.includes('email_verification_token')) db.exec("ALTER TABLE employees ADD COLUMN email_verification_token TEXT");
  if (!empNames.includes('email_verification_token_expires')) db.exec("ALTER TABLE employees ADD COLUMN email_verification_token_expires TEXT");
  // Backfill: existing employees are treated as verified (only new invite-accepted employees need to verify)
  db.prepare("UPDATE employees SET email_verified_at = created_at WHERE email_verified_at IS NULL").run();
} catch (_) { /* */ }

// Table for resend verification rate limit (max 3 per hour per email)
db.exec(`
CREATE TABLE IF NOT EXISTS verification_resend_log (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_verification_resend_email_sent ON verification_resend_log(email, sent_at)');

// TRUTH #56: Employee documents (uploaded files in employee file)
db.exec(`
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
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_employee_documents_org_emp ON employee_documents(organization_id, employee_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_employee_documents_deleted ON employee_documents(deleted_at)');

// Rate limit: document uploads per org per hour (20)
db.exec(`
CREATE TABLE IF NOT EXISTS document_upload_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_document_upload_log_org_time ON document_upload_log(organization_id, created_at)');

// Migration: soft delete — Platform Truth #53 (FIX 3)
for (const table of ['employees', 'policies', 'hr_records', 'incident_reports', 'invites']) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const names = cols.map(c => c.name);
    if (!names.includes('deleted_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
  } catch (_) { /* */ }
}

// Migration: system_events — Platform Truth #109 (FIX 4) audit log fields
try {
  const seCols = db.prepare('PRAGMA table_info(system_events)').all();
  const seNames = seCols.map(c => c.name);
  for (const col of ['ip_address', 'device_id', 'app_source', 'old_value', 'new_value']) {
    if (!seNames.includes(col)) db.exec(`ALTER TABLE system_events ADD COLUMN ${col} TEXT`);
  }
} catch (_) { /* */ }

// Migration: password_reset_tokens
db.exec(`
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Refresh tokens (Phase 4.2) — rotation and reuse detection
db.exec(`
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT
)`);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_type, user_id)');

// Compliance checklist (TRUTH #162) — state/industry requirements with org confirmation
db.exec(`
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_compliance_org ON compliance_checklist_items(organization_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_compliance_state_industry ON compliance_checklist_items(state, industry)');

// Migration: compliance_checklist_items — source citation, verification, category, employee threshold (state-agnostic compliance)
try {
  const cCols = db.prepare("PRAGMA table_info(compliance_checklist_items)").all();
  const cColNames = cCols.map(c => c.name);
  for (const col of ['source_citation', 'source_url', 'researched_at', 'verified_at', 'verification_status', 'employee_threshold', 'category', 'is_federal']) {
    if (!cColNames.includes(col)) {
      if (col === 'verification_status') db.exec("ALTER TABLE compliance_checklist_items ADD COLUMN verification_status TEXT DEFAULT 'current'");
      else if (col === 'employee_threshold') db.exec("ALTER TABLE compliance_checklist_items ADD COLUMN employee_threshold INTEGER");
      else if (col === 'is_federal') db.exec("ALTER TABLE compliance_checklist_items ADD COLUMN is_federal INTEGER DEFAULT 0");
      else db.exec(`ALTER TABLE compliance_checklist_items ADD COLUMN ${col} TEXT`);
    }
  }
} catch (_) { /* */ }

// Migration: original_content / display_content — Law separation (REQ2). requirement_text/suggested_answer = display; original_* = never modified.
try {
  const cCols = db.prepare("PRAGMA table_info(compliance_checklist_items)").all();
  const cColNames = cCols.map(c => c.name);
  if (!cColNames.includes('original_requirement_text')) db.exec("ALTER TABLE compliance_checklist_items ADD COLUMN original_requirement_text TEXT");
  if (!cColNames.includes('original_suggested_answer')) db.exec("ALTER TABLE compliance_checklist_items ADD COLUMN original_suggested_answer TEXT");
  // Backfill: preserve original where missing
  db.prepare("UPDATE compliance_checklist_items SET original_requirement_text = COALESCE(original_requirement_text, requirement_text) WHERE original_requirement_text IS NULL OR original_requirement_text = ''").run();
  db.prepare("UPDATE compliance_checklist_items SET original_suggested_answer = COALESCE(original_suggested_answer, suggested_answer) WHERE original_suggested_answer IS NULL AND suggested_answer IS NOT NULL").run();
} catch (_) { /* */ }

// deleted_at on remaining tables (soft delete / consistency); acknowledgments legal capture columns
const deletedAtMore = [
  'pending_re_acknowledgments',
  'handbooks',
  'locations',
  'policy_targeting_overrides',
  'onboardings',
  'acknowledgments',
  'policy_versions',
  'system_events',
  'compliance_checklist_items',
];
for (const table of deletedAtMore) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const names = cols.map((c) => c.name);
    if (!names.includes('deleted_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
  } catch (_) {
    /* column may already exist */
  }
}
try {
  const akCols = db.prepare('PRAGMA table_info(acknowledgments)').all();
  const akNames = akCols.map((c) => c.name);
  if (!akNames.includes('ip_address')) db.exec('ALTER TABLE acknowledgments ADD COLUMN ip_address TEXT');
  if (!akNames.includes('user_agent')) db.exec('ALTER TABLE acknowledgments ADD COLUMN user_agent TEXT');
} catch (_) {
  /* */
}

// Federal baseline only — universal floor for ALL employers (Truth #162 correction: no state-specific hardcoding)
const federalBaseline = [
  { key: 'eeo_title_vii', text: 'Equal Employment Opportunity (Title VII)', suggested: 'Policy and practices comply with Title VII; no discrimination on protected bases.', citation: '42 U.S.C. § 2000e et seq.', url: 'https://www.eeoc.gov/', category: 'discrimination' },
  { key: 'ada_compliance', text: 'Americans with Disabilities Act (ADA) compliance', suggested: 'Reasonable accommodations process in place; no discrimination on basis of disability.', citation: '42 U.S.C. § 12101 et seq.', url: 'https://www.ada.gov/', category: 'discrimination' },
  { key: 'flsa_wage_hour', text: 'Fair Labor Standards Act (FLSA) wage and hour', suggested: 'Minimum wage, overtime, and recordkeeping per FLSA.', citation: '29 U.S.C. § 201 et seq.', url: 'https://www.dol.gov/agencies/whd/flsa', category: 'wage_and_hour' },
  { key: 'osha_safety', text: 'OSHA workplace safety', suggested: 'Workplace safety program; reporting and compliance with OSHA requirements.', citation: '29 U.S.C. § 651 et seq.', url: 'https://www.osha.gov/', category: 'safety' },
  { key: 'i9_verification', text: 'I-9 Employment Eligibility Verification', suggested: 'I-9 completed for all new hires; E-Verify if used.', citation: '8 U.S.C. § 1324a; 8 C.F.R. § 274a.', url: 'https://www.uscis.gov/i-9', category: 'posting' },
  { key: 'anti_harassment_discrimination', text: 'Anti-harassment and anti-discrimination policy', suggested: 'Written policy; training and complaint process in place.', citation: 'Title VII; EEOC guidance.', url: 'https://www.eeoc.gov/', category: 'discrimination' },
  { key: 'at_will_employment', text: 'At-will employment statement', suggested: 'Handbook includes at-will employment statement where applicable; state-specific nuances may apply.', citation: 'Common law; state-specific.', url: '', category: 'posting' },
];
const { randomUUID } = await import('crypto');
const existingFederal = new Set(
  (db.prepare("SELECT requirement_key FROM compliance_checklist_items WHERE organization_id = '' AND state = 'FEDERAL' AND deleted_at IS NULL").all() || []).map((row) => row.requirement_key)
);
const now = new Date().toISOString();
for (const r of federalBaseline) {
  if (existingFederal.has(r.key)) continue;
  const text = r.text;
  const suggested = r.suggested || '';
  db.prepare(`
    INSERT INTO compliance_checklist_items (id, organization_id, state, industry, requirement_key, requirement_text, suggested_answer, original_requirement_text, original_suggested_answer, source_citation, source_url, researched_at, verified_at, verification_status, category, is_federal)
    VALUES (?, '', 'FEDERAL', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', ?, 1)
  `).run(randomUUID(), r.key, text, suggested, text, suggested, r.citation || '', r.url || '', now, now, r.category || '');
}

// Migration: first_name / last_name split (Noble platform cross-app parity)
for (const table of ['users', 'employees', 'super_admins']) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const colNames = cols.map(c => c.name);
    if (!colNames.includes('first_name')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN first_name TEXT`);
      // Backfill: split full_name on first space
      db.prepare(`UPDATE ${table} SET first_name = CASE WHEN INSTR(full_name, ' ') > 0 THEN SUBSTR(full_name, 1, INSTR(full_name, ' ') - 1) ELSE full_name END WHERE first_name IS NULL AND full_name IS NOT NULL`).run();
    }
    if (!colNames.includes('last_name')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN last_name TEXT`);
      // Backfill: everything after the first space
      db.prepare(`UPDATE ${table} SET last_name = CASE WHEN INSTR(full_name, ' ') > 0 THEN SUBSTR(full_name, INSTR(full_name, ' ') + 1) ELSE '' END WHERE last_name IS NULL AND full_name IS NOT NULL`).run();
    }
  } catch (_) { /* table may not exist yet */ }
}

// Migration: invites — first_name / last_name
try {
  const invCols = db.prepare("PRAGMA table_info(invites)").all();
  const invColNames = invCols.map(c => c.name);
  if (!invColNames.includes('first_name')) db.exec("ALTER TABLE invites ADD COLUMN first_name TEXT");
  if (!invColNames.includes('last_name')) db.exec("ALTER TABLE invites ADD COLUMN last_name TEXT");
  // Backfill from existing full_name
  db.prepare("UPDATE invites SET first_name = CASE WHEN INSTR(full_name, ' ') > 0 THEN SUBSTR(full_name, 1, INSTR(full_name, ' ') - 1) ELSE full_name END WHERE first_name IS NULL AND full_name IS NOT NULL").run();
  db.prepare("UPDATE invites SET last_name = CASE WHEN INSTR(full_name, ' ') > 0 THEN SUBSTR(full_name, INSTR(full_name, ' ') + 1) ELSE '' END WHERE last_name IS NULL AND full_name IS NOT NULL").run();
} catch (_) { /* */ }

console.log('Database initialized at', dbPath);
db.close();
