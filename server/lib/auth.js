import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, createHash } from 'crypto';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'policyvault-dev-secret-change-in-production');
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_ACCESS_TOKEN = 'pv_access_token';
const COOKIE_CSRF = 'pv_csrf_token';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;
const CSRF_MAX_AGE_SEC = 60 * 60; // 1 hour
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
const SALT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createToken(userId, email, opts = {}) {
  const { expiresIn = '7d', ...rest } = opts;
  return jwt.sign({ userId, email, ...rest }, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getCookieOptions(name, maxAgeSec) {
  const opts = { path: '/', sameSite: 'strict', maxAge: maxAgeSec };
  if (isProd) opts.secure = true;
  if (name === COOKIE_ACCESS_TOKEN) opts.httpOnly = true;
  return opts;
}

export function setAuthCookie(res, token) {
  const maxAgeSec = 15 * 60; // 15 min to match access token
  res.cookie(COOKIE_ACCESS_TOKEN, token, getCookieOptions(COOKIE_ACCESS_TOKEN, maxAgeSec));
}

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRefreshTokenValue() {
  return randomBytes(64).toString('hex');
}

export function storeRefreshToken(userType, userId, tokenValue, expiresAt) {
  const id = uuidv4();
  const hash = hashRefreshToken(tokenValue);
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userType, userId, hash, expiresAt);
  return id;
}

export function findRefreshTokenByValue(tokenValue) {
  const hash = hashRefreshToken(tokenValue);
  return db.prepare(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL'
  ).get(hash);
}

export function markRefreshTokenUsed(id) {
  db.prepare('UPDATE refresh_tokens SET used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

export function revokeAllRefreshTokensForUser(userType, userId) {
  db.prepare(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE user_type = ? AND user_id = ?'
  ).run(new Date().toISOString(), userType, userId);
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_ACCESS_TOKEN, { path: '/' });
}

export function authMiddleware(req, res, next) {
  let token = req.cookies?.[COOKIE_ACCESS_TOKEN] || null;
  if (!token) {
    const auth = req.headers.authorization;
    token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (payload.isSuperAdmin) {
    const emailNorm = (payload.email || '').trim().toLowerCase();
    if (!emailNorm) return res.status(401).json({ error: 'Invalid token' });
    const superAdmin = db.prepare('SELECT * FROM super_admins WHERE LOWER(email) = ?').get(emailNorm);
    if (!superAdmin) return res.status(401).json({ error: 'Super admin not found' });
    req.user = superAdmin;
    req.superAdmin = true;
    req.impersonateOrgId = payload.impersonateOrgId || null;
    return next();
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  req.superAdmin = false;
  next();
}

export function getEmployeeByEmail(organizationId, email) {
  return db.prepare(
    'SELECT * FROM employees WHERE organization_id = ? AND user_email = ? AND deleted_at IS NULL'
  ).get(organizationId, email);
}

export function getOrgContextByOrgId(orgId) {
  const emp = db.prepare(
    `SELECT e.*, o.name as org_name, o.industry as org_industry, o.settings as org_settings, o.state as org_state, o.employee_count as org_employee_count FROM employees e JOIN organizations o ON e.organization_id = o.id WHERE e.organization_id = ? AND e.status = 'active' ORDER BY CASE WHEN e.permission_level = 'org_admin' THEN 0 ELSE 1 END LIMIT 1`
  ).get(orgId);
  if (!emp) return { org: null, employee: null };
  const org = {
    id: emp.organization_id,
    name: emp.org_name,
    industry: emp.org_industry,
    settings: emp.org_settings ? JSON.parse(emp.org_settings) : {},
    state: emp.org_state || null,
    employee_count: emp.org_employee_count != null ? emp.org_employee_count : null
  };
  const employee = {
    id: emp.id,
    organization_id: emp.organization_id,
    user_email: emp.user_email,
    full_name: emp.full_name,
    role: emp.role,
    department: emp.department,
    location_id: emp.location_id,
    permission_level: emp.permission_level,
    status: emp.status,
    hire_date: emp.hire_date,
    phone_number: emp.phone_number,
    email_reminders: emp.email_reminders,
    sms_reminders: emp.sms_reminders,
    tags: emp.tags ? JSON.parse(emp.tags) : [],
    capabilities: emp.capabilities ? (() => { try { return JSON.parse(emp.capabilities); } catch { return []; } })() : []
  };
  return { org, employee };
}

export function getEmployeeContext(userEmail) {
  if (!userEmail || typeof userEmail !== 'string') return { org: null, employee: null };
  const emailNorm = userEmail.trim().toLowerCase();
  const emp = db.prepare(
    'SELECT e.*, o.name as org_name, o.industry as org_industry, o.settings as org_settings, o.state as org_state, o.employee_count as org_employee_count FROM employees e JOIN organizations o ON e.organization_id = o.id WHERE LOWER(TRIM(e.user_email)) = ? AND e.status = ? AND e.deleted_at IS NULL ORDER BY CASE WHEN e.permission_level = \'org_admin\' THEN 0 ELSE 1 END LIMIT 1'
  ).get(emailNorm, 'active');
  if (!emp) return { org: null, employee: null };
  const org = {
    id: emp.organization_id,
    name: emp.org_name,
    industry: emp.org_industry,
    settings: emp.org_settings ? JSON.parse(emp.org_settings) : {},
    state: emp.org_state || null,
    employee_count: emp.org_employee_count != null ? emp.org_employee_count : null
  };
  const employee = {
    id: emp.id,
    organization_id: emp.organization_id,
    user_email: emp.user_email,
    full_name: emp.full_name,
    role: emp.role,
    department: emp.department,
    location_id: emp.location_id,
    permission_level: emp.permission_level,
    status: emp.status,
    hire_date: emp.hire_date,
    phone_number: emp.phone_number,
    email_reminders: emp.email_reminders,
    sms_reminders: emp.sms_reminders,
    tags: emp.tags ? JSON.parse(emp.tags) : [],
    capabilities: emp.capabilities ? (() => { try { return JSON.parse(emp.capabilities); } catch { return []; } })() : []
  };
  return { org, employee };
}

/**
 * CSRF double-submit: for state-changing requests, require X-CSRF-Token header to match pv_csrf_token cookie.
 * Skipped for GET, HEAD, OPTIONS. Applied only to /api (auth routes are mounted before this).
 */
export function csrfMiddleware(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  // Bearer-only clients (e.g. mobile, test scripts) don't use cookies; skip CSRF for them
  const isBearerOnly = req.headers['x-client-type'] === 'mobile' || (req.headers.authorization?.startsWith('Bearer ') && !req.cookies?.[COOKIE_CSRF]);
  if (isBearerOnly) return next();
  const cookieToken = req.cookies?.[COOKIE_CSRF];
  const headerToken = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Request a new token from GET /api/auth/csrf.' });
  }
  next();
}

export function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(res, token) {
  res.cookie(COOKIE_CSRF, token, getCookieOptions(COOKIE_CSRF, CSRF_MAX_AGE_SEC));
}
