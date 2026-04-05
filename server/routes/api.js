import { Router } from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from "../lib/db-pg-adapter.js";

/** Returns ISO datetime string for SQL — portable across SQLite and PG. */
function sqlNow() { return new Date().toISOString(); }

const __dirnameApi = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirnameApi, '..', 'data', 'uploads');

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => cb(null, uuidv4()),
});
const uploadMulter = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname && '.' + file.originalname.split('.').pop().toLowerCase()) || '';
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG, JPEG, DOC, DOCX'));
    }
    cb(null, true);
  },
});
import { parseJson, stringifyJson } from "../lib/db-pg-adapter.js";
import { authMiddleware, getEmployeeContext, getOrgContextByOrgId, hashPassword, verifyPassword, createToken } from '../lib/auth.js';
import { streamPolicyGeneration, isClaudeConfigured, scanHandbookMissing, extractPoliciesFromHandbook, handbookRecommend, policySuggest, assistWriteUp, generateComplianceChecklist, verifyComplianceChecklist } from '../lib/claude.js';
import { sendAcknowledgmentConfirmation, sendAcknowledgmentReminder } from '../lib/email.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
router.use(authMiddleware);

// Helper: get org + employee from token (supports super admin impersonation)
async function getContext(req) {
  if (req.superAdmin) {
    if (req.impersonateOrgId) {
      const { org, employee } = await getOrgContextByOrgId(req.impersonateOrgId);
      return { org, employee, superAdmin: true };
    }
    return { org: null, employee: null, superAdmin: true };
  }
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return { org: null, employee: null };
  const ctx = await getEmployeeContext(user.email);
  return { ...ctx, superAdmin: false };
}

// Platform Truth #109: audit log fields for system_events (ip_address, device_id, app_source)
function getAuditContext(req) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null;
  const clientType = (req?.headers?.['x-client-type'] || '').toLowerCase();
  const app_source = clientType.includes('mobile') || clientType.includes('expo') ? 'noblehr_mobile' : 'noblehr_web';
  return { ip_address: ip || null, device_id: null, app_source };
}

function publicFrontendBase(req) {
  const raw = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const envLooksLocal = !raw || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw);
  const hostLooksDeployed = host && !/^localhost(:\d+)?$/i.test(host) && !/^127\.0\.0\.1(:\d+)?$/i.test(host);
  if (envLooksLocal && hostLooksDeployed) {
    const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
    return `${proto}://${host}`;
  }
  if (raw) return raw;
  if (host && hostLooksDeployed) {
    const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim() || req.protocol || 'https';
    return `${proto}://${host}`;
  }
  return 'http://localhost:5173';
}

function isAdmin(employee) {
  return employee?.permission_level === 'org_admin';
}

// TRUTH #159: HR record_type — internal_note, verbal_warning, written_warning, final_warning, immediate_termination, commendation (write_up accepted as alias for written_warning)
const HR_RECORD_TYPES = new Set(['internal_note', 'verbal_warning', 'written_warning', 'final_warning', 'immediate_termination', 'commendation', 'write_up']);

// TRUTH #157: Acknowledgment window tiers — platform default (below), business default in org.settings, per-publish override in safeData.due_date
const PLATFORM_DEFAULT_ACK_WINDOW_NEW_DAYS = 14;
const PLATFORM_DEFAULT_ACK_WINDOW_UPDATE_DAYS = 7;

// Phase 4.6 — Manager capability matrix. org_admin has all; manager has only granted capabilities.
const ALL_CAPABILITIES = [
  'manage_employees',
  'view_hr_records',
  'manage_hr_records',
  'view_incidents',
  'manage_incidents',
  'manage_policies',
  'manage_onboarding',
  'export_employee_file',
  'export_org_data',
  'view_activity_log',
  'manage_org_settings',
  'view_acknowledgments',
  'manage_acknowledgments',
  'compliance_checklist',
  'gap_audit',
  'ai_policies',
  'invites',
];

function hasCapability(employee, capability) {
  if (!employee) return false;
  if (employee.permission_level === 'org_admin') return true;
  if (employee.permission_level === 'manager') {
    const caps = Array.isArray(employee.capabilities) ? employee.capabilities : [];
    return caps.includes(capability);
  }
  return false;
}

function canAccessEntityWrite(employee, entityType) {
  if (!employee) return false;
  if (isAdmin(employee)) return true;
  const capMap = {
    Policy: 'manage_policies',
    Handbook: 'manage_policies',
    PolicyTargetingOverride: 'manage_policies',
    Onboarding: 'manage_onboarding',
    Location: 'manage_org_settings',
    HRRecord: 'manage_hr_records',
    IncidentReport: 'manage_incidents',
  };
  const cap = capMap[entityType];
  return cap ? hasCapability(employee, cap) : false;
}

async function validateLocationId(orgId, locationId) {
  if (!locationId) return true;
  const loc = await db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(locationId, orgId);
  return !!loc;
}

function requireSuperAdmin(req, res, next) {
  if (!req.superAdmin) return res.status(403).json({ error: 'Super admin required' });
  next();
}

/** Express middleware for granular access control reducing redundant context checks. */
function requireCapability(capability) {
  return async (req, res, next) => {
    const { org, employee } = await getContext(req);
    if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
    if (!hasCapability(employee, capability)) return res.status(403).json({ error: `Forbidden: requires ${capability} capability` });
    req.orgContext = { org, employee }; // Cache for endpoint
    next();
  };
}

// GET /api/capabilities — list of capability keys + labels for manager role (4.6)
const CAPABILITY_LABELS = {
  manage_employees: 'Manage employees & invites',
  view_hr_records: 'View HR records',
  manage_hr_records: 'Create/edit HR records',
  view_incidents: 'View incident reports',
  manage_incidents: 'Create/edit incident reports',
  manage_policies: 'Manage policies & handbook',
  manage_onboarding: 'Manage onboarding',
  export_employee_file: 'Export employee file',
  export_org_data: 'Export org data',
  view_activity_log: 'View activity log',
  manage_org_settings: 'Manage org settings & locations',
  view_acknowledgments: 'View acknowledgments',
  manage_acknowledgments: 'Manage acknowledgments & reminders',
  compliance_checklist: 'Compliance checklist',
  gap_audit: 'Gap audit',
  ai_policies: 'AI policy generation',
  invites: 'Manage invites',
};
router.get('/capabilities', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org && !req.superAdmin) return res.status(403).json({ error: 'Forbidden' });
  const list = ALL_CAPABILITIES.map(key => ({ key, label: CAPABILITY_LABELS[key] || key }));
  res.json({ data: { capabilities: list } });
});

// GET /api/me - Employee context or super admin context (supports impersonation)
router.get('/me', async (req, res) => {
  if (req.superAdmin) {
    if (req.impersonateOrgId) {
      const { org, employee } = await getOrgContextByOrgId(req.impersonateOrgId);
      if (!org || !employee) return res.status(403).json({ error: 'Organization not found' });
      return res.json({
        org,
        employee,
        superAdminImpersonating: true,
        user: { email: req.user.email, full_name: req.user.full_name },
      });
    }
    return res.json({
      superAdmin: true,
      user: { email: req.user.email, full_name: req.user.full_name },
      org: null,
      employee: null,
    });
  }
  const { org, employee } = await getContext(req);
  if (!org || !employee) {
    return res.status(403).json({ error: 'No organization or employee record' });
  }
  res.json({ org, employee });
});

// --- Super Admin routes ---
router.post('/super-admin/pending-orgs', requireSuperAdmin, async (req, res) => {
  const orgs = await db.prepare(`
    SELECT o.*, e.user_email as admin_email, e.full_name as admin_name
    FROM organizations o
    LEFT JOIN employees e ON e.organization_id = o.id AND e.permission_level = 'org_admin'
    WHERE o.status = 'pending_approval'
    ORDER BY o.created_at DESC
  `).all();
  res.json({ data: orgs });
});

router.post('/super-admin/approve-org', requireSuperAdmin, async (req, res) => {
  const { organization_id } = req.body;
  if (!organization_id) return res.status(400).json({ error: 'organization_id required' });
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(organization_id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  if (org.status !== 'pending_approval') return res.status(400).json({ error: 'Org not pending approval' });
  await db.prepare('UPDATE organizations SET status = ? WHERE id = ?').run('active', organization_id);
  res.json({ data: { success: true } });
});

router.post('/super-admin/reject-org', requireSuperAdmin, async (req, res) => {
  const { organization_id } = req.body;
  if (!organization_id) return res.status(400).json({ error: 'organization_id required' });
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(organization_id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  await db.prepare('UPDATE organizations SET status = ? WHERE id = ?').run('rejected', organization_id);
  res.json({ data: { success: true } });
});

router.post('/super-admin/archive-org', requireSuperAdmin, async (req, res) => {
  const { organization_id } = req.body;
  if (!organization_id) return res.status(400).json({ error: 'organization_id required' });
  const org = await db.prepare('SELECT id, deleted_at FROM organizations WHERE id = ?').get(organization_id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  if (org.deleted_at) return res.status(400).json({ error: 'Organization is already archived' });
  const now = new Date().toISOString();
  await db.prepare('UPDATE organizations SET deleted_at = ? WHERE id = ?').run(now, organization_id);
  res.json({ data: { success: true } });
});

router.post('/super-admin/platform-locations', requireSuperAdmin, async (req, res) => {
  const locations = await db.prepare(
    "SELECT * FROM platform_locations WHERE deleted_at IS NULL ORDER BY name"
  ).all();
  res.json({ data: locations });
});

router.post('/super-admin/delete-platform-location', requireSuperAdmin, async (req, res) => {
  const { location_id } = req.body;
  if (!location_id) return res.status(400).json({ error: 'location_id required' });
  const loc = await db.prepare('SELECT id, deleted_at FROM platform_locations WHERE id = ?').get(location_id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  if (loc.deleted_at) return res.status(400).json({ error: 'Location is already deleted' });
  const now = new Date().toISOString();
  await db.prepare('UPDATE platform_locations SET deleted_at = ? WHERE id = ?').run(now, location_id);
  res.json({ data: { success: true } });
});

router.post('/super-admin/create-location', requireSuperAdmin, async (req, res) => {
  const { name, address } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  await db.prepare('INSERT INTO platform_locations (id, name, address, created_by_email) VALUES (?, ?, ?, ?)').run(
    id, name.trim().slice(0, 200), (address || '').trim().slice(0, 500), req.user.email
  );
  res.json({ data: { id, name: name.trim(), address: address || '' } });
});

router.post('/super-admin/all-orgs', requireSuperAdmin, async (req, res) => {
  const orgs = await db.prepare(`
    SELECT o.*, e.user_email as admin_email, e.full_name as admin_name
    FROM organizations o
    LEFT JOIN employees e ON e.organization_id = o.id AND e.permission_level = 'org_admin'
    ORDER BY o.created_at DESC
  `).all();
  res.json({ data: orgs });
});

// Approved orgs with their locations, admin info - for super admin dashboard (excludes archived)
router.post('/super-admin/orgs-with-locations', requireSuperAdmin, async (req, res) => {
  const orgs = await db.prepare(`
    SELECT o.*, e.user_email as admin_email, e.full_name as admin_name, e.id as admin_employee_id
    FROM organizations o
    LEFT JOIN employees e ON e.organization_id = o.id AND e.permission_level = 'org_admin'
    WHERE o.status = 'active' AND o.deleted_at IS NULL
    ORDER BY o.name
  `).all();
  const result = await Promise.all(orgs.map(async org => {
    const locs = await db.prepare('SELECT id, name, address FROM locations WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
    return { ...org, locations: locs };
  }));
  res.json({ data: result });
});

// Create short-lived launch token for super admin to access an org
router.post('/super-admin/launch-token', requireSuperAdmin, async (req, res) => {
  const { organization_id } = req.body;
  if (!organization_id) return res.status(400).json({ error: 'organization_id required' });
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(organization_id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  if (org.status !== 'active') return res.status(403).json({ error: 'Organization not active' });
  if (org.deleted_at) return res.status(403).json({ error: 'Organization is archived' });
  const token = createToken(req.user.id, req.user.email, {
    isSuperAdmin: true,
    impersonateOrgId: organization_id,
    expiresIn: '1h',
  });
  // TRUTH #57: Log every super admin launch for audit and privacy compliance.
  const audit = getAuditContext(req);
  await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    uuidv4(), organization_id, 'super_admin.launch', 'Organization', organization_id,
    req.user.email || '', req.user.full_name || 'Super Admin',
    'Super admin launched into organization',
    stringifyJson({ impersonate_org_id: organization_id }),
    audit.ip_address, audit.device_id, audit.app_source, null, null
  );
  const baseUrl = publicFrontendBase(req);
  const launchLink = `${baseUrl}/Launch?token=${token}`;
  res.json({ data: { token, launch_link: launchLink } });
});

// Ensure test org exists, return its id
router.post('/super-admin/ensure-test-org', requireSuperAdmin, async (req, res) => {
  const TEST_ORG_NAME = '_TEST_Location_SuperAdmin';
  let org = await db.prepare('SELECT * FROM organizations WHERE name = ?').get(TEST_ORG_NAME);
  if (!org) {
    const orgId = uuidv4();
    const empId = uuidv4();
    const userId = uuidv4();
    const testEmail = `test-${orgId.slice(0, 8)}@noblehr.test`;
    await db.transaction(async () => {
      await db.prepare('INSERT INTO users (id, email, password_hash, full_name, auth_provider) VALUES (?, ?, ?, ?, ?)').run(
        userId, testEmail, hashPassword('TestPass123!'), 'Test Admin', 'email'
      );
      await db.prepare(`INSERT INTO organizations (id, name, industry, settings, status) VALUES (?, ?, ?, ?, ?)`).run(
        orgId, TEST_ORG_NAME, 'Test', '{}', 'active'
      );
      await db.prepare('INSERT INTO locations (id, organization_id, name, address) VALUES (?, ?, ?, ?)').run(
        uuidv4(), orgId, 'Test Location', '123 Test St'
      );
      await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, permission_level, status, hire_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        empId, orgId, testEmail, 'Test Admin', 'Admin', 'org_admin', 'active', new Date().toISOString().split('T')[0]
      );
    })();
    org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  }
  res.json({ data: { organization_id: org.id, name: org.name } });
});

// Account: change password (org users + super admin)
router.post('/account/change-password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });
  if (typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 128) {
    return res.status(400).json({ error: 'New password must be 8-128 characters' });
  }
  const user = req.user;
  if (!verifyPassword(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const table = req.superAdmin ? 'super_admins' : 'users';
  const idCol = req.superAdmin ? 'id' : 'id';
  await db.prepare(`UPDATE ${table} SET password_hash = ? WHERE ${idCol} = ?`).run(hashPassword(new_password), user.id);
  res.json({ data: { success: true } });
});

// Account: change email (org users only)
router.post('/account/change-email', async (req, res) => {
  if (req.superAdmin) return res.status(403).json({ error: 'Super admin email cannot be changed via app' });
  const { new_email, password } = req.body;
  if (!new_email || !password) return res.status(400).json({ error: 'new_email and password required' });
  const emailTrim = new_email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) return res.status(400).json({ error: 'Invalid email format' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Password is incorrect' });
  const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(emailTrim);
  if (existing && existing.id !== user.id) return res.status(400).json({ error: 'Email already in use' });
  await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(emailTrim, user.id);
  await db.prepare('UPDATE employees SET user_email = ? WHERE user_email = ?').run(emailTrim, user.email);
  res.json({ data: { success: true, new_email: emailTrim } });
});

// Account: update profile (name, phone, notification prefs)
router.post('/account/update-profile', async (req, res) => {
  const { full_name, phone_number, email_reminders, sms_reminders } = req.body;
  if (req.superAdmin) {
    if (full_name != null && typeof full_name === 'string') {
      const name = full_name.trim().slice(0, 200);
      await db.prepare('UPDATE super_admins SET full_name = ? WHERE id = ?').run(name || null, req.user.id);
    }
    return res.json({ data: { success: true } });
  }
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const updates = [];
  const values = [];
  if (full_name != null && typeof full_name === 'string') {
    const name = full_name.trim().slice(0, 200);
    updates.push('full_name = ?');
    values.push(name || '');
  }
  if (phone_number !== undefined) {
    updates.push('phone_number = ?');
    values.push(typeof phone_number === 'string' ? phone_number.trim().slice(0, 50) : null);
  }
  if (email_reminders !== undefined) {
    updates.push('email_reminders = ?');
    values.push(email_reminders ? 1 : 0);
  }
  if (sms_reminders !== undefined) {
    updates.push('sms_reminders = ?');
    values.push(sms_reminders ? 1 : 0);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(employee.id, org.id);
  await db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`).run(...values);
  if (full_name != null && typeof full_name === 'string') {
    const name = full_name.trim().slice(0, 200);
    await db.prepare('UPDATE users SET full_name = ? WHERE email = ?').run(name || '', employee.user_email);
  }
  res.json({ data: { success: true } });
});

// System Events (Base44 Replacement)
router.post('/functions/getSystemEvents', async (req, res) => {
  const { organization_id, entity_id, event_type } = req.body;
  if (!organization_id || !entity_id) return res.status(400).json({ error: 'organization_id and entity_id required' });
  const events = await db.prepare('SELECT * FROM system_events WHERE organization_id = ? AND entity_id = ? AND event_type = ? ORDER BY created_date DESC').all(organization_id, entity_id, event_type);
  res.json({ data: events });
});

router.post('/functions/createSystemEvent', async (req, res) => {
  const { organization_id, event_type, entity_type, entity_id, actor_email, summary, metadata } = req.body;
  const { org } = await getContext(req);
  if (!org || org.id !== organization_id) return res.status(403).json({ error: 'Forbidden org' });
  await logAudit({ organizationId: organization_id, actorEmail: actor_email, action: event_type, entityType: entity_type, entityId: entity_id, newData: metadata, req });
  res.json({ data: { success: true } });
});

// GET /api/admin-context
router.post('/admin-context', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_org_settings') && !hasCapability(employee, 'manage_employees') && !hasCapability(employee, 'manage_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id, include } = req.body;
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const locations = await db.prepare('SELECT * FROM locations WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const employees = await db.prepare('SELECT * FROM employees WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const overrides = await db.prepare('SELECT * FROM policy_targeting_overrides WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);

  let onboardings = [];
  if (include?.includes('onboardings')) {
    onboardings = await db.prepare('SELECT * FROM onboardings WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  }

  let amendments_hr = [];
  let amendments_incident = [];
  const enrichAmendment = async a => {
    const u = a.amended_by_email ? await db.prepare('SELECT full_name FROM users WHERE email = ?').get(a.amended_by_email) : null;
    return { ...a, created_date: a.created_at, amended_by_name: u?.full_name || a.amended_by_email || 'Unknown' };
  };
  if (include?.includes('amendments_hr')) {
    amendments_hr = await Promise.all((await db.prepare('SELECT * FROM amendments WHERE organization_id = ? AND record_type = ?').all(org.id, 'HRRecord')).map(enrichAmendment));
  }
  if (include?.includes('amendments_incident')) {
    amendments_incident = await Promise.all((await db.prepare('SELECT * FROM amendments WHERE organization_id = ? AND record_type = ?').all(org.id, 'IncidentReport')).map(enrichAmendment));
  }

  res.json({
    data: {
      locations,
      employees,
      policies,
      overrides,
      onboardings,
      amendments_hr,
      amendments_incident
    }
  });
});

// GET /api/applicable-policies
router.post('/applicable-policies', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, employee_id, acknowledgment_required_only } = req.body;
  if (!organization_id || !employee_id) return res.status(400).json({ error: 'organization_id, employee_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  if (!isAdmin(employee) && employee.id !== employee_id) return res.status(403).json({ error: 'Forbidden' });

  const targetEmp = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(employee_id, org.id);
  if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

  const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND status = ? AND deleted_at IS NULL').all(org.id, 'active');
  const overrides = await db.prepare('SELECT * FROM policy_targeting_overrides WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);

  const applicable = policies.filter(policy => {
    const empOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'employee' && o.employee_id === targetEmp.id);
    if (empOverride) return !!empOverride.applies;
    const roleOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'role' && o.role === targetEmp.role);
    if (roleOverride) return !!roleOverride.applies;
    const locOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'location' && o.location_id === targetEmp.location_id);
    if (locOverride) return !!locOverride.applies;

    const at = parseJson(policy.applies_to);
    if (!at) return true;
    if (at.all_employees) return true;
    const hasCriteria = (at.roles?.length || at.departments?.length || at.locations?.length || at.tags?.length);
    if (!hasCriteria) return true;
    if (at.roles?.length && targetEmp.role && at.roles.includes(targetEmp.role)) return true;
    if (at.departments?.length && targetEmp.department && at.departments.includes(targetEmp.department)) return true;
    if (at.locations?.length && targetEmp.location_id && at.locations.includes(targetEmp.location_id)) return true;
    const tags = parseJson(targetEmp.tags);
    if (at.tags?.length && tags?.some(t => at.tags.includes(t))) return true;
    return false;
  });

  const filtered = acknowledgment_required_only ? applicable.filter(p => p.acknowledgment_required) : applicable;
  res.json({ data: { policies: filtered } });
});

// GET /api/policies-for-employee
router.post('/policies-for-employee', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id } = req.body;
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  if (isAdmin(employee)) {
    const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
    return res.json({ data: { policies } });
  }
  // Non-admin: get applicable policies only
  const targetEmp = employee;
  const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND status = ? AND deleted_at IS NULL').all(org.id, 'active');
  const overrides = await db.prepare('SELECT * FROM policy_targeting_overrides WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const applicable = policies.filter(policy => {
    const empOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'employee' && o.employee_id === targetEmp.id);
    if (empOverride) return !!empOverride.applies;
    const roleOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'role' && o.role === targetEmp.role);
    if (roleOverride) return !!roleOverride.applies;
    const locOverride = overrides.find(o => o.policy_id === policy.id && o.override_type === 'location' && o.location_id === targetEmp.location_id);
    if (locOverride) return !!locOverride.applies;
    const at = parseJson(policy.applies_to);
    if (!at) return true;
    if (at.all_employees) return true;
    const hasCriteria = (at.roles?.length || at.departments?.length || at.locations?.length || at.tags?.length);
    if (!hasCriteria) return true;
    if (at.roles?.length && targetEmp.role && at.roles.includes(targetEmp.role)) return true;
    if (at.departments?.length && targetEmp.department && at.departments.includes(targetEmp.department)) return true;
    if (at.locations?.length && targetEmp.location_id && at.locations.includes(targetEmp.location_id)) return true;
    const tags = parseJson(targetEmp.tags);
    if (at.tags?.length && tags?.some(t => at.tags.includes(t))) return true;
    return false;
  });
  res.json({ data: { policies: applicable } });
});

// Create secure acknowledgment
router.post('/create-acknowledgment', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { policy_id, organization_id, employee_id } = req.body;
  if (!policy_id || !organization_id || !employee_id) return res.status(400).json({ error: 'policy_id, organization_id, employee_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  if (!isAdmin(employee) && employee.id !== employee_id) return res.status(403).json({ error: 'Forbidden' });

  const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  if (policy.status !== 'active' || policy.current_version === 0) return res.status(403).json({ error: 'Cannot acknowledge draft or archived policy' });

  const targetEmp = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(employee_id, org.id);
  if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

  // Verify policy applies to this employee (legal requirement)
  const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND status = ? AND deleted_at IS NULL').all(org.id, 'active');
  const overrides = await db.prepare('SELECT * FROM policy_targeting_overrides WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const applicable = policies.filter(p => {
    const empOverride = overrides.find(o => o.policy_id === p.id && o.override_type === 'employee' && o.employee_id === targetEmp.id);
    if (empOverride) return !!empOverride.applies;
    const roleOverride = overrides.find(o => o.policy_id === p.id && o.override_type === 'role' && o.role === targetEmp.role);
    if (roleOverride) return !!roleOverride.applies;
    const locOverride = overrides.find(o => o.policy_id === p.id && o.override_type === 'location' && o.location_id === targetEmp.location_id);
    if (locOverride) return !!locOverride.applies;
    const at = parseJson(p.applies_to);
    if (!at) return true;
    if (at.all_employees) return true;
    const hasCriteria = (at.roles?.length || at.departments?.length || at.locations?.length || at.tags?.length);
    if (!hasCriteria) return true;
    if (at.roles?.length && targetEmp.role && at.roles.includes(targetEmp.role)) return true;
    if (at.departments?.length && targetEmp.department && at.departments.includes(targetEmp.department)) return true;
    if (at.locations?.length && targetEmp.location_id && at.locations.includes(targetEmp.location_id)) return true;
    const tags = parseJson(targetEmp.tags);
    if (at.tags?.length && tags?.some(t => at.tags.includes(t))) return true;
    return false;
  });
  if (!applicable.some(p => p.id === policy_id)) {
    return res.status(403).json({ error: 'Policy does not apply to this employee' });
  }

  const version = await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND version_number = ? AND deleted_at IS NULL').get(policy_id, policy.current_version);
  if (!version) return res.status(404).json({ error: 'Policy version not found' });

  const contentHash = createHash('sha256').update(version.content || '').digest('hex');
  const ackId = uuidv4();
  const fwd = req.headers['x-forwarded-for'];
  const ackIp = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : Array.isArray(fwd) ? String(fwd[0]).trim() : '') || req.socket?.remoteAddress || '';
  const ackUa = req.headers['user-agent'] || '';
  await db.prepare(`INSERT INTO acknowledgments (id, organization_id, policy_id, policy_version_id, policy_title, version_number, employee_id, employee_name, employee_email, employee_role_at_time, employee_location_at_time, acknowledged_at, content_hash, is_locked, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    ackId, org.id, policy_id, version.id, policy.title, policy.current_version, employee_id, targetEmp.full_name, targetEmp.user_email, targetEmp.role || 'Employee', targetEmp.location_id || '',
    new Date().toISOString(), contentHash, 1, ackIp, ackUa
  );

  await db.prepare('UPDATE pending_re_acknowledgments SET deleted_at = ? WHERE organization_id = ? AND employee_id = ? AND policy_id = ? AND deleted_at IS NULL').run(sqlNow(), org.id, employee_id, policy_id);

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const audit = getAuditContext(req);
  const ua = req.headers['user-agent'] || '';
  const meta = stringifyJson({ ip_address: audit.ip_address, user_agent: ua });
  await db.prepare(`INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), org.id, 'policy.acknowledged', 'Acknowledgment', ackId, user.email, user.full_name,
    `${targetEmp.full_name} acknowledged policy "${policy.title}" v${policy.current_version}`, meta,
    audit.ip_address, audit.device_id, audit.app_source, null, null
  );

  sendAcknowledgmentConfirmation({ to: targetEmp.user_email, policyTitle: policy.title }).catch(err => console.error('Ack confirmation email failed:', err));
  res.json({ data: { success: true, acknowledgment: { id: ackId } } });
});

// Entity write (generic - policies, handbooks, onboarding, etc.)
router.post('/entity-write', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { action, entity_type, organization_id, entity_id, data } = req.body;
  if (!action || !entity_type || !organization_id) return res.status(400).json({ error: 'action, entity_type, organization_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  if (!canAccessEntityWrite(employee, entity_type) && ['Policy', 'Handbook', 'Onboarding', 'Location', 'PolicyTargetingOverride', 'HRRecord'].includes(entity_type)) {
    return res.status(403).json({ error: 'Insufficient permission for this action' });
  }
  if (entity_type === 'IncidentReport' && action === 'create' && !hasCapability(employee, 'manage_incidents')) {
    const empId = data?.employee_id;
    if (empId !== employee.id) return res.status(403).json({ error: 'Employees may only create incident reports for themselves' });
  }

  const safeData = { ...data, organization_id: org.id };

  // Helper: create amendment record for HR/Incident changes
  async function createAmendment(recordId, recordType, fieldChanged, oldVal, newVal, amendmentNote = '') {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    await db.prepare(`INSERT INTO amendments (id, organization_id, record_id, record_type, field_changed, old_value, new_value, amended_by_email, amendment_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), org.id, recordId, recordType, fieldChanged, String(oldVal ?? ''), String(newVal ?? ''), user?.email || '', amendmentNote || '', sqlNow()
    );
  }

  if (action === 'create') {
    const id = uuidv4();
    if (entity_type === 'Policy') {
      await db.prepare(`INSERT INTO policies (id, organization_id, title, description, status, current_version, draft_content, applies_to, acknowledgment_required, handbook_category, handbook_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.title || '', safeData.description || '', safeData.status || 'draft', safeData.current_version || 0,
        safeData.draft_content || '', stringifyJson(safeData.applies_to), safeData.acknowledgment_required ? 1 : 0, safeData.handbook_category || 'Other', safeData.handbook_id || null
      );
    } else if (entity_type === 'Handbook') {
      await db.prepare(`INSERT INTO handbooks (id, organization_id, name, description, status, policy_sections, source, created_by_email, created_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.name || '', safeData.description || '', safeData.status || 'draft', stringifyJson(safeData.policy_sections), safeData.source || '', safeData.created_by_email || '', safeData.created_by_name || ''
      );
    } else if (entity_type === 'Onboarding') {
      const settings = parseJson(org.settings) || {};
      const windowDays = Math.min(Math.max(Number(settings.default_ack_window_new_days) || PLATFORM_DEFAULT_ACK_WINDOW_NEW_DAYS, 1), 90);
      const dueDate = safeData.due_date || (() => { const d = new Date(); d.setDate(d.getDate() + windowDays); return d.toISOString().split('T')[0]; })();
      await db.prepare(`INSERT INTO onboardings (id, organization_id, employee_id, employee_name, employee_email, assigned_policy_ids, completed_policy_ids, due_date, start_date, status, reminder_sent_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.employee_id, safeData.employee_name || '', safeData.employee_email || '', stringifyJson(safeData.assigned_policy_ids || []), stringifyJson(safeData.completed_policy_ids || []),
        dueDate, safeData.start_date || null, safeData.status || 'not_started', 0
      );
    } else if (entity_type === 'Location') {
      await db.prepare('INSERT INTO locations (id, organization_id, name, address) VALUES (?, ?, ?, ?)').run(id, org.id, safeData.name || '', safeData.address || '');
    } else if (entity_type === 'PolicyTargetingOverride') {
      if (!(await validateLocationId(org.id, safeData.location_id))) return res.status(400).json({ error: 'Invalid location_id' });
      await db.prepare(`INSERT INTO policy_targeting_overrides (id, organization_id, policy_id, override_type, employee_id, role, location_id, applies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.policy_id, safeData.override_type, safeData.employee_id || null, safeData.role || null, safeData.location_id || null, safeData.applies ? 1 : 0
      );
    } else if (entity_type === 'HRRecord') {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      let recordType = (safeData.record_type || 'write_up').toLowerCase().trim();
      if (!HR_RECORD_TYPES.has(recordType)) recordType = 'written_warning';
      if (recordType === 'write_up') recordType = 'written_warning';
      // TRUTH #159: immediate_termination is immutable from creation
      const isLocked = recordType === 'immediate_termination' ? 1 : 0;
      // TRUTH #159: commendation visibility toggle — default visible (1); only applies to commendation
      const visibleToEmployee = recordType === 'commendation' ? (safeData.visible_to_employee !== false ? 1 : 0) : 1;
      await db.prepare(`INSERT INTO hr_records (id, organization_id, employee_id, record_type, title, description, status, is_locked, severity, discipline_level, created_by_email, visible_to_employee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.employee_id, recordType, safeData.title || '', safeData.description || '', safeData.status || 'submitted', isLocked,
        safeData.severity ?? null, safeData.discipline_level ?? null, user?.email || '', visibleToEmployee
      );
    } else if (entity_type === 'IncidentReport') {
      await db.prepare(`INSERT INTO incident_reports (id, organization_id, employee_id, title, description, status, created_by_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, org.id, safeData.employee_id, safeData.title || '', safeData.description || '', safeData.status || 'submitted', req.user?.email || ''
      );
    }
    return res.json({ data: { success: true, record: { id, ...safeData } } });
  }

  if (action === 'amend') {
    if (!entity_id) return res.status(400).json({ error: 'entity_id required for amend' });
    const { field_changed, old_value, new_value, amendment_note } = req.body;
    if (!field_changed || new_value === undefined) return res.status(400).json({ error: 'field_changed and new_value required' });
    if (entity_type !== 'HRRecord') return res.status(400).json({ error: 'amend only for HRRecord' });
    const row = await db.prepare('SELECT * FROM hr_records WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(entity_id, org.id);
    if (!row) return res.status(404).json({ error: 'Record not found' });
    if (row.is_locked) return res.status(403).json({ error: 'Record is locked' });
    if (!hasCapability(employee, 'manage_hr_records')) return res.status(403).json({ error: 'Insufficient permission' });
    let col = ['title', 'description', 'status'].includes(field_changed) ? field_changed : null;
    // TRUTH #159: allow toggling visible_to_employee on commendations only
    if (field_changed === 'visible_to_employee' && row.record_type === 'commendation') col = 'visible_to_employee';
    if (!col) return res.status(400).json({ error: 'Invalid field' });
    const normalizedNew = col === 'visible_to_employee' ? (new_value === true || new_value === 1 || new_value === '1' ? 1 : 0) : new_value;
    const normalizedOld = col === 'visible_to_employee' ? (row.visible_to_employee ?? 1) : (old_value ?? row[col]);
    await createAmendment(entity_id, 'HRRecord', col, normalizedOld, normalizedNew, amendment_note || '');
    await db.prepare(`UPDATE hr_records SET ${col}=?, updated_at=? WHERE id=? AND organization_id=?`).run(normalizedNew, sqlNow(), entity_id, org.id);
    return res.json({ data: { success: true } });
  }

  if (action === 'update') {
    if (!entity_id) return res.status(400).json({ error: 'entity_id required for update' });
    if (entity_type === 'HRRecord' || entity_type === 'IncidentReport') {
      const table = entity_type === 'HRRecord' ? 'hr_records' : 'incident_reports';
      const recordType = entity_type === 'HRRecord' ? 'HRRecord' : 'IncidentReport';
      const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`).get(entity_id, org.id);
      if (!row) return res.status(404).json({ error: 'Record not found' });
      if (row.is_locked) return res.status(403).json({ error: 'Record is locked' });
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (safeData.title !== undefined && safeData.title !== row.title) {
        await createAmendment(entity_id, recordType, 'title', row.title, safeData.title, safeData.amendment_note);
      }
      if (safeData.description !== undefined && safeData.description !== row.description) {
        await createAmendment(entity_id, recordType, 'description', row.description, safeData.description, safeData.amendment_note);
      }
      if (safeData.status !== undefined && safeData.status !== row.status) {
        await createAmendment(entity_id, recordType, 'status', row.status, safeData.status, safeData.amendment_note);
      }
      await db.prepare(`UPDATE ${table} SET title=?, description=?, status=?, updated_at=? WHERE id=? AND organization_id=?`).run(
        safeData.title ?? row.title, safeData.description ?? row.description, safeData.status ?? row.status, sqlNow(), entity_id, org.id
      );
      return res.json({ data: { success: true } });
    }
    if (entity_type === 'Policy') {
      await db.prepare(`UPDATE policies SET title=?, description=?, status=?, draft_content=?, applies_to=?, acknowledgment_required=?, handbook_category=?, updated_at=? WHERE id=? AND organization_id=?`).run(
        safeData.title, safeData.description, safeData.status, safeData.draft_content, stringifyJson(safeData.applies_to), safeData.acknowledgment_required ? 1 : 0, safeData.handbook_category, sqlNow(), entity_id, org.id
      );
      // TRUTH #155: Audit log starts at draft
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const policy = await db.prepare('SELECT title FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(entity_id, org.id);
      const audit = getAuditContext(req);
      await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), org.id, 'policy.draft_updated', 'Policy', entity_id, user?.email || '', user?.full_name || '',
        `Draft updated: "${policy?.title || entity_id}"`,
        stringifyJson({ field: 'draft_content', content_length: (safeData.draft_content || '').length }),
        audit.ip_address, audit.device_id, audit.app_source, null, null
      );
    } else if (entity_type === 'Onboarding') {
      await db.prepare(`UPDATE onboardings SET completed_policy_ids=?, status=?, completed_date=? WHERE id=? AND organization_id=? AND deleted_at IS NULL`).run(
        stringifyJson(safeData.completed_policy_ids), safeData.status, safeData.completed_date, entity_id, org.id
      );
    }
    return res.json({ data: { success: true } });
  }

  if (action === 'delete') {
    if (!entity_id) return res.status(400).json({ error: 'entity_id required for delete' });
    if (entity_type === 'Handbook') {
      await db.prepare('UPDATE handbooks SET deleted_at = ? WHERE id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), entity_id, org.id);
    } else if (entity_type === 'Location') {
      await db.prepare('UPDATE locations SET deleted_at = ? WHERE id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), entity_id, org.id);
    } else if (entity_type === 'PolicyTargetingOverride') {
      await db.prepare('UPDATE policy_targeting_overrides SET deleted_at = ? WHERE id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), entity_id, org.id);
    }
    return res.json({ data: { success: true } });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// Employee write
router.post('/employee-write', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_employees')) return res.status(403).json({ error: 'Insufficient permission' });
  const { action, organization_id, employee_id, entity_id: entityId, data } = req.body;
  const empId = employee_id || entityId;
  if (!action || !organization_id) return res.status(400).json({ error: 'action, organization_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const safeData = { ...data, organization_id: org.id };

  if (action === 'create') {
    if (!(await validateLocationId(org.id, safeData.location_id))) return res.status(400).json({ error: 'Invalid location_id' });
    const id = uuidv4();
    const pl = safeData.permission_level || 'employee';
    const caps = pl === 'manager' && Array.isArray(safeData.capabilities) ? safeData.capabilities : [];
    await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, department, location_id, permission_level, status, hire_date, capabilities)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, org.id, safeData.user_email || '', safeData.full_name || '', safeData.role || '', safeData.department || '', safeData.location_id || null,
      pl, safeData.status || 'active', safeData.hire_date || null, stringifyJson(caps)
    );
    // Create user account if email provided and not exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(safeData.user_email);
    if (safeData.user_email && !existingUser) {
      const tempPassword = uuidv4().slice(0, 12);
      await db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
        uuidv4(), safeData.user_email, hashPassword(tempPassword), safeData.full_name || ''
      );
      // In production: send email with temp password or magic link
    }
    const record = await db.prepare('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL').get(id);
    return res.json({ data: record });
  }

  if (action === 'update') {
    if (!empId) return res.status(400).json({ error: 'employee_id required' });
    if (!(await validateLocationId(org.id, safeData.location_id))) return res.status(400).json({ error: 'Invalid location_id' });
    const pl = safeData.permission_level;
    const caps = pl === 'manager' && Array.isArray(safeData.capabilities) ? safeData.capabilities : [];
    await db.prepare(`UPDATE employees SET full_name=?, role=?, department=?, location_id=?, permission_level=?, hire_date=?, capabilities=? WHERE id=? AND organization_id=?`).run(
      safeData.full_name, safeData.role, safeData.department, safeData.location_id, safeData.permission_level, safeData.hire_date, stringifyJson(caps), empId, org.id
    );
    return res.json({ data: { success: true } });
  }

  if (action === 'delete') {
    if (!empId) return res.status(400).json({ error: 'entity_id required' });
    await db.prepare("UPDATE employees SET status=?, deleted_at=? WHERE id=? AND organization_id=?").run('inactive', sqlNow(), empId, org.id);
    return res.json({ data: { success: true } });
  }

  // TRUTH #164: Explicit termination — access revoked, file preserved; re-hire uses same employee_id
  if (action === 'terminate') {
    if (!empId) return res.status(400).json({ error: 'employee_id required' });
    const target = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(empId, org.id);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    await db.prepare('UPDATE employees SET status=? WHERE id=? AND organization_id=?').run('inactive', empId, org.id);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const audit = getAuditContext(req);
    await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), org.id, 'employee.terminated', 'Employee', empId, user?.email || '', user?.full_name || '',
      `Terminated ${target.full_name || target.user_email}. File preserved; re-hire carries forward same record.`,
      null, audit.ip_address, audit.device_id, audit.app_source, null, null
    );
    return res.json({ data: { success: true } });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// Publish policy
router.post('/publish-policy', requireCapability('manage_policies'), async (req, res) => {
  const { org, employee } = req.orgContext;
  const { policy_id, organization_id } = req.body;
  if (!policy_id || !organization_id) return res.status(400).json({ error: 'policy_id, organization_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  const newVersion = (policy.current_version || 0) + 1;
  const versionId = uuidv4();
  await db.prepare('INSERT INTO policy_versions (id, policy_id, version_number, content, is_locked, effective_date) VALUES (?, ?, ?, ?, 1, ?)').run(
    versionId, policy_id, newVersion, policy.draft_content || '', new Date().toISOString().split('T')[0]
  );
  await db.prepare('UPDATE policies SET status=?, current_version=?, updated_at=? WHERE id=?').run('active', newVersion, sqlNow(), policy_id);

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const audit = getAuditContext(req);
  await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    uuidv4(), org.id, 'policy.published', 'Policy', policy_id, user.email, user.full_name, `Published "${policy.title}" v${newVersion}`,
    null, audit.ip_address, audit.device_id, audit.app_source, null, stringifyJson({ version: newVersion, title: policy.title })
  );
  void logAudit({
    organizationId: org.id,
    actorEmail: user?.email,
    actorId: req.user?.id,
    action: 'policy.published',
    entityType: 'Policy',
    entityId: policy_id,
    newData: { version: newVersion, title: policy.title },
    req,
  });

  // Create PendingReAcknowledgment for employees who previously acknowledged
  const overrides = await db.prepare('SELECT * FROM policy_targeting_overrides WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const prevAcks = await db.prepare('SELECT DISTINCT employee_id FROM acknowledgments WHERE policy_id = ? AND organization_id = ? AND deleted_at IS NULL').all(policy_id, org.id);
  for (const a of prevAcks) {
    const emp = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ? AND status = ? AND deleted_at IS NULL').get(a.employee_id, org.id, 'active');
    if (!emp) continue;
    const applies = (() => {
      const empOverride = overrides.find(o => o.policy_id === policy_id && o.override_type === 'employee' && o.employee_id === emp.id);
      if (empOverride) return !!empOverride.applies;
      const roleOverride = overrides.find(o => o.policy_id === policy_id && o.override_type === 'role' && o.role === emp.role);
      if (roleOverride) return !!roleOverride.applies;
      const locOverride = overrides.find(o => o.policy_id === policy_id && o.override_type === 'location' && o.location_id === emp.location_id);
      if (locOverride) return !!locOverride.applies;
      const at = parseJson(policy.applies_to);
      if (!at) return true;
      if (at.all_employees) return true;
      const hasCriteria = (at.roles?.length || at.departments?.length || at.locations?.length || at.tags?.length);
      if (!hasCriteria) return true;
      if (at.roles?.length && emp.role && at.roles.includes(emp.role)) return true;
      if (at.departments?.length && emp.department && at.departments.includes(emp.department)) return true;
      if (at.locations?.length && emp.location_id && at.locations.includes(emp.location_id)) return true;
      const tags = parseJson(emp.tags);
      if (at.tags?.length && tags?.some(t => at.tags.includes(t))) return true;
      return false;
    })();
    if (applies) {
      const settings = parseJson(org.settings) || {};
      const windowDays = Math.min(Math.max(Number(settings.default_ack_window_update_days) || PLATFORM_DEFAULT_ACK_WINDOW_UPDATE_DAYS, 1), 90);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + windowDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      await db.prepare('UPDATE pending_re_acknowledgments SET deleted_at = ? WHERE organization_id=? AND policy_id=? AND employee_id=? AND deleted_at IS NULL').run(sqlNow(), org.id, policy_id, emp.id);
      await db.prepare('INSERT INTO pending_re_acknowledgments (id, organization_id, policy_id, employee_id, version_number, previous_version_number, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), org.id, policy_id, emp.id, newVersion, policy.current_version || 0, dueDateStr
      );
    }
  }

  res.json({ data: { success: true, version: newVersion } });
});

// Get handbook data
router.post('/handbook-data', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, action, handbook_id, policy_id, version_number } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  if (action === 'list_handbooks') {
    const handbooks = await db.prepare('SELECT * FROM handbooks WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
    return res.json({ data: { handbooks } });
  }
  if (action === 'get_policy_version' && policy_id && version_number != null) {
    const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    const version = await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND version_number = ? AND deleted_at IS NULL').get(policy_id, version_number);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    return res.json({ data: { version } });
  }
  if (action === 'get_handbook_version' && handbook_id) {
    const handbook = await db.prepare('SELECT * FROM handbooks WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(handbook_id, org.id);
    if (!handbook) return res.status(404).json({ error: 'Handbook not found' });
    return res.json({ data: { version: { content: handbook.source || '' } } });
  }
  if (action === 'get' && handbook_id) {
    const handbook = await db.prepare('SELECT * FROM handbooks WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(handbook_id, org.id);
    if (!handbook) return res.status(404).json({ error: 'Handbook not found' });
    const sections = parseJson(handbook.policy_sections) || [];
    const policyIds = sections.flatMap(s => s.policy_ids || []);
    const policies = policyIds.length ? await db.prepare(`SELECT * FROM policies WHERE id IN (${policyIds.map(() => '?').join(',')}) AND deleted_at IS NULL`).all(...policyIds) : [];
    const versions = {};
    for (const p of policies) {
      if (p.current_version > 0) {
        const v = await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND version_number = ? AND deleted_at IS NULL').get(p.id, p.current_version);
        if (v) versions[p.id] = v;
      }
    }
    return res.json({ data: { handbook, sections, policies, versions } });
  }
  res.status(400).json({ error: 'Invalid action' });
});

// Get my onboarding
router.post('/my-onboarding', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id } = req.body;
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const onboarding = await db.prepare('SELECT * FROM onboardings WHERE organization_id = ? AND employee_id = ? AND status != ? AND deleted_at IS NULL').get(org.id, employee.id, 'completed');
  if (!onboarding) return res.json({ data: { onboarding: null, policies: [] } });

  const policyIds = parseJson(onboarding.assigned_policy_ids) || [];
  const policies = policyIds.length ? await db.prepare(`SELECT * FROM policies WHERE id IN (${policyIds.map(() => '?').join(',')}) AND deleted_at IS NULL`).all(...policyIds) : [];
  const versions = {};
  for (const p of policies) {
    if (p.current_version > 0) {
      const v = await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND version_number = ? AND deleted_at IS NULL').get(p.id, p.current_version);
      if (v) versions[p.id] = v;
    }
  }
  const policiesWithVersion = policies.map(p => ({ ...p, currentVersion: versions[p.id] }));

  const pendingReAcks = await db.prepare('SELECT * FROM pending_re_acknowledgments WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee.id);

  res.json({ data: { onboarding, policies: policiesWithVersion, pending_re_acknowledgments: pendingReAcks } });
});

// Get my acknowledgments
router.post('/my-acknowledgments', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const acks = await db.prepare('SELECT * FROM acknowledgments WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee.id);
  const pendingReAcks = await db.prepare('SELECT * FROM pending_re_acknowledgments WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee.id);
  res.json({ data: { acknowledgments: acks, pending_re_acknowledgments: pendingReAcks } });
});

// Get policy for employee (single policy view)
router.post('/policy-for-employee', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, policy_id } = req.body;
  if (!organization_id || !policy_id) return res.status(400).json({ error: 'organization_id, policy_id required' });
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  if (policy.status !== 'active') return res.status(403).json({ error: 'Policy not active' });

  const version = policy.current_version > 0
    ? await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND version_number = ? AND deleted_at IS NULL').get(policy_id, policy.current_version)
    : null;

  // Include acknowledgment status for this employee
  const latestAck = await db.prepare('SELECT * FROM acknowledgments WHERE organization_id = ? AND policy_id = ? AND employee_id = ? AND deleted_at IS NULL ORDER BY acknowledged_at DESC LIMIT 1').get(org.id, policy_id, employee.id);
  const pendingReAck = await db.prepare('SELECT * FROM pending_re_acknowledgments WHERE organization_id = ? AND policy_id = ? AND employee_id = ? AND deleted_at IS NULL LIMIT 1').get(org.id, policy_id, employee.id);

  res.json({ data: { policy: { ...policy, currentVersion: version }, acknowledgment: latestAck || null, pending_re_acknowledgment: pendingReAck || null } });
});

// Get activity log (supports skip, search, event_type_prefix)
router.post('/activity-log', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'view_activity_log')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id, limit = 50, skip = 0, search, event_type_prefix } = req.body;
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const cappedSkip = Math.max(0, Number(skip) || 0);

  let query = 'SELECT * FROM system_events WHERE organization_id = ? AND deleted_at IS NULL';
  const args = [org.id];
  if (event_type_prefix && typeof event_type_prefix === 'string' && event_type_prefix.trim()) {
    query += ' AND event_type LIKE ?';
    args.push(event_type_prefix.trim() + '%');
  }
  if (search && typeof search === 'string' && search.trim()) {
    query += ' AND (summary LIKE ? OR metadata LIKE ?)';
    const term = '%' + search.trim() + '%';
    args.push(term, term);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(cappedLimit, cappedSkip);

  const rows = await db.prepare(query).all(...args);
  const events = rows.map((e) => ({ ...e, created_date: e.created_at }));
  res.json({ data: { events } });
});

// Get acknowledgment matrix
router.post('/acknowledgement-matrix', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'view_acknowledgments')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id } = req.body;
  if (organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const employees = await db.prepare('SELECT * FROM employees WHERE organization_id = ? AND status = ? AND deleted_at IS NULL').all(org.id, 'active');
  const policies = await db.prepare('SELECT * FROM policies WHERE organization_id = ? AND status = ? AND deleted_at IS NULL').all(org.id, 'active');
  const acks = await db.prepare('SELECT * FROM acknowledgments WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const matrix = employees.map(emp => ({
    employee: emp,
    policies: policies.map(p => ({
      policy: p,
      acknowledged: acks.some(a => a.employee_id === emp.id && a.policy_id === p.id)
    }))
  }));
  res.json({ data: { matrix } });
});

// Create invite (admin only)
router.post('/invites/create', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'invites')) return res.status(403).json({ error: 'Insufficient permission' });
  const { email, full_name, role, location_id, organization_id } = req.body;
  if (organization_id && organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email required' });
  const emailTrim = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) return res.status(400).json({ error: 'Invalid email format' });

  const existingEmp = await db.prepare('SELECT id FROM employees WHERE organization_id = ? AND user_email = ? AND deleted_at IS NULL').get(org.id, emailTrim);
  if (existingEmp) return res.status(400).json({ error: 'Employee with this email already exists' });

  const existingInvite = await db.prepare('SELECT id FROM invites WHERE organization_id = ? AND email = ? AND used_at IS NULL AND expires_at > ? AND deleted_at IS NULL').get(
    org.id, emailTrim, new Date().toISOString()
  );
  if (existingInvite) return res.status(400).json({ error: 'Active invite already exists for this email' });
  if (!(await validateLocationId(org.id, location_id))) return res.status(400).json({ error: 'Invalid location_id' });

  const id = uuidv4();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  await db.prepare(`INSERT INTO invites (id, organization_id, email, token, expires_at, created_by_email, full_name, role, location_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, org.id, emailTrim, token, expiresAt, user?.email || '', (full_name || '').trim().slice(0, 200),
    (role || '').trim().slice(0, 100), location_id || null
  );

  const baseUrl = publicFrontendBase(req);
  const inviteLink = `${baseUrl}/InviteAccept?token=${token}`;

  res.json({
    data: {
      id,
      token,
      invite_link: inviteLink,
      email: emailTrim,
      expires_at: expiresAt,
    },
  });
});

// List invites (admin only)
router.post('/invites/list', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'invites')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  const invites = await db.prepare('SELECT id, email, full_name, role, expires_at, used_at, created_at FROM invites WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').all(org.id);
  res.json({ data: invites });
});

// Send onboarding reminder — TRUTH #158: email reminder for policies due
router.post('/send-onboarding-reminder', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_onboarding')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id, onboarding_id } = req.body;
  if (!organization_id || !onboarding_id) return res.status(400).json({ error: 'organization_id, onboarding_id required' });
  const onboarding = await db.prepare('SELECT * FROM onboardings WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(onboarding_id, org.id);
  if (!onboarding) return res.status(404).json({ error: 'Onboarding not found' });
  await db.prepare('UPDATE onboardings SET reminder_sent_count = reminder_sent_count + 1, last_reminder_date = ? WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').run(sqlNow(), onboarding_id, org.id);
  const assigned = parseJson(onboarding.assigned_policy_ids) || [];
  const completed = parseJson(onboarding.completed_policy_ids) || [];
  const pendingIds = assigned.filter(id => !completed.includes(id));
  const policyTitles = pendingIds.length
    ? (await db.prepare('SELECT id, title FROM policies WHERE id IN (' + pendingIds.map(() => '?').join(',') + ') AND deleted_at IS NULL').all(...pendingIds)).map(p => p.title)
    : ['Your assigned policies'];
  try {
    await sendAcknowledgmentReminder({
      to: onboarding.employee_email,
      policyTitles,
      dueDate: onboarding.due_date || null,
    });
  } catch (err) {
    console.error('Onboarding reminder email failed:', err);
  }
  res.json({ data: { success: true } });
});

// Org write (locations, settings)
router.post('/org-write', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_org_settings')) return res.status(403).json({ error: 'Insufficient permission' });
  const { action, entity_type, organization_id, entity_id, data } = req.body;
  if (!action || !organization_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });

  if (action === 'update' && entity_type === 'Organization') {
    // TRUTH #157: settings may include default_ack_window_new_days, default_ack_window_update_days; employee_count for compliance
    const employeeCount = data.employee_count != null ? (parseInt(data.employee_count, 10) || null) : null;
    await db.prepare('UPDATE organizations SET name=?, industry=?, settings=?, state=?, employee_count=? WHERE id=?').run(
      data.name, data.industry, stringifyJson(data.settings), data.state ?? null, employeeCount, org.id
    );
    return res.json({ data: { success: true } });
  }
  if (action === 'create' && entity_type === 'Location') {
    const id = uuidv4();
    await db.prepare('INSERT INTO locations (id, organization_id, name, address) VALUES (?, ?, ?, ?)').run(id, org.id, data.name || '', data.address || '');
    return res.json({ data: { record: { id } } });
  }
  if (action === 'delete' && entity_type === 'Location') {
    await db.prepare('UPDATE locations SET deleted_at = ? WHERE id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), entity_id, org.id);
    return res.json({ data: { success: true } });
  }
  if (action === 'create' && entity_type === 'PolicyTargetingOverride') {
    if (!(await validateLocationId(org.id, data.location_id))) return res.status(400).json({ error: 'Invalid location_id' });
    const id = uuidv4();
    await db.prepare('INSERT INTO policy_targeting_overrides (id, organization_id, policy_id, override_type, employee_id, role, location_id, applies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, org.id, data.policy_id, data.override_type, data.employee_id || null, data.role || null, data.location_id || null, data.applies ? 1 : 0
    );
    return res.json({ data: { success: true } });
  }
  if (action === 'delete' && entity_type === 'PolicyTargetingOverride') {
    await db.prepare('UPDATE policy_targeting_overrides SET deleted_at = ? WHERE id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), entity_id, org.id);
    return res.json({ data: { success: true } });
  }
  res.status(400).json({ error: 'Invalid action' });
});

// Manage policy lifecycle (archive)
router.post('/manage-policy-lifecycle', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id, policy_id, action } = req.body;
  if (!organization_id || !policy_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  if (action === 'archive') {
    await db.prepare('UPDATE policies SET status=? WHERE id=? AND organization_id=?').run('archived', policy_id, org.id);
    await db.prepare('UPDATE pending_re_acknowledgments SET deleted_at = ? WHERE policy_id=? AND organization_id=? AND deleted_at IS NULL').run(sqlNow(), policy_id, org.id);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND deleted_at IS NULL').get(policy_id);
    const audit = getAuditContext(req);
    await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), org.id, 'policy.archived', 'Policy', policy_id, user.email, user.full_name, `Archived "${policy?.title}"`,
      null, audit.ip_address, audit.device_id, audit.app_source, stringifyJson({ title: policy?.title, status: 'active' }), stringifyJson({ status: 'archived' })
    );
    return res.json({ data: { success: true } });
  }
  res.status(400).json({ error: 'Invalid action' });
});

// HR Records (admin: all or by employee_id; non-admin: own only)
router.post('/hr-records', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, employee_id, record_type } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  let records = [];
  if (hasCapability(employee, 'view_hr_records')) {
    if (employee_id) {
      const targetEmp = await db.prepare('SELECT id FROM employees WHERE id = ? AND organization_id = ?').get(employee_id, org.id);
      if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });
      records = await db.prepare('SELECT * FROM hr_records WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee_id);
    } else {
      records = await db.prepare('SELECT * FROM hr_records WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
    }
  } else {
    records = await db.prepare('SELECT * FROM hr_records WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee.id);
    // TRUTH #159: internal_note is never shown to the employee
    records = records.filter(r => r.record_type !== 'internal_note');
    // TRUTH #159: commendations with visible_to_employee = 0 are hidden from employee
    records = records.filter(r => !(r.record_type === 'commendation' && (r.visible_to_employee === 0 || r.visible_to_employee === false)));
  }
  res.json({ data: { records } });
});

router.post('/incident-reports', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  // TRUTH #160: Subject of incident report never sees it. Only users with view_incidents see incident reports; employees get empty list. Subject is never shown their own report.
  let reports = hasCapability(employee, 'view_incidents')
    ? await db.prepare('SELECT * FROM incident_reports WHERE organization_id = ? AND deleted_at IS NULL').all(org.id)
    : [];
  reports = reports.filter(r => r.employee_id !== employee.id);
  const incidentIds = reports.map(r => r.id);
  let amendments_incident = [];
  if (incidentIds.length > 0) {
    const placeholders = incidentIds.map(() => '?').join(',');
    amendments_incident = await db.prepare(`SELECT * FROM amendments WHERE organization_id = ? AND record_type = ? AND record_id IN (${placeholders})`).all(org.id, 'IncidentReport', ...incidentIds);
    const enrichAmendment = async a => {
      const u = a.amended_by_email ? await db.prepare('SELECT full_name FROM users WHERE email = ?').get(a.amended_by_email) : null;
      return { ...a, created_date: a.created_at, amended_by_name: u?.full_name || a.amended_by_email || 'Unknown' };
    };
    amendments_incident = await Promise.all(amendments_incident.map(enrichAmendment));
  }
  res.json({ data: { reports, incidents: reports, amendments_incident } });
});

// Secure incident write (create, update_notes, update_attachments)
router.post('/secure-incident-write', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { action, organization_id, form, incident_id, field, old_value, new_value, amendment_note, attachments } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });

  if (action === 'create') {
    if (!(await validateLocationId(org.id, form?.location_id))) return res.status(400).json({ error: 'Invalid location_id' });
    const id = uuidv4();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    await db.prepare(`INSERT INTO incident_reports (id, organization_id, employee_id, title, description, status, incident_type, incident_date, location_id, severity, witnesses, attachments, created_by_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, org.id, employee.id, form?.title || '', form?.description || '', 'submitted',
      form?.incident_type || 'workplace_complaint', form?.incident_date || null, form?.location_id || null,
      form?.severity || 'medium', form?.witnesses || '', stringifyJson(form?.attachments || []), user?.email || ''
    );
    return res.json({ data: { success: true, record: { id } } });
  }

  if (action === 'update_notes' || action === 'update_attachments') {
    if (!incident_id) return res.status(400).json({ error: 'incident_id required' });
    const row = await db.prepare('SELECT * FROM incident_reports WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(incident_id, org.id);
    if (!row) return res.status(404).json({ error: 'Incident not found' });
    if (row.is_locked) return res.status(403).json({ error: 'Incident is locked' });
    // TRUTH #160: Subject of incident report never sees it and never gets to update it. Only admin or manage_incidents can update.
    if (row.employee_id === employee.id) return res.status(403).json({ error: 'Forbidden' });
    if (!hasCapability(employee, 'manage_incidents') && !isAdmin(employee)) return res.status(403).json({ error: 'Forbidden' });

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (action === 'update_notes') {
      const col = field === 'admin_notes' ? 'admin_notes' : field;
      if (!['admin_notes', 'description', 'title'].includes(col)) return res.status(400).json({ error: 'Invalid field' });
      const oldVal = row[col] ?? '';
      if (String(new_value) !== String(oldVal)) {
        await db.prepare(`INSERT INTO amendments (id, organization_id, record_id, record_type, field_changed, old_value, new_value, amended_by_email, amendment_note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), org.id, incident_id, 'IncidentReport', col, oldVal, new_value, user?.email || '', amendment_note || '', sqlNow()
        );
      }
      await db.prepare(`UPDATE incident_reports SET ${col}=?, updated_at=? WHERE id=? AND organization_id=?`).run(new_value, sqlNow(), incident_id, org.id);
    } else {
      const oldAtts = parseJson(row.attachments) || [];
      if (JSON.stringify(attachments) !== JSON.stringify(oldAtts)) {
        await db.prepare(`INSERT INTO amendments (id, organization_id, record_id, record_type, field_changed, old_value, new_value, amended_by_email, amendment_note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), org.id, incident_id, 'IncidentReport', 'attachments', stringifyJson(oldAtts), stringifyJson(attachments || []), user?.email || '', '', sqlNow()
        );
      }
      await db.prepare(`UPDATE incident_reports SET attachments=?, updated_at=? WHERE id=? AND organization_id=?`).run(stringifyJson(attachments || []), sqlNow(), incident_id, org.id);
    }
    return res.json({ data: { success: true } });
  }

  return res.status(400).json({ error: 'Invalid action' });
});

// Get locations
router.post('/locations', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(403).json({ error: 'Org mismatch' });
  const locations = await db.prepare('SELECT * FROM locations WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  res.json({ data: locations });
});

// Get single policy
router.post('/policy', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, policy_id } = req.body;
  if (!organization_id || !policy_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
  res.json({ data: policy || null });
});

// Get policy versions
router.post('/policy-versions', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { policy_id } = req.body;
  if (!policy_id) return res.status(400).json({ error: 'policy_id required' });
  const policy = await db.prepare('SELECT * FROM policies WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(policy_id, org.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  const versions = await db.prepare('SELECT * FROM policy_versions WHERE policy_id = ? AND deleted_at IS NULL ORDER BY version_number DESC').all(policy_id);
  res.json({ data: versions });
});

// Manage HR record lifecycle (status change)
router.post('/manage-hr-lifecycle', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_hr_records')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id, record_id, record_type, new_status, action, status } = req.body;
  const targetStatus = new_status || status;
  if (!organization_id || !record_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const table = (record_type || '').toLowerCase() === 'incidentreport' ? 'incident_reports' : 'hr_records';
  const recType = table === 'incident_reports' ? 'IncidentReport' : 'HRRecord';
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`).get(record_id, org.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  if (row.is_locked) return res.status(403).json({ error: 'Record is locked' });
  const newStatus = targetStatus || row.status;
  if (newStatus !== row.status) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    await db.prepare(`INSERT INTO amendments (id, organization_id, record_id, record_type, field_changed, old_value, new_value, amended_by_email, amendment_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), org.id, record_id, recType, 'status', row.status, newStatus, user?.email || '', '', sqlNow()
    );
  }
  const isLocked = ['resolved', 'dismissed'].includes(newStatus) ? 1 : 0;
  await db.prepare(`UPDATE ${table} SET status=?, is_locked=?, updated_at=? WHERE id=? AND organization_id=?`).run(newStatus, isLocked, sqlNow(), record_id, org.id);
  res.json({ data: { success: true } });
});

// Acknowledge HR record (employee acknowledges receipt of write-up)
router.post('/acknowledge-hr-record', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, record_id, record_type } = req.body;
  if (!organization_id || !record_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const recType = (record_type || 'hr_record').toLowerCase().replace(/-/g, '_');
  const table = recType === 'incident_report' ? 'incident_reports' : 'hr_records';
  const record = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`).get(record_id, org.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.employee_id !== employee.id) return res.status(403).json({ error: 'You can only acknowledge your own records' });
  if (record.is_locked) return res.status(400).json({ error: 'Record is locked' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ackEmail = user?.email ?? employee.user_email ?? '';
  const now = new Date().toISOString();
  try {
    const cols = await db.prepare(`PRAGMA table_info(${table})`).all();
    const hasAckAt = cols.some(c => c.name === 'acknowledged_at');
    const hasAckBy = cols.some(c => c.name === 'acknowledged_by_email');
    if (hasAckAt && hasAckBy) {
      await db.prepare(`UPDATE ${table} SET acknowledged_at = ?, acknowledged_by_email = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).run(now, ackEmail, sqlNow(), record_id, org.id);
    }
  } catch (_) { /* schema may not have columns yet */ }
  res.json({ data: { success: true } });
});

// System events (actor always from server - never trust client-supplied actor_email/actor_name)
router.post('/system-event', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, event_type, entity_type, entity_id, summary, metadata } = req.body;
  if (!organization_id || !event_type || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const actorEmail = user?.email ?? employee.user_email ?? '';
  const actorName = user?.full_name ?? employee.full_name ?? '';
  const id = uuidv4();
  const audit = getAuditContext(req);
  await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, org.id, event_type, entity_type || null, entity_id || null, actorEmail, actorName, summary || '', stringifyJson(metadata || {}),
    audit.ip_address, audit.device_id, audit.app_source, null, null
  );
  res.json({ data: { id } });
});

router.post('/system-events', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, entity_id, event_type, limit = 200 } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
  let query = 'SELECT * FROM system_events WHERE organization_id = ? AND deleted_at IS NULL';
  const args = [org.id];
  if (entity_id) { query += ' AND entity_id = ?'; args.push(entity_id); }
  if (event_type) { query += ' AND event_type = ?'; args.push(event_type); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  args.push(cappedLimit);
  const events = await db.prepare(query).all(...args);
  res.json({ data: events });
});

router.post('/policy-update', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  const { policy_id, organization_id, status } = req.body;
  if (!policy_id || !organization_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  await db.prepare('UPDATE policies SET status=?, updated_at=? WHERE id=? AND organization_id=?').run(status, sqlNow(), policy_id, org.id);
  res.json({ data: { success: true } });
});

// Verify acknowledgment content hash (legal/compliance)
router.post('/verify-acknowledgment', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, acknowledgment_id } = req.body;
  if (!organization_id || !acknowledgment_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const ack = await db.prepare('SELECT * FROM acknowledgments WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(acknowledgment_id, org.id);
  if (!ack) return res.status(404).json({ error: 'Acknowledgment not found' });
  if (!isAdmin(employee) && ack.employee_id !== employee.id) return res.status(403).json({ error: 'Forbidden' });
  const version = await db.prepare('SELECT * FROM policy_versions WHERE id = ? AND deleted_at IS NULL').get(ack.policy_version_id);
  const computedHash = version ? createHash('sha256').update(version.content || '').digest('hex') : '';
  const match = computedHash === ack.content_hash;
  res.json({ data: { match, acknowledgment_id, policy_id: ack.policy_id, version_number: ack.version_number } });
});

// AI: Generate policy (streaming SSE) — TRUTH #154, #161 path 1
router.post('/ai/generate-policy', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  const { prompt, title, category } = req.body || {};
  if (!isClaudeConfigured()) {
    return res.status(503).json({ error: 'AI policy generation is not configured. Set ANTHROPIC_API_KEY.' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  try {
    const userPrompt = prompt && typeof prompt === 'string'
      ? prompt
      : (title ? `Generate a policy document: ${title}` : 'Generate a professional HR policy document.');
    await streamPolicyGeneration(
      { prompt: userPrompt, orgName: org.name, industry: org.industry, state: org.state },
      (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    );
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (e) {
    console.error('Claude stream error:', e);
    res.write(`data: ${JSON.stringify({ error: e.message || 'Generation failed' })}\n\n`);
  } finally {
    res.end();
  }
});

// AI: Scan handbook for missing policies (3.3) — returns 4–6 suggested titles
router.post('/ai/scan-handbook-missing', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  try {
    const rows = await db.prepare('SELECT title FROM policies WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
    const currentTitles = (rows || []).map(r => r.title).filter(Boolean);
    const suggested = await scanHandbookMissing({
      currentTitles,
      state: org.state,
      industry: org.industry,
    });
    return res.json({ data: { suggested_titles: suggested } });
  } catch (e) {
    console.error('scan-handbook-missing:', e);
    return res.status(500).json({ error: e.message || 'Scan failed' });
  }
});

// AI: Extract policies from pasted handbook text (3.4) — returns { policies: [{ title, content }] }
router.post('/ai/extract-handbook', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
  try {
    const policies = await extractPoliciesFromHandbook(text);
    return res.json({ data: { policies } });
  } catch (e) {
    console.error('extract-handbook:', e);
    return res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});

// AI: Handbook recommend — name, industry, state → recommended policy titles (3.5)
router.post('/ai/handbook-recommend', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  const { name, industry, state } = req.body || {};
  try {
    const titles = await handbookRecommend({
      name: name || org.name,
      industry: industry || org.industry,
      state: state || org.state,
    });
    return res.json({ data: { recommended_titles: titles } });
  } catch (e) {
    console.error('handbook-recommend:', e);
    return res.status(500).json({ error: e.message || 'Recommend failed' });
  }
});

// AI: Generate selected policies and create drafts (3.5) — titles[] → create Policy records
router.post('/ai/handbook-generate-selected', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  const { titles } = req.body || {};
  const list = Array.isArray(titles) ? titles.filter(t => t && String(t).trim()) : [];
  if (list.length === 0) return res.status(400).json({ error: 'titles array required' });
  const createdIds = [];
  const { generatePolicyText, validatePolicySimilarity } = await import('../lib/claude.js');
  const existingRows = await db.prepare('SELECT draft_content FROM policies WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const existingTexts = existingRows.map(r => r.draft_content).filter(Boolean);

  for (const title of list.slice(0, 20)) {
    try {
      let content = '';
      let isDuplicate = true;
      let tries = 0;
      
      while (isDuplicate && tries < 2) {
        content = await generatePolicyText({
          prompt: `Write a complete policy document for: ${title}`,
          orgName: org.name,
          industry: org.industry,
          state: org.state,
        });
        
        const sim = validatePolicySimilarity(content, existingTexts, 0.8);
        if (!sim.isDuplicate) {
          isDuplicate = false;
        } else {
          tries++;
          console.warn(`Truth #154 hit: Generation for "${title}" was ${Math.round(sim.highestSimilarity * 100)}% similar to an existing policy. Retrying (${tries}/2).`);
        }
      }

      const id = uuidv4();
      await db.prepare(`
        INSERT INTO policies (id, organization_id, title, description, draft_content, status, current_version, handbook_category, acknowledgment_required, applies_to, created_at)
        VALUES (?, ?, ?, ?, ?, 'draft', 0, 'Other', 1, ?, ?)
      `).run(id, org.id, title.slice(0, 500), '', content || '', stringifyJson({ all_employees: true }), sqlNow());
      
      existingTexts.push(content); // Pre-seed batch items
      createdIds.push(id);
    } catch (e) {
      console.error('handbook-generate-selected item:', title, e);
    }
  }
  return res.json({ data: { created_ids: createdIds } });
});

// AI: Policy suggest for editor (3.7) — current_draft_content, user_instruction → suggested_content
router.post('/ai/policy-suggest', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'ai_policies')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  const { policy_id, current_draft_content, user_instruction } = req.body || {};
  if (!user_instruction || typeof user_instruction !== 'string') return res.status(400).json({ error: 'user_instruction required' });
  try {
    const suggested_content = await policySuggest({
      currentDraftContent: typeof current_draft_content === 'string' ? current_draft_content : '',
      userInstruction: user_instruction,
    });
    return res.json({ data: { suggested_content } });
  } catch (e) {
    console.error('policy-suggest:', e);
    return res.status(500).json({ error: e.message || 'Suggest failed' });
  }
});

// AI: HR write-up assist (admin/manager with HR capability)
router.post('/ai/assist-writeup', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'manage_hr_records')) return res.status(403).json({ error: 'Insufficient permission' });
  if (!isClaudeConfigured()) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY.' });
  const { title, description, employee_role, policy_titles } = req.body || {};
  if (!title || typeof title !== 'string' || !description || typeof description !== 'string') {
    return res.status(400).json({ error: 'title and description required' });
  }
  try {
    const suggestions = await assistWriteUp({
      title: title.slice(0, 500),
      description: description.slice(0, 20000),
      employeeRole: typeof employee_role === 'string' ? employee_role : '',
      policyTitles: Array.isArray(policy_titles) ? policy_titles : [],
    });
    return res.json({ data: suggestions });
  } catch (e) {
    console.error('assist-writeup:', e);
    return res.status(500).json({ error: e.message || 'Assist failed' });
  }
});

// Compliance checklist (3.9) — federal baseline + AI-generated state-specific (Truth #162 correction)
router.post('/compliance-checklist', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'compliance_checklist')) return res.status(403).json({ error: 'Insufficient permission' });
  const state = (org.state || '').trim().toUpperCase() || null;
  const industry = (org.industry || '').trim() || null;
  let items = await db.prepare('SELECT * FROM compliance_checklist_items WHERE organization_id = ? AND deleted_at IS NULL ORDER BY state, requirement_key').all(org.id);
  // Ensure federal baseline is present
  if (items.length === 0 || !items.some(i => i.state === 'FEDERAL')) {
    const federal = await db.prepare("SELECT * FROM compliance_checklist_items WHERE organization_id = '' AND state = 'FEDERAL' AND deleted_at IS NULL").all();
    for (const t of federal) {
      const origText = t.original_requirement_text ?? t.requirement_text;
      const origSuggested = t.original_suggested_answer ?? t.suggested_answer;
      await db.prepare(`
        INSERT INTO compliance_checklist_items (id, organization_id, state, industry, requirement_key, requirement_text, suggested_answer, original_requirement_text, original_suggested_answer, confirmed, confirmed_at, confirmed_by, notes, source_citation, source_url, researched_at, verified_at, verification_status, employee_threshold, category, is_federal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), org.id, t.state || 'FEDERAL', t.industry || '', t.requirement_key, t.requirement_text || '', t.suggested_answer || '', origText || '', origSuggested || '', t.source_citation || '', t.source_url || '', t.researched_at || new Date().toISOString(), t.verified_at || new Date().toISOString(), t.verification_status || 'current', t.employee_threshold, t.category || '', t.is_federal ? 1 : 0);
    }
    items = await db.prepare('SELECT * FROM compliance_checklist_items WHERE organization_id = ? AND deleted_at IS NULL ORDER BY state, requirement_key').all(org.id);
  }
  // Generate state-specific items via Claude (web search) when state is set and we have none yet
  const hasStateSpecific = items.some(i => i.state && i.state !== 'FEDERAL');
  if (state && !hasStateSpecific) {
    try {
      const generated = await generateComplianceChecklist({
        state,
        employeeCount: org.employee_count != null ? org.employee_count : undefined,
        industry: industry || undefined,
      });
      const now = new Date().toISOString();
      for (const g of generated) {
        const reqText = g.requirement_text || '';
        const sugText = g.suggested_answer || '';
        await db.prepare(`
          INSERT INTO compliance_checklist_items (id, organization_id, state, industry, requirement_key, requirement_text, suggested_answer, original_requirement_text, original_suggested_answer, confirmed, confirmed_at, confirmed_by, notes, source_citation, source_url, researched_at, verified_at, verification_status, employee_threshold, category, is_federal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?, ?, 'current', ?, ?, 0)
        `).run(uuidv4(), org.id, state, industry || '', g.requirement_key, reqText, sugText, reqText, sugText, g.source_citation || '', g.source_url || '', g.researched_at || now, now, g.employee_threshold, g.category || 'other');
      }
      items = await db.prepare('SELECT * FROM compliance_checklist_items WHERE organization_id = ? AND deleted_at IS NULL ORDER BY state, requirement_key').all(org.id);
    } catch (e) {
      console.error('compliance-checklist generate:', e);
    }
  }
  res.json({ data: { items } });
});

router.post('/compliance-checklist/confirm', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'compliance_checklist')) return res.status(403).json({ error: 'Insufficient permission' });
  const { item_id, confirmed, notes } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'item_id required' });
  const row = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(item_id, org.id);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE compliance_checklist_items SET confirmed = ?, confirmed_at = ?, confirmed_by = ?, notes = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).run(confirmed ? 1 : 0, confirmed ? now : null, confirmed ? employee.user_email : null, notes ?? row.notes, now, item_id, org.id);
  const updated = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND deleted_at IS NULL').get(item_id);
  res.json({ data: { item: updated } });
});

// POST /compliance-checklist/update-content — update display content only (original preserved); audit logged
router.post('/compliance-checklist/update-content', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'compliance_checklist')) return res.status(403).json({ error: 'Insufficient permission' });
  const { item_id, requirement_text, suggested_answer } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'item_id required' });
  const row = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(item_id, org.id);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  const now = new Date().toISOString();
  const newText = requirement_text != null ? String(requirement_text) : row.requirement_text;
  const newSuggested = suggested_answer !== undefined ? String(suggested_answer) : row.suggested_answer;
  const oldData = { requirement_text: row.requirement_text, suggested_answer: row.suggested_answer };
  const newData = { requirement_text: newText, suggested_answer: newSuggested };
  await db.prepare(`
    UPDATE compliance_checklist_items SET requirement_text = ?, suggested_answer = ?, updated_at = ? WHERE id = ? AND organization_id = ?
  `).run(newText, newSuggested, now, item_id, org.id);
  await logAudit({
    organizationId: org.id,
    actorEmail: employee.user_email,
    entityType: 'ComplianceChecklistItem',
    entityId: item_id,
    action: 'compliance_checklist.update_display_content',
    oldData,
    newData,
    req,
  });
  const updated = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND deleted_at IS NULL').get(item_id);
  res.json({ data: { item: updated } });
});

// POST /compliance-checklist/restore-original — revert display to original sourced content
router.post('/compliance-checklist/restore-original', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'compliance_checklist')) return res.status(403).json({ error: 'Insufficient permission' });
  const { item_id } = req.body || {};
  if (!item_id) return res.status(400).json({ error: 'item_id required' });
  const row = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(item_id, org.id);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  const now = new Date().toISOString();
  const origText = row.original_requirement_text ?? row.requirement_text;
  const origSuggested = row.original_suggested_answer ?? row.suggested_answer;
  const oldData = { requirement_text: row.requirement_text, suggested_answer: row.suggested_answer };
  const newData = { requirement_text: origText, suggested_answer: origSuggested };
  await db.prepare(`
    UPDATE compliance_checklist_items SET requirement_text = ?, suggested_answer = ?, updated_at = ? WHERE id = ? AND organization_id = ?
  `).run(origText, origSuggested, now, item_id, org.id);
  await logAudit({
    organizationId: org.id,
    actorEmail: employee.user_email,
    entityType: 'ComplianceChecklistItem',
    entityId: item_id,
    action: 'compliance_checklist.restore_original',
    oldData,
    newData,
    req,
  });
  const updated = await db.prepare('SELECT * FROM compliance_checklist_items WHERE id = ? AND deleted_at IS NULL').get(item_id);
  res.json({ data: { item: updated } });
});

// POST /compliance-checklist/verify — re-verify sources via Claude web search (uses original_content, not display)
router.post('/compliance-checklist/verify', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'compliance_checklist')) return res.status(403).json({ error: 'Insufficient permission' });
  const items = await db.prepare('SELECT id, original_requirement_text, requirement_text, source_citation, source_url FROM compliance_checklist_items WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const itemsForVerify = items.map(i => ({
    id: i.id,
    requirement_text: i.original_requirement_text || i.requirement_text,
    source_citation: i.source_citation,
    source_url: i.source_url,
  }));
  if (itemsForVerify.length === 0) return res.json({ data: { summary: { current: 0, needs_review: 0, changed: 0, outdated: 0 }, items: [] } });
  try {
    const results = await verifyComplianceChecklist({ items: itemsForVerify });
    const now = new Date().toISOString();
    for (const r of results) {
      await db.prepare(`
        UPDATE compliance_checklist_items SET verification_status = ?, verified_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?
      `).run(r.verification_status, r.verified_at || now, now, r.id, org.id);
    }
    const summary = { current: 0, needs_review: 0, changed: 0, outdated: 0 };
    for (const r of results) {
      if (r.verification_status in summary) summary[r.verification_status]++;
    }
    const updated = await db.prepare('SELECT * FROM compliance_checklist_items WHERE organization_id = ? AND deleted_at IS NULL ORDER BY state, requirement_key').all(org.id);
    res.json({ data: { summary, items: updated } });
  } catch (e) {
    console.error('compliance-checklist/verify:', e);
    return res.status(500).json({ error: e.message || 'Verification failed' });
  }
});

// Gap audit (3.10) — required policies per state vs current handbook
const REQUIRED_POLICIES_BY_STATE = {
  MA: ['Anti-Harassment / Harassment Prevention', 'At-Will Employment', 'Attendance & Punctuality', 'Code of Conduct', 'Confidentiality', 'Discipline & Corrective Action', 'Equal Employment Opportunity', 'Leave of Absence (FMLA, etc.)', 'Meal & Rest Breaks', 'Overtime & Wage Payment', 'Paid Sick Leave (MA Earned Sick Time)', 'Safety & Workers Compensation', 'Social Media & Electronic Use', 'Time Off / PTO', 'Tip Reporting & Gratuity', 'Workplace Violence Prevention', 'Drug & Alcohol', 'Termination & Resignation'],
  NY: ['Anti-Harassment', 'At-Will Employment', 'Code of Conduct', 'Confidentiality', 'Discipline', 'EEO', 'Leave of Absence', 'Meal Breaks', 'Overtime', 'Paid Sick Leave', 'Safety', 'Social Media', 'Time Off', 'Workplace Violence', 'Drug & Alcohol', 'Termination'],
  CA: ['Anti-Harassment', 'At-Will Employment', 'Code of Conduct', 'Confidentiality', 'Discipline', 'EEO', 'Family Leave', 'Meal & Rest Breaks', 'Overtime', 'Paid Sick Leave', 'Safety', 'Social Media', 'Time Off', 'Workplace Violence', 'Drug & Alcohol', 'Termination'],
};
function getRequiredPolicyTitles(state) {
  const s = (state || '').trim().toUpperCase();
  return (REQUIRED_POLICIES_BY_STATE[s] || []);
}

router.post('/gap-audit', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'gap_audit')) return res.status(403).json({ error: 'Insufficient permission' });
  const required = getRequiredPolicyTitles(org.state);
  const rows = await db.prepare('SELECT id, title FROM policies WHERE organization_id = ? AND deleted_at IS NULL').all(org.id);
  const current = (rows || []).map(r => (r.title || '').trim()).filter(Boolean);
  const requiredSet = new Set(required.map(t => t.toLowerCase()));
  const currentSet = new Set(current.map(t => t.toLowerCase()));
  const missing = required.filter(t => !currentSet.has(t.toLowerCase()));
  res.json({ data: { required, current, missing } });
});

// Export single employee file (TRUTH #56, #164 - re-hire carries forward same file)
router.post('/export-employee-file', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, employee_id } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(400).json({ error: 'organization_id required' });
  if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
  const targetEmp = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ?').get(employee_id, org.id);
  if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

  const isOwnFile = employee_id === employee.id;
  const canExportAny = hasCapability(employee, 'export_employee_file');

  if (!canExportAny && !isOwnFile) return res.status(403).json({ error: 'Can only export own file or export_employee_file capability required' });

  const acknowledgments = await db.prepare('SELECT * FROM acknowledgments WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL').all(org.id, employee_id);
  let hrRecords = await db.prepare('SELECT * FROM hr_records WHERE organization_id = ? AND employee_id = ?').all(org.id, employee_id);
  if (!canExportAny && isOwnFile) {
    hrRecords = hrRecords.filter(r => r.record_type !== 'internal_note');
    hrRecords = hrRecords.filter(r => !(r.record_type === 'commendation' && (r.visible_to_employee === 0 || r.visible_to_employee === false)));
  }
  const incidentReports = canExportAny
    ? await db.prepare('SELECT * FROM incident_reports WHERE organization_id = ? AND employee_id = ?').all(org.id, employee_id)
    : [];
  const recordIds = [...hrRecords.map(r => r.id), ...incidentReports.map(r => r.id)];
  let amendments = [];
  if (recordIds.length > 0) {
    const placeholders = recordIds.map(() => '?').join(',');
    amendments = await db.prepare(`SELECT * FROM amendments WHERE organization_id = ? AND record_id IN (${placeholders})`).all(org.id, ...recordIds);
  }

  const employee_documents = await db.prepare(
    'SELECT id, filename, category, created_at, uploaded_by FROM employee_documents WHERE organization_id = ? AND employee_id = ? AND deleted_at IS NULL'
  ).all(org.id, employee_id);

  const data = {
    exported_at: new Date().toISOString(),
    employee_id,
    employee_name: targetEmp.full_name,
    employee_email: targetEmp.user_email,
    acknowledgments,
    hr_records: hrRecords,
    incident_reports: incidentReports,
    amendments,
    employee_documents,
    note: 'Re-hire: use same employee_id; file is preserved. Termination: access revoked; file retained.'
  };
  res.json({ data });
});

// TRUTH #56: Employee document upload — multipart, admin or manage_employees
const DOCUMENT_UPLOAD_LIMIT_PER_HOUR = 20;
router.post('/employee-documents/upload', uploadMulter.single('file'), async (req, res) => {
  try {
    const { org, employee } = await getContext(req);
    if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
    if (!hasCapability(employee, 'manage_employees') && !isAdmin(employee)) {
      return res.status(403).json({ error: 'Insufficient permission' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const employee_id = req.body?.employee_id;
    const category = (req.body?.category || 'other').trim().slice(0, 100);
    const notes = (req.body?.notes || '').trim().slice(0, 500);
    if (!employee_id || typeof employee_id !== 'string') {
      return res.status(400).json({ error: 'employee_id required' });
    }
    const targetEmp = await db.prepare('SELECT id FROM employees WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(employee_id, org.id);
    if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const count = (await db.prepare('SELECT COUNT(*) as c FROM document_upload_log WHERE organization_id = ? AND created_at > ?').get(org.id, oneHourAgo))?.c ?? 0;
    if (count >= DOCUMENT_UPLOAD_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'Upload limit reached. Try again in an hour.' });
    }

    const id = uuidv4();
    const filename = (req.file.originalname || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255) || 'document';
    const mime = req.file.mimetype || null;
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO employee_documents (id, organization_id, employee_id, uploaded_by, filename, stored_filename, file_size, mime_type, category, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, org.id, employee_id, req.user.id, filename, req.file.filename, req.file.size, mime, category || 'other', notes || null, now);
    await db.prepare('INSERT INTO document_upload_log (id, organization_id, created_at) VALUES (?, ?, ?)').run(uuidv4(), org.id, now);

    const audit = getAuditContext(req);
    const actorName = employee.full_name || employee.user_email || req.user.email || '';
    await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), org.id, 'document_uploaded', 'EmployeeDocument', id, req.user.email || '', actorName,
      `Document uploaded: ${filename}`,
      stringifyJson({ employee_id, filename, category }),
      audit.ip_address, audit.device_id, audit.app_source, null, null
    );

    const row = await db.prepare('SELECT * FROM employee_documents WHERE id = ?').get(id);
    res.status(201).json({ data: row });
  } catch (e) {
    if (e.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB.' });
    console.error('Employee document upload error:', e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

// List employee documents (metadata only); admin sees all, employee sees own
router.get('/employee-documents/:employee_id', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { employee_id } = req.params;
  if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
  const targetEmp = await db.prepare('SELECT id FROM employees WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(employee_id, org.id);
  if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });
  const canSeeAll = isAdmin(employee) || hasCapability(employee, 'manage_employees');
  if (!canSeeAll && employee_id !== employee.id) return res.status(403).json({ error: 'Can only view your own documents' });

  const rows = await db.prepare(`
    SELECT ed.id, ed.organization_id, ed.employee_id, ed.uploaded_by, ed.filename, ed.file_size, ed.mime_type, ed.category, ed.notes, ed.created_at,
           u.email AS uploaded_by_email
    FROM employee_documents ed
    LEFT JOIN users u ON u.id = ed.uploaded_by
    WHERE ed.organization_id = ? AND ed.employee_id = ? AND ed.deleted_at IS NULL
    ORDER BY ed.created_at DESC
  `).all(org.id, employee_id);
  res.json({ data: rows });
});

// Download document — stream from disk; admin or own
router.get('/employee-documents/download/:document_id', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { document_id } = req.params;
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  const doc = await db.prepare('SELECT * FROM employee_documents WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(document_id, org.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const canDownload = isAdmin(employee) || hasCapability(employee, 'manage_employees') || doc.employee_id === employee.id;
  if (!canDownload) return res.status(403).json({ error: 'Insufficient permission' });

  const filePath = join(UPLOADS_DIR, doc.stored_filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${(doc.filename || 'document').replace(/"/g, '\\"')}"`);
  const stream = createReadStream(filePath);
  stream.pipe(res);
});

// Soft delete document — admin only
router.delete('/employee-documents/:document_id', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!isAdmin(employee)) return res.status(403).json({ error: 'Admin only' });
  const { document_id } = req.params;
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  const doc = await db.prepare('SELECT * FROM employee_documents WHERE id = ? AND organization_id = ? AND deleted_at IS NULL').get(document_id, org.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const now = new Date().toISOString();
  await db.prepare('UPDATE employee_documents SET deleted_at = ? WHERE id = ?').run(now, document_id);

  const audit = getAuditContext(req);
  const actorName = employee.full_name || employee.user_email || req.user.email || '';
  await db.prepare('INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, ip_address, device_id, app_source, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    uuidv4(), org.id, 'document_deleted', 'EmployeeDocument', document_id, req.user.email || '', actorName,
    `Document soft-deleted: ${doc.filename}`,
    stringifyJson({ employee_id: doc.employee_id, filename: doc.filename }),
    audit.ip_address, audit.device_id, audit.app_source, null, null
  );
  res.json({ success: true });
});

// Data export for compliance / legal hold (admin only)
router.post('/export-org-data', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  if (!hasCapability(employee, 'export_org_data')) return res.status(403).json({ error: 'Insufficient permission' });
  const { organization_id } = req.body;
  if (!organization_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });

  const data = {
    exported_at: new Date().toISOString(),
    organization: await db.prepare('SELECT * FROM organizations WHERE id = ?').get(org.id),
    locations: await db.prepare('SELECT * FROM locations WHERE organization_id = ? AND deleted_at IS NULL').all(org.id),
    employees: await db.prepare('SELECT * FROM employees WHERE organization_id = ?').all(org.id),
    policies: await db.prepare('SELECT * FROM policies WHERE organization_id = ?').all(org.id),
    policy_versions: await db.prepare('SELECT pv.* FROM policy_versions pv JOIN policies p ON p.id = pv.policy_id WHERE p.organization_id = ? AND pv.deleted_at IS NULL').all(org.id),
    acknowledgments: await db.prepare('SELECT * FROM acknowledgments WHERE organization_id = ? AND deleted_at IS NULL').all(org.id),
    hr_records: await db.prepare('SELECT * FROM hr_records WHERE organization_id = ?').all(org.id),
    incident_reports: await db.prepare('SELECT * FROM incident_reports WHERE organization_id = ?').all(org.id),
    amendments: await db.prepare('SELECT * FROM amendments WHERE organization_id = ?').all(org.id),
    system_events: await db.prepare('SELECT * FROM system_events WHERE organization_id = ? AND deleted_at IS NULL').all(org.id),
  };
  res.json({ data });
});

// Get employee profile
router.post('/employee-profile', async (req, res) => {
  const { org, employee } = await getContext(req);
  if (!org || !employee) return res.status(403).json({ error: 'Forbidden' });
  const { organization_id, employee_id } = req.body;
  if (!organization_id || !employee_id || organization_id !== org.id) return res.status(400).json({ error: 'Invalid request' });
  const emp = await db.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ?').get(employee_id, org.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const location = emp.location_id ? await db.prepare('SELECT * FROM locations WHERE id = ? AND deleted_at IS NULL').get(emp.location_id) : null;
  res.json({ data: { employee: emp, location } });
});

export { router as apiRouter };
