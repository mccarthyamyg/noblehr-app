import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { db } from "../lib/db-pg-adapter.js";
import { hashPassword, verifyPassword, createToken, verifyToken, getEmployeeContext, setAuthCookie, clearSessionCookies, setRefreshCookie, COOKIE_REFRESH_TOKEN, generateCsrfToken, setCsrfCookie, createRefreshTokenValue, storeRefreshToken, findRefreshTokenByValue, markRefreshTokenUsed, revokeAllRefreshTokensForUser } from '../lib/auth.js';
import { sendOrgApprovalNotification, sendPasswordReset, sendVerificationEmail } from '../lib/email.js';

const APPROVAL_TOKEN_EXPIRY_DAYS = 7;
const APPROVAL_EMAIL_COOLDOWN_MINUTES = 60;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

function safeErrorMsg(e) {
  return isProd ? 'An error occurred' : (e?.message || 'An error occurred');
}

const router = Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function verifyGoogleToken(credential) {
  if (!googleClient) throw new Error('Google Sign-In is not configured. Set GOOGLE_CLIENT_ID.');
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  return ticket.getPayload(); // { email, name, sub, picture, ... }
}

// Input validation helpers
function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}
function isValidPassword(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 128;
}

function validatePasswordStrength(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must be less than 128 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

// Helper: send approval email to super admin (with rate limit)
async function sendApprovalEmailIfAllowed(orgId, orgName, adminEmail, adminName) {
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  if (!org) return;
  const lastSent = org.last_approval_email_sent_at;
  if (lastSent) {
    const diffMs = Date.now() - new Date(lastSent).getTime();
    if (diffMs < APPROVAL_EMAIL_COOLDOWN_MINUTES * 60 * 1000) {
      return; // Rate limited - don't resend
    }
  }
  const token = org.approval_token || randomBytes(32).toString('hex');
  const expiresAt = org.approval_token_expires_at || new Date(Date.now() + APPROVAL_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  if (!org.approval_token) {
    await db.prepare('UPDATE organizations SET approval_token = ?, approval_token_expires_at = ?, last_approval_email_sent_at = ? WHERE id = ?').run(
      token, expiresAt, new Date().toISOString(), orgId
    );
  } else {
    await db.prepare('UPDATE organizations SET last_approval_email_sent_at = ? WHERE id = ?').run(new Date().toISOString(), orgId);
  }
  const superAdmins = await db.prepare('SELECT email FROM super_admins').all();
  const approvalLink = `${FRONTEND_URL}/ApproveOrg?token=${token}`;
  for (const sa of superAdmins) {
    await sendOrgApprovalNotification({
      superAdminEmail: sa.email,
      orgName,
      adminEmail,
      adminName,
      approvalLink,
    });
  }
}

// POST /api/auth/register - First user creates org (Setup flow) - requires super admin approval
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, first_name, last_name, org_name, industry, locations, roles, departments, accept_tos } = req.body;
    // Compose full_name from first/last if provided separately
    const resolvedFirstName = (first_name || '').trim();
    const resolvedLastName = (last_name || '').trim();
    const resolvedFullName = (full_name || [resolvedFirstName, resolvedLastName].filter(Boolean).join(' ')).trim();
    if (!email || !password || !resolvedFullName || !org_name) {
      return res.status(400).json({ error: 'email, password, name, org_name required' });
    }
    if (!accept_tos) {
      return res.status(400).json({ error: 'You must accept the Terms of Service to sign up' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    if (resolvedFullName.length > 200) return res.status(400).json({ error: 'Name too long' });
    if (org_name.length > 200) return res.status(400).json({ error: 'Organization name too long' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const userId = uuidv4();
    const orgId = uuidv4();
    const empId = uuidv4();
    const approvalToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare('INSERT INTO users (id, email, password_hash, full_name, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, email, hashPassword(password), resolvedFullName, resolvedFirstName || resolvedFullName, resolvedLastName
      );
      await db.prepare(`INSERT INTO organizations (id, name, industry, settings, status, approval_token, approval_token_expires_at, last_approval_email_sent_at, tos_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        orgId, org_name, industry || '', JSON.stringify({ custom_roles: roles || [], departments: departments || [], custom_tags: [] }),
        'pending_approval', approvalToken, expiresAt, now, now
      );
      for (const loc of (locations || []).filter(l => l.name)) {
        await db.prepare('INSERT INTO locations (id, organization_id, name, address) VALUES (?, ?, ?, ?)').run(
          uuidv4(), orgId, loc.name, loc.address || ''
        );
      }
      const nowIso = new Date().toISOString();
      await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, first_name, last_name, role, permission_level, status, hire_date, email_verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        empId, orgId, email, resolvedFullName, resolvedFirstName || resolvedFullName, resolvedLastName, 'Organization Admin', 'org_admin', 'active', new Date().toISOString().split('T')[0], nowIso
      );
    })();
    await sendApprovalEmailIfAllowed(orgId, org_name, email, resolvedFullName);
    res.json({ success: true, pendingApproval: true, message: 'Your organization is pending approval from the platform administrator. You will receive an email when approved.' });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// GET /api/auth/csrf — issue CSRF token for double-submit (cookie + body); client sends header on mutations
router.get('/csrf', (req, res) => {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  res.json({ csrf: token });
});

// POST /api/auth/logout — clear httpOnly access + refresh cookies (web)
router.post('/logout', (req, res) => {
  clearSessionCookies(res);
  res.json({ ok: true });
});

// POST /api/auth/launch-cookie — web only: set httpOnly cookie from launch token (super admin launch link)
router.post('/launch-cookie', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token required' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired launch token' });
  }
  setAuthCookie(res, token);
  res.json({ ok: true });
});

const REFRESH_TOKEN_DAYS = 7;
const ACCESS_TOKEN_EXPIRY = '15m';

// POST /api/auth/refresh — rotate refresh token; return new access + refresh (4.2)
router.post('/refresh', async (req, res) => {
  try {
    const isWeb = req.headers['x-client-type'] !== 'mobile';
    let refresh_token = req.body?.refresh_token;
    if ((!refresh_token || typeof refresh_token !== 'string') && isWeb) {
      refresh_token = req.cookies?.[COOKIE_REFRESH_TOKEN];
    }
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token required' });
    }
    const row = await findRefreshTokenByValue(refresh_token);
    if (!row) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    if (row.used_at) {
      await revokeAllRefreshTokensForUser(row.user_type, row.user_id);
      return res.status(401).json({ error: 'Refresh token reuse detected; all sessions revoked' });
    }
    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (row.user_type === 'super_admin') {
      const superAdmin = await db.prepare('SELECT * FROM super_admins WHERE id = ?').get(row.user_id);
      if (!superAdmin) return res.status(401).json({ error: 'User not found' });
      const accessToken = createToken(superAdmin.id, superAdmin.email, { isSuperAdmin: true, expiresIn: ACCESS_TOKEN_EXPIRY });
      const newRefresh = createRefreshTokenValue();
      const newExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await markRefreshTokenUsed(row.id);
      await storeRefreshToken('super_admin', row.user_id, newRefresh, newExpires);
      if (isWeb) {
        setAuthCookie(res, accessToken);
        setRefreshCookie(res, newRefresh);
      }
      return res.json({ token: accessToken, refresh_token: newRefresh, expires_in: 900 });
    }
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const accessToken = createToken(user.id, user.email, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefresh = createRefreshTokenValue();
    const newExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await markRefreshTokenUsed(row.id);
    await storeRefreshToken('user', row.user_id, newRefresh, newExpires);
    if (isWeb) {
      setAuthCookie(res, accessToken);
      setRefreshCookie(res, newRefresh);
    }
    const { org: orgCtx, employee } = await getEmployeeContext(user.email);
    return res.json({ token: accessToken, refresh_token: newRefresh, expires_in: 900, user: { email: user.email, full_name: user.full_name }, org: orgCtx, employee });
  } catch (e) {
    console.error('Refresh error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    const emailLower = email.trim().toLowerCase();
    const isWeb = req.headers['x-client-type'] !== 'mobile';

    // Super admin login
    const superAdmin = await db.prepare('SELECT * FROM super_admins WHERE LOWER(email) = ?').get(emailLower);
    if (superAdmin && verifyPassword(password, superAdmin.password_hash)) {
      const token = createToken(superAdmin.id, superAdmin.email, { isSuperAdmin: true, expiresIn: ACCESS_TOKEN_EXPIRY });
      const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const refreshToken = createRefreshTokenValue();
      await storeRefreshToken('super_admin', superAdmin.id, refreshToken, refreshExpires);
      if (isWeb) {
        setAuthCookie(res, token);
        setRefreshCookie(res, refreshToken);
      }
      return res.json({
        token,
        refresh_token: refreshToken,
        expires_in: 900,
        user: { email: superAdmin.email, full_name: superAdmin.full_name, first_name: superAdmin.first_name, last_name: superAdmin.last_name },
        superAdmin: true,
        org: null,
        employee: null,
      });
    }

    const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(emailLower);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.auth_provider === 'google') {
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });
    }
    const emp = await db.prepare('SELECT * FROM employees WHERE LOWER(user_email) = ? AND status = ? AND deleted_at IS NULL').get(emailLower, 'active');
    if (!emp) {
      return res.status(403).json({ error: 'No active employee record. Contact your administrator.' });
    }
    const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(emp.organization_id);
    if (org?.status === 'pending_approval') {
      return res.status(403).json({ error: 'Your organization is pending approval from the platform administrator.' });
    }
    if (org?.status === 'rejected') {
      return res.status(403).json({ error: 'Your organization has been rejected. You can request approval again.', rejected: true });
    }
    // TRUTH #158: Email verification gate — employees must verify before first login
    if (emp.email_verified_at == null || emp.email_verified_at === '') {
      return res.status(403).json({
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        code: 'email_not_verified',
      });
    }
    const token = createToken(user.id, user.email, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const refreshToken = createRefreshTokenValue();
    await storeRefreshToken('user', user.id, refreshToken, refreshExpires);
    if (isWeb) {
      setAuthCookie(res, token);
      setRefreshCookie(res, refreshToken);
    }
    const { org: orgCtx, employee } = await getEmployeeContext(user.email);
    res.json({ token, refresh_token: refreshToken, expires_in: 900, user: { email: user.email, full_name: user.full_name, first_name: user.first_name, last_name: user.last_name }, org: orgCtx, employee });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/google - Sign in with Google (existing account)
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'credential (Google ID token) required' });
    }
    const payload = await verifyGoogleToken(credential);
    const email = payload.email;
    if (!email) return res.status(400).json({ error: 'Google account has no email' });
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found', needSignup: true, email: payload.email, full_name: payload.name || '' });
    }
    const emp = await db.prepare('SELECT * FROM employees WHERE user_email = ? AND status = ? AND deleted_at IS NULL').get(email, 'active');
    if (!emp) {
      return res.status(403).json({ error: 'No active employee record. Contact your administrator.' });
    }
    const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(emp.organization_id);
    if (org?.status === 'pending_approval') {
      return res.status(403).json({ error: 'Your organization is pending approval from the platform administrator.' });
    }
    if (org?.status === 'rejected') {
      return res.status(403).json({ error: 'Your organization has been rejected. You can request approval again.', rejected: true });
    }
    const token = createToken(user.id, user.email, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const refreshToken = createRefreshTokenValue();
    await storeRefreshToken('user', user.id, refreshToken, refreshExpires);
    if (req.headers['x-client-type'] !== 'mobile') {
      setAuthCookie(res, token);
      setRefreshCookie(res, refreshToken);
    }
    const { org: orgCtx, employee } = await getEmployeeContext(user.email);
    res.json({ token, refresh_token: refreshToken, expires_in: 900, user: { email: user.email, full_name: user.full_name, first_name: user.first_name, last_name: user.last_name }, org: orgCtx, employee });
  } catch (e) {
    console.error('Google login error:', e);
    res.status(401).json({ error: safeErrorMsg(e) || 'Google Sign-In failed' });
  }
});

// POST /api/auth/google-register - Sign up with Google (create org + account) - requires super admin approval
router.post('/google-register', async (req, res) => {
  try {
    const { credential, org_name, industry, locations, roles, departments, accept_tos } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'credential (Google ID token) required' });
    }
    if (!org_name || org_name.trim().length === 0) {
      return res.status(400).json({ error: 'org_name required' });
    }
    if (!accept_tos) {
      return res.status(400).json({ error: 'You must accept the Terms of Service to sign up' });
    }
    const payload = await verifyGoogleToken(credential);
    const email = payload.email;
    const full_name = (payload.name || email).trim().slice(0, 200);
    if (!email) return res.status(400).json({ error: 'Google account has no email' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Sign in with Google instead.' });
    }
    const userId = uuidv4();
    const orgId = uuidv4();
    const empId = uuidv4();
    const placeholderPassword = hashPassword(uuidv4());
    const approvalToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare('INSERT INTO users (id, email, password_hash, full_name, auth_provider) VALUES (?, ?, ?, ?, ?)').run(
        userId, email, placeholderPassword, full_name, 'google'
      );
      await db.prepare(`INSERT INTO organizations (id, name, industry, settings, status, approval_token, approval_token_expires_at, last_approval_email_sent_at, tos_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        orgId, (org_name || '').trim().slice(0, 200), (industry || '').trim().slice(0, 200),
        JSON.stringify({ custom_roles: roles || [], departments: departments || [], custom_tags: [] }),
        'pending_approval', approvalToken, expiresAt, now, now
      );
      for (const loc of (locations || []).filter(l => l && l.name)) {
        await db.prepare('INSERT INTO locations (id, organization_id, name, address) VALUES (?, ?, ?, ?)').run(
          uuidv4(), orgId, loc.name, loc.address || ''
        );
      }
      const nowIso = new Date().toISOString();
      await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, permission_level, status, hire_date, email_verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        empId, orgId, email, full_name, 'Organization Admin', 'org_admin', 'active', new Date().toISOString().split('T')[0], nowIso
      );
    })();
    await sendApprovalEmailIfAllowed(orgId, org_name, email, full_name);
    res.json({ success: true, pendingApproval: true, message: 'Your organization is pending approval from the platform administrator. You will receive an email when approved.' });
  } catch (e) {
    console.error('Google register error:', e);
    res.status(500).json({ error: safeErrorMsg(e) || 'Google Sign-Up failed' });
  }
});

// GET (legacy) and POST /api/auth/approve-org/validate - Public: validate approval token (prefer POST to avoid token in URL)
router.get('/approve-org/validate', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const org = await db.prepare('SELECT * FROM organizations WHERE approval_token = ?').get(token);
    if (!org) return res.status(404).json({ error: 'Invalid or expired approval link' });
    if (org.status !== 'pending_approval') {
      return res.json({ valid: false, status: org.status, message: org.status === 'active' ? 'Already approved' : 'Already rejected' });
    }
    const now = new Date().toISOString();
    if (org.approval_token_expires_at < now) {
      return res.status(410).json({ error: 'Approval link has expired. The organization must request approval again.' });
    }
    const admin = await db.prepare('SELECT user_email, full_name FROM employees WHERE organization_id = ? AND permission_level = ? AND deleted_at IS NULL').get(org.id, 'org_admin');
    res.json({
      valid: true,
      org_name: org.name,
      admin_email: admin?.user_email,
      admin_name: admin?.full_name,
    });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

router.post('/approve-org/validate', async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const org = await db.prepare('SELECT * FROM organizations WHERE approval_token = ?').get(token);
    if (!org) return res.status(404).json({ error: 'Invalid or expired approval link' });
    if (org.status !== 'pending_approval') {
      return res.json({ valid: false, status: org.status, message: org.status === 'active' ? 'Already approved' : 'Already rejected' });
    }
    const now = new Date().toISOString();
    if (org.approval_token_expires_at < now) {
      return res.status(410).json({ error: 'Approval link has expired. The organization must request approval again.' });
    }
    const admin = await db.prepare('SELECT user_email, full_name FROM employees WHERE organization_id = ? AND permission_level = ? AND deleted_at IS NULL').get(org.id, 'org_admin');
    res.json({
      valid: true,
      org_name: org.name,
      admin_email: admin?.user_email,
      admin_name: admin?.full_name,
    });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/approve-org - Public: approve or deny org (token in body)
router.post('/approve-org', async (req, res) => {
  try {
    const { token, action } = req.body;
    if (!token || !action) return res.status(400).json({ error: 'token and action required' });
    if (!['approve', 'deny'].includes(action)) return res.status(400).json({ error: 'action must be approve or deny' });
    const org = await db.prepare('SELECT * FROM organizations WHERE approval_token = ?').get(token);
    if (!org) return res.status(404).json({ error: 'Invalid or expired approval link' });
    if (org.status !== 'pending_approval') {
      return res.status(400).json({ error: `Organization already ${org.status}` });
    }
    const now = new Date().toISOString();
    if (org.approval_token_expires_at < now) {
      return res.status(410).json({ error: 'Approval link has expired.' });
    }
    const newStatus = action === 'approve' ? 'active' : 'rejected';
    await db.prepare('UPDATE organizations SET status = ?, approval_token = NULL, approval_token_expires_at = NULL WHERE id = ?').run(newStatus, org.id);
    res.json({ success: true, status: newStatus });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/forgot-password - Public: request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    const emailLower = email.trim().toLowerCase();
    const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(emailLower);
    const superAdmin = await db.prepare('SELECT * FROM super_admins WHERE LOWER(email) = ?').get(emailLower);
    if (!user && !superAdmin) {
      return res.json({ success: true, message: 'If that email exists, you will receive a reset link.' });
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const id = uuidv4();
    await db.prepare('INSERT INTO password_reset_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)').run(
      id, user ? user.email : superAdmin.email, token, expiresAt
    );
    const resetLink = `${FRONTEND_URL}/ResetPassword?token=${token}`;
    await sendPasswordReset({ to: user ? user.email : superAdmin.email, resetLink });
    res.json({ success: true, message: 'If that email exists, you will receive a reset link.' });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/reset-password - Public: set new password with token (single-use, atomic)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password required' });
    const pwErr = validatePasswordStrength(new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const row = await db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used_at IS NULL').get(token);
    if (!row) return res.status(404).json({ error: 'Invalid or expired reset link' });
    const now = new Date().toISOString();
    if (row.expires_at < now) return res.status(410).json({ error: 'Reset link has expired' });
    const updated = await db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(now, row.id);
    if (updated.changes === 0) return res.status(404).json({ error: 'Invalid or expired reset link' });
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(row.email);
    const superAdmin = await db.prepare('SELECT * FROM super_admins WHERE email = ?').get(row.email);
    if (user) {
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), user.id);
    } else if (superAdmin) {
      await db.prepare('UPDATE super_admins SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), superAdmin.id);
    }
    res.json({ success: true, message: 'Password reset. You can now sign in.' });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/verify-email - Public: verify email with token (TRUTH #158)
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }
    const emp = await db.prepare('SELECT id, email_verification_token_expires FROM employees WHERE email_verification_token = ? AND deleted_at IS NULL').get(token);
    if (!emp) {
      return res.status(404).json({ error: 'Invalid or expired verification link' });
    }
    const now = new Date().toISOString();
    if (emp.email_verification_token_expires && emp.email_verification_token_expires < now) {
      return res.status(410).json({ error: 'Verification link has expired. Request a new one from the login page.' });
    }
    await db.prepare('UPDATE employees SET email_verified_at = ?, email_verification_token = NULL, email_verification_token_expires = NULL WHERE id = ?').run(now, emp.id);
    res.json({ success: true, message: 'Email verified. You can now sign in.' });
  } catch (e) {
    console.error('Verify email error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/resend-verification - Public: resend verification email (rate limit 3/hour per email)
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const emailLower = email.trim().toLowerCase();
    const emp = await db.prepare('SELECT id, user_email, organization_id FROM employees WHERE LOWER(user_email) = ? AND (email_verified_at IS NULL OR email_verified_at = "") AND status = ? AND deleted_at IS NULL').get(emailLower, 'active');
    if (!emp) {
      return res.json({ success: true, message: 'If that account exists and is unverified, a new verification email was sent.' });
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const count = (await db.prepare('SELECT COUNT(*) as c FROM verification_resend_log WHERE email = ? AND sent_at > ?').get(emailLower, oneHourAgo))?.c ?? 0;
    if (count >= 3) {
      return res.status(429).json({ error: 'Too many verification emails. Try again in an hour.' });
    }
    const newToken = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.prepare('UPDATE employees SET email_verification_token = ?, email_verification_token_expires = ? WHERE id = ?').run(newToken, expiresAt, emp.id);
    const logId = uuidv4();
    await db.prepare('INSERT INTO verification_resend_log (id, email, sent_at) VALUES (?, ?, ?)').run(logId, emailLower, new Date().toISOString());
    const orgRow = await db.prepare('SELECT name FROM organizations WHERE id = ?').get(emp.organization_id);
    const verificationLink = `${FRONTEND_URL}/VerifyEmail?token=${newToken}`;
    await sendVerificationEmail({ to: emp.user_email, verificationLink, orgName: orgRow?.name });
    res.json({ success: true, message: 'If that account exists and is unverified, a new verification email was sent.' });
  } catch (e) {
    console.error('Resend verification error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/request-approval-again - Public: rejected org requests new approval (rate limited)
router.post('/request-approval-again', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
    const emp = await db.prepare('SELECT * FROM employees WHERE LOWER(user_email) = ? AND permission_level = ? AND deleted_at IS NULL').get(email.trim().toLowerCase(), 'org_admin');
    if (!emp) return res.status(404).json({ error: 'No organization found for this email' });
    const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(emp.organization_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (org.status !== 'rejected') {
      return res.status(400).json({ error: org.status === 'pending_approval' ? 'Already pending approval' : 'Organization is active' });
    }
    const lastSent = org.last_approval_email_sent_at;
    if (lastSent) {
      const diffMs = Date.now() - new Date(lastSent).getTime();
      if (diffMs < APPROVAL_EMAIL_COOLDOWN_MINUTES * 60 * 1000) {
        const minsLeft = Math.ceil((APPROVAL_EMAIL_COOLDOWN_MINUTES * 60 * 1000 - diffMs) / 60000);
        return res.status(429).json({ error: `Please wait ${minsLeft} minutes before requesting again.` });
      }
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare('UPDATE organizations SET status = ?, approval_token = ?, approval_token_expires_at = ? WHERE id = ?').run(
      'pending_approval', token, expiresAt, org.id
    );
    await sendApprovalEmailIfAllowed(org.id, org.name, emp.user_email, emp.full_name);
    res.json({ success: true, message: 'Approval request sent. You will be notified when approved.' });
  } catch (e) {
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

async function validateInviteToken(token) {
  if (!token || typeof token !== 'string') return null;
  const invite = await db.prepare('SELECT * FROM invites WHERE token = ? AND deleted_at IS NULL').get(token);
  if (!invite) return null;
  if (invite.used_at) return { error: 'Invite already used' };
  const now = new Date().toISOString();
  if (invite.expires_at < now) return { error: 'Invite expired' };
  const org = await db.prepare('SELECT id, name FROM organizations WHERE id = ?').get(invite.organization_id);
  return { valid: true, email: invite.email, full_name: invite.full_name || '', role: invite.role || '', location_id: invite.location_id || null, org_name: org?.name || '' };
}

// GET (legacy) /api/auth/invites/validate?token=xxx - Public: validate invite token
router.get('/invites/validate', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }
    const result = await validateInviteToken(token);
    if (!result) return res.status(404).json({ error: 'Invite not found or invalid' });
    if (result.error) return res.status(410).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Invite validate error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/invites/validate - Public: validate invite token (prefer over GET to avoid token in URL)
router.post('/invites/validate', async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token required' });
    const result = await validateInviteToken(token);
    if (!result) return res.status(404).json({ error: 'Invite not found or invalid' });
    if (result.error) return res.status(410).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Invite validate error:', e);
    res.status(500).json({ error: safeErrorMsg(e) });
  }
});

// POST /api/auth/invites/accept - Public: accept invite with Google credential or email/password
router.post('/invites/accept', async (req, res) => {
  try {
    const { token, credential, password, full_name, first_name, last_name } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }
    const invite = await db.prepare('SELECT * FROM invites WHERE token = ? AND deleted_at IS NULL').get(token);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or invalid' });
    }
    if (invite.used_at) {
      return res.status(410).json({ error: 'Invite already used' });
    }
    const now = new Date().toISOString();
    if (invite.expires_at < now) {
      return res.status(410).json({ error: 'Invite expired' });
    }

    let email, name, authProvider = 'email';
    if (credential && typeof credential === 'string') {
      const payload = await verifyGoogleToken(credential);
      email = payload.email;
      name = (payload.name || email).trim().slice(0, 200);
      authProvider = 'google';
      if (email.toLowerCase() !== invite.email.toLowerCase()) {
        return res.status(403).json({ error: 'Google account email must match the invited email' });
      }
    } else if (password && typeof password === 'string') {
      email = invite.email;
      const resolvedFirst = (first_name || '').trim();
      const resolvedLast = (last_name || '').trim();
      name = (full_name || [resolvedFirst, resolvedLast].filter(Boolean).join(' ') || invite.full_name || email).trim().slice(0, 200);
      const pwErr = validatePasswordStrength(password);
      if (pwErr) {
        return res.status(400).json({ error: pwErr });
      }
    } else {
      return res.status(400).json({ error: 'Provide credential (Google) or password' });
    }

    const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const existingEmp = await db.prepare('SELECT * FROM employees WHERE organization_id = ? AND user_email = ? AND deleted_at IS NULL').get(invite.organization_id, email);

    const verificationToken = !existingEmp && authProvider === 'email' ? randomBytes(64).toString('hex') : null;
    const verificationExpires = verificationToken ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    let userId;
    await db.transaction(async () => {
      if (existingUser) {
        userId = existingUser.id;
        if (authProvider === 'email') {
          await db.prepare('UPDATE users SET password_hash = ?, full_name = ? WHERE id = ?').run(hashPassword(password), name, userId);
        }
      } else {
        userId = uuidv4();
        const pwHash = authProvider === 'google' ? hashPassword(uuidv4()) : hashPassword(password);
        await db.prepare('INSERT INTO users (id, email, password_hash, full_name, auth_provider) VALUES (?, ?, ?, ?, ?)').run(
          userId, email, pwHash, name, authProvider
        );
      }

      if (!existingEmp) {
        const empId = uuidv4();
        const hireDate = new Date().toISOString().split('T')[0];
        if (authProvider === 'google') {
          await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, location_id, permission_level, status, hire_date, email_verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            empId, invite.organization_id, email, name || email, invite.role || '', invite.location_id || null,
            'employee', 'active', hireDate, now
          );
        } else {
          await db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, location_id, permission_level, status, hire_date, email_verification_token, email_verification_token_expires)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            empId, invite.organization_id, email, name || email, invite.role || '', invite.location_id || null,
            'employee', 'active', hireDate, verificationToken, verificationExpires
          );
        }
      }

      await db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(now, invite.id);
    })();

    if (!existingEmp && authProvider === 'email') {
      const orgRow = await db.prepare('SELECT name FROM organizations WHERE id = ?').get(invite.organization_id);
      const verificationLink = `${FRONTEND_URL}/VerifyEmail?token=${verificationToken}`;
      await sendVerificationEmail({ to: email, verificationLink, orgName: orgRow?.name });
      return res.json({
        success: true,
        requireVerification: true,
        message: 'Check your email to verify your account before logging in.',
      });
    }

    const tokenJwt = createToken(userId, email);
    const userRow = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const { org, employee } = await getEmployeeContext(userRow?.email ?? email);
    res.json({
      token: tokenJwt,
      user: { email, full_name: name },
      org,
      employee,
    });
  } catch (e) {
    console.error('Invite accept error:', e);
    res.status(500).json({ error: safeErrorMsg(e) || 'Accept failed' });
  }
});

export { router as authRouter };
