# PolicyVault — Formal Technical Audit (Engineering Blueprint)

**Application identity:** HR Policy and Handbook app. Handles AI-assisted policy generation, employee digital acknowledgment of policies with legally defensible timestamps, incident reporting, and employee file management. Record integrity and immutability are primary design requirements.

**Audit standard:** Every statement references actual artifacts (file names, table/column names, route paths, function names, env vars, package versions). Where something is absent or uncertain, it is stated explicitly.

---

════════════════════════════════════════
LAYER 1 — PRODUCTION AND LIVE STATUS
════════════════════════════════════════

**Is any part of this app currently running in production or accessible at a live URL?**
- **No.** There is no evidence in the codebase of a production deployment, live URL, or deployment pipeline. No production URL is configured; `FRONTEND_URL` in `server/.env.example` defaults to `http://localhost:5173`.

**Environment / access / data:**
- N/A — nothing is in production.

**Most recent deployment / what broke:**
- Not applicable. No deployment history is present in the repo (no `.github/workflows` in project root, no Dockerfile, no deploy scripts).

**Current state of the build:**
- **Local only; ready to deploy.** The app runs locally: client (`Handbook Policy App`) builds with Vite (`npm run build` → `Handbook Policy App/dist/`); server runs with Node (`server/server.js` on `PORT` default 3001). Static assets are served from `server/../Handbook Policy App/dist` when that path exists. `DEPLOYMENT.md` describes same-origin and split deployment; no automated deploy or hosting platform is configured in-repo.

**Evidence:** `server/server.js` (lines 73–80) serves `clientDist = join(__dirname, '..', 'Handbook Policy App', 'dist')` if it exists; `DEPLOYMENT.md` exists; no CI/CD or Docker in project root.

---

════════════════════════════════════════
LAYER 2 — FOUNDATION: DATA AND STORAGE
════════════════════════════════════════

**Database type and version:**
- **SQLite**, via **better-sqlite3** (version **^11.6.0** in `server/package.json`). No explicit SQLite binary version is pinned; the engine is whatever better-sqlite3 links against.

**Hosting provider and plan:**
- Database is **file-based**. Path: `server/data/policyvault.db` (see `server/lib/db.js` line 6: `dbPath = join(__dirname, '..', 'data', 'policyvault.db')`). No remote DB host; no hosting provider for the DB.

**Connection method:**
- Synchronous file open: `export const db = new Database(dbPath)` in `server/lib/db.js`. No connection string; no connection pool.

**Tables (exact names and schema):**
- All tables are created in `server/scripts/init-db.js`. Schema is fixed in that file; no separate migration files.

| Table | Columns (name, type, nullable/default, constraints) |
|-------|------------------------------------------------------|
| **users** | id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT, auth_provider TEXT DEFAULT 'email', created_at TEXT DEFAULT (datetime('now')) |
| **super_admins** | id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **organizations** | id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT, settings TEXT, status TEXT DEFAULT 'pending_approval', created_at TEXT DEFAULT (datetime('now')). Migrations add: approval_token, approval_token_expires_at, last_approval_email_sent_at, deleted_at (all TEXT) |
| **platform_locations** | id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, created_by_email TEXT, created_at TEXT DEFAULT (datetime('now')). Migration adds deleted_at TEXT |
| **locations** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, address TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **employees** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), user_email TEXT NOT NULL, full_name TEXT, role TEXT, department TEXT, location_id TEXT REFERENCES locations(id), permission_level TEXT DEFAULT 'employee', status TEXT DEFAULT 'active', hire_date TEXT, phone_number TEXT, email_reminders INTEGER DEFAULT 0, sms_reminders INTEGER DEFAULT 0, tags TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(organization_id, user_email) |
| **policies** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'draft', current_version INTEGER DEFAULT 0, draft_content TEXT, applies_to TEXT, acknowledgment_required INTEGER DEFAULT 1, handbook_category TEXT, handbook_id TEXT, created_at TEXT, updated_at TEXT DEFAULT (datetime('now')) |
| **policy_versions** | id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id), version_number INTEGER NOT NULL, content TEXT NOT NULL, is_locked INTEGER DEFAULT 1, change_summary TEXT, effective_date TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **acknowledgments** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, policy_version_id TEXT NOT NULL, policy_title TEXT, version_number INTEGER, employee_id TEXT NOT NULL, employee_name TEXT, employee_email TEXT, employee_role_at_time TEXT, employee_location_at_time TEXT, acknowledged_at TEXT NOT NULL, content_hash TEXT NOT NULL, is_locked INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) |
| **pending_re_acknowledgments** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, employee_id TEXT NOT NULL, version_number INTEGER, previous_version_number INTEGER, created_at TEXT DEFAULT (datetime('now')) |
| **handbooks** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'draft', policy_sections TEXT, source TEXT, created_by_email TEXT, created_by_name TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **onboardings** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT, employee_email TEXT, assigned_policy_ids TEXT, completed_policy_ids TEXT, due_date TEXT, start_date TEXT, completed_date TEXT, status TEXT DEFAULT 'not_started', reminder_sent_count INTEGER DEFAULT 0, last_reminder_date TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **hr_records** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, record_type TEXT DEFAULT 'write_up', title TEXT, description TEXT, status TEXT DEFAULT 'submitted', is_locked INTEGER DEFAULT 0, severity TEXT, discipline_level INTEGER, created_by_email TEXT, created_at TEXT, updated_at TEXT. Migrations add acknowledged_at, acknowledged_by_email |
| **incident_reports** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, title TEXT, description TEXT, status TEXT DEFAULT 'submitted', is_locked INTEGER DEFAULT 0, attachments TEXT, admin_notes TEXT, incident_type TEXT, incident_date TEXT, location_id TEXT, severity TEXT, witnesses TEXT, created_by_email TEXT, created_at TEXT (datetime('now','utc')), updated_at TEXT. Migrations add acknowledged_at, acknowledged_by_email |
| **amendments** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, record_id TEXT NOT NULL, record_type TEXT NOT NULL, field_changed TEXT, old_value TEXT, new_value TEXT, amended_by_email TEXT, amendment_note TEXT, created_at TEXT DEFAULT (datetime('now','utc')) |
| **system_events** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, event_type TEXT NOT NULL, entity_type TEXT, entity_id TEXT, actor_email TEXT, actor_name TEXT, summary TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **policy_targeting_overrides** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, override_type TEXT NOT NULL, employee_id TEXT, role TEXT, location_id TEXT, applies INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) |
| **invites** | id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, email TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, created_by_email TEXT, full_name TEXT, role TEXT, location_id TEXT, used_at TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **password_reset_tokens** | id TEXT PRIMARY KEY, email TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT DEFAULT (datetime('now')) |

**Indexes (exact names and columns):**
- `idx_employees_org` ON employees(organization_id)
- `idx_employees_email` ON employees(user_email)
- `idx_policies_org` ON policies(organization_id)
- `idx_acknowledgments_emp` ON acknowledgments(employee_id)
- `idx_acknowledgments_policy` ON acknowledgments(policy_id)
- `idx_system_events_org` ON system_events(organization_id)
- `idx_amendments_org` ON amendments(organization_id)
- (Migration) `idx_amendments_org` on amendments(organization_id) if added by migration

**Foreign keys:**
- locations.organization_id → organizations(id) (no ON DELETE specified in schema)
- employees.organization_id → organizations(id), employees.location_id → locations(id)
- policies.organization_id → organizations(id)
- policy_versions.policy_id → policies(id)
- No CASCADE defined; referential integrity is by application logic.

**Migration system:**
- **No formal migration tool.** `server/scripts/init-db.js` uses `CREATE TABLE IF NOT EXISTS` and then inline blocks that run `PRAGMA table_info(...)` and `ALTER TABLE ... ADD COLUMN` for amendments (organization_id, amendment_note), incident_reports (admin_notes, incident_type, etc.), users (auth_provider), employees (phone_number, email_reminders, sms_reminders), invites (full_name, role, location_id, used_at), organizations (status, approval_token*, deleted_at), platform_locations (deleted_at), hr_records and incident_reports (acknowledged_at, acknowledged_by_email), and password_reset_tokens table creation. There is **no** migration version table or version filename; "current version" is undefined. Pending migrations are not tracked.

**Data that should be in DB but is hardcoded:**
- Test org name `_TEST_Location_SuperAdmin` and test user password are in code (`server/routes/api.js` around lines 184–206, `server/scripts/test-e2e.js` uses env SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD). Default JWT secret for non-production is in `server/lib/auth.js`: `'policyvault-dev-secret-change-in-production'`. No other material business data was found hardcoded.

**Backup strategy:**
- **None.** No backup script, no scheduled job, no reference to backups in repo. The SQLite file at `server/data/policyvault.db` is only as safe as the host’s filesystem and any external backup policy.

**State / concerns:**
- Schema is clear and supports multi-tenant orgs, policies, versions, acknowledgments, HR records, incidents, amendments, and system_events. **Gap:** `entity-write` when creating HRRecord does not insert `severity` or `discipline_level` (see `server/routes/api.js` lines 529–533); the table has these columns but they remain NULL on create. **Gap:** Activity log endpoint ignores `skip`, `search`, and `event_type_prefix` (frontend sends them; backend uses only `organization_id` and `limit`).

---

════════════════════════════════════════
LAYER 3 — STRUCTURAL FRAME: BACKEND ARCHITECTURE
════════════════════════════════════════

**Language and version:**
- **JavaScript (ES modules).** No Node version pinned in repo (no `.nvmrc` or engines in package.json). Server uses `import`/`export` and `"type": "module"` in `server/package.json`.

**Framework and version:**
- **Express** **^4.21.1** (`server/package.json`).

**Top-level backend structure (exact):**
- `server/server.js` — entry
- `server/routes/auth.js`, `server/routes/api.js`
- `server/lib/db.js`, `server/lib/auth.js`, `server/lib/email.js`
- `server/scripts/init-db.js`, `server/scripts/seed-super-admin.js`, `server/scripts/test-e2e.js`, `server/scripts/test-smoke-launch.js`, `server/scripts/test-health.js`
- `server/data/` — created at runtime; contains `policyvault.db`

**Server entry point:**
- **File:** `server/server.js`. On startup it: sets trust proxy; mounts request-id middleware; helmet (contentSecurityPolicy: false); CORS; express.json(500kb); GET /api/health; rate limits for auth and /api; mounts authRouter at /api/auth, apiRouter at /api; global error handler; serves static from `../Handbook Policy App/dist` if present and SPA fallback; ensures `server/data` exists; listens on PORT.

**Port and configuration:**
- **PORT** from `process.env.PORT` or **3001** (`server/server.js` line 18).

**Environment variables (backend):**
- **PORT** — server port; default 3001.
- **NODE_ENV** — production vs development; used for CORS, error messages, JWT_SECRET requirement.
- **JWT_SECRET** — required in production; server exits if unset (`server/lib/auth.js` lines 6–9).
- **FRONTEND_URL** — base URL for invite/reset/launch links; default `http://localhost:5173`.
- **CORS_ORIGINS** — comma-separated origins in production; default from FRONTEND_URL.
- **GOOGLE_CLIENT_ID** — optional; Google Sign-In.
- **SUPER_ADMIN_EMAIL**, **SUPER_ADMIN_PASSWORD** — optional; E2E/CI and seed script.
- **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS**, **SMTP_FROM**, **SMTP_SECURE** — optional; when unset, email is logged to console (`server/lib/email.js`).

**Dependencies (server):**
- bcryptjs ^2.4.3, better-sqlite3 ^11.6.0, cors ^2.8.5, express ^4.21.1, express-rate-limit ^8.3.0, google-auth-library ^10.6.1, helmet ^8.1.0, jsonwebtoken ^9.0.2, nodemailer ^8.0.1, uuid ^11.0.3 (`server/package.json`).

**Start commands:**
- **Development:** `npm run dev` → `node --watch server.js` (from server folder).
- **Production:** `npm start` → `node server.js`. Client build is separate: `npm run build` in `Handbook Policy App`; server then serves `Handbook Policy App/dist` if present.

---

════════════════════════════════════════
LAYER 4 — PLUMBING: ROUTES AND ENDPOINTS
════════════════════════════════════════

**Auth routes** (mount path `/api/auth`, from `server/routes/auth.js`). All are **public** unless noted; rate limits applied in `server/server.js` as listed.

| Method | Path | Handler | Auth | Rate limit | Behavior |
|--------|------|---------|------|------------|----------|
| POST | /api/auth/register | register | None | 10/min | Create user, org (pending_approval), employee; send approval email. |
| POST | /api/auth/login | login | None | 5/min | Email/password; super_admin or org context; returns token, user, org, employee. |
| POST | /api/auth/google | google login | None | (general 100/min) | Verify Google ID token; return token + context or 404 needSignup. |
| POST | /api/auth/google-register | google register | None | (general) | Create user (auth_provider=google), org pending, employee; send approval email. |
| GET | /api/auth/approve-org/validate | query.token | None | — | Validate approval token; return org_name, admin. |
| POST | /api/auth/approve-org/validate | body.token | None | — | Same via body. |
| POST | /api/auth/approve-org | body token, action | None | 10/min | approve or deny org. |
| POST | /api/auth/forgot-password | body email | None | 10/min | Insert password_reset_tokens; send email. |
| POST | /api/auth/reset-password | body token, new_password | None | 10/min | Consume token; update users or super_admins password. |
| POST | /api/auth/request-approval-again | body email | None | 10/min | Re-pend rejected org; resend approval email. |
| GET | /api/auth/invites/validate | query token | None | — | Validate invite token. |
| POST | /api/auth/invites/validate | body token | None | — | Same via body. |
| POST | /api/auth/invites/accept | body token, credential or password | None | 10/min | Accept invite (Google or password); create/update user and employee. |

**API routes** (mount path `/api`, from `server/routes/api.js`). All use **authMiddleware** (JWT Bearer) unless stated. `getContext(req)` provides org/employee (or super admin + optional impersonation).

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | /api/health | None | SELECT 1; returns { ok, db } or 503. |
| GET | /api/me | JWT | Returns org, employee (or super admin / impersonation context). |
| POST | /api/super-admin/pending-orgs | JWT + super admin | List orgs status=pending_approval. |
| POST | /api/super-admin/approve-org | JWT + super admin | Set org status=active. |
| POST | /api/super-admin/reject-org | JWT + super admin | Set org status=rejected. |
| POST | /api/super-admin/archive-org | JWT + super admin | Set organizations.deleted_at. |
| POST | /api/super-admin/platform-locations | JWT + super admin | List platform_locations (deleted_at IS NULL). |
| POST | /api/super-admin/delete-platform-location | JWT + super admin | Soft-delete platform_locations. |
| POST | /api/super-admin/create-location | JWT + super admin | Insert platform_locations. |
| POST | /api/super-admin/all-orgs | JWT + super admin | List all orgs. |
| POST | /api/super-admin/orgs-with-locations | JWT + super admin | Active orgs + locations. |
| POST | /api/super-admin/launch-token | JWT + super admin | JWT with impersonateOrgId, 1h; return launch link. |
| POST | /api/super-admin/ensure-test-org | JWT + super admin | Create _TEST_Location_SuperAdmin org if missing. |
| POST | /api/account/change-password | JWT | Verify current password; update users or super_admins. |
| POST | /api/account/change-email | JWT (org user) | Verify password; update users.email and employees.user_email. |
| POST | /api/account/update-profile | JWT | Update employees (and users full_name) or super_admins full_name. |
| POST | /api/admin-context | JWT + org admin | Locations, employees, policies, overrides, optional onboardings/amendments. |
| POST | /api/applicable-policies | JWT | Policies applicable to given employee_id (targeting). |
| POST | /api/policies-for-employee | JWT | Policies for current user (admin: all; else filtered). |
| POST | /api/create-acknowledgment | JWT | Create acknowledgment row; policy version content_hash; system_events. |
| POST | /api/entity-write | JWT | create/update/amend/delete for Policy, Handbook, Onboarding, Location, PolicyTargetingOverride, HRRecord, IncidentReport. |
| POST | /api/employee-write | JWT + org admin | create/update/delete employees. |
| POST | /api/publish-policy | JWT + org admin | Insert policy_versions, set policies.status=active; pending_re_acknowledgments. |
| POST | /api/handbook-data | JWT | list_handbooks, get_policy_version, get_handbook_version, get. |
| POST | /api/my-onboarding | JWT | Onboarding + assigned policies + pending_re_acknowledgments. |
| POST | /api/my-acknowledgments | JWT | acknowledgments + pending_re_acknowledgments. |
| POST | /api/policy-for-employee | JWT | Single policy + current version. |
| POST | /api/activity-log | JWT + org admin | system_events for org (limit only; skip/search/event_type_prefix ignored). |
| POST | /api/acknowledgement-matrix | JWT + org admin | Matrix employees × policies with ack status. |
| POST | /api/invites/create | JWT + org admin | Insert invite; return invite_link. |
| POST | /api/invites/list | JWT + org admin | List invites for org. |
| POST | /api/send-onboarding-reminder | JWT + org admin | Increment reminder_sent_count. |
| POST | /api/org-write | JWT + org admin | update Organization; create/delete Location; create/delete PolicyTargetingOverride. |
| POST | /api/manage-policy-lifecycle | JWT + org admin | archive policy. |
| POST | /api/hr-records | JWT | List hr_records (admin: all or by employee_id; else own). |
| POST | /api/incident-reports | JWT | List incident_reports + amendments_incident. |
| POST | /api/secure-incident-write | JWT | create incident; update_notes/update_attachments + amendments. |
| POST | /api/locations | JWT | List locations for org. |
| POST | /api/policy | JWT | Single policy by id. |
| POST | /api/policy-versions | JWT | All versions for policy_id. |
| POST | /api/manage-hr-lifecycle | JWT + org admin | Update status (and is_locked for resolved/dismissed); amendment. |
| POST | /api/acknowledge-hr-record | JWT | Set acknowledged_at/acknowledged_by_email on own record. |
| POST | /api/system-event | JWT | Insert system_events (actor from server). |
| POST | /api/system-events | JWT | Query system_events (entity_id, event_type, limit). |
| POST | /api/policy-update | JWT + org admin | Update policy status. |
| POST | /api/verify-acknowledgment | JWT | Compare content_hash to current version content. |
| POST | /api/export-org-data | JWT + org admin | Full org data JSON. |
| POST | /api/employee-profile | JWT | Employee + location by employee_id. |

**Frontend invoke map** (`Handbook Policy App/src/api/client.js`): `getEmployeeContext`→GET /me; `getAdminContext`→POST /admin-context; `getApplicablePolicies`→POST /applicable-policies; `getPoliciesForEmployee`→POST /policies-for-employee; `createSecureAcknowledgment`→POST /create-acknowledgment; `secureEntityWrite`→POST /entity-write; `secureEmployeeWrite`→POST /employee-write; `secureOrgWrite`→POST /org-write; `publishPolicy`→POST /publish-policy; `managePolicyLifecycle`→POST /manage-policy-lifecycle; `getHandbookData`→POST /handbook-data; `getMyOnboarding`→POST /my-onboarding; `getMyAcknowledgments`→POST /my-acknowledgments; `getPolicyForEmployee`→POST /policy-for-employee; `getActivityLog`→POST /activity-log; `getAcknowledgementMatrix`→POST /acknowledgement-matrix; `sendOnboardingReminder`→POST /send-onboarding-reminder; `getHRRecords`→POST /hr-records; `getIncidentReports`→POST /incident-reports; `getEmployeeProfile`→POST /employee-profile; `secureIncidentWrite`→POST /secure-incident-write; `manageHRRecordLifecycle`→POST /manage-hr-lifecycle; `acknowledgeHRRecord`→POST /acknowledge-hr-record; `getLocations`→POST /locations; `getPolicy`→POST /policy; `getPolicyVersions`→POST /policy-versions; `createSystemEvent`→POST /system-event; `getSystemEvents`→POST /system-events; `updatePolicy`→POST /policy-update; `verifyAcknowledgment`→POST /verify-acknowledgment; `exportOrgData`→POST /export-org-data; plus account changePassword/changeEmail/updateProfile mapped to same routes. `sendPolicyReminders` and `guardAiUsage` are client stubs (no server implementation).

**Defined but not implemented / partial:**
- Activity log: frontend sends `skip`, `search`, `event_type_prefix`; server uses only `limit` (and organization_id). Pagination and filtering are not implemented server-side.

---

════════════════════════════════════════
LAYER 5 — BUSINESS LOGIC: SERVICES AND MODULES
════════════════════════════════════════

| File | Responsibility | Reads/Writes | External | State |
|------|----------------|--------------|----------|--------|
| **server/lib/db.js** | DB connection and JSON helpers | — | — | Exports `db`, `parseJson`, `stringifyJson`. |
| **server/lib/auth.js** | JWT create/verify, bcrypt hash/verify, authMiddleware, getEmployeeContext, getOrgContextByOrgId | users, super_admins, employees, organizations | — | JWT_SECRET required in prod. |
| **server/lib/email.js** | sendEmail, sendPasswordReset, sendOrgApprovalNotification | — | Nodemailer (SMTP if configured) | If SMTP_HOST unset, logs to console. |
| **server/routes/auth.js** | All auth flows (register, login, Google, approve-org, forgot/reset password, invite validate/accept) | users, super_admins, organizations, employees, locations, invites, password_reset_tokens | Google ID token verify, email | Complete. |
| **server/routes/api.js** | All authenticated API: context, policies, acknowledgments, entity-write, employee-write, org-write, publish-policy, handbooks, onboarding, activity, invites, HR/incident lifecycle, system_events, export | All tables | — | HRRecord create omits severity/discipline_level. Activity log ignores skip/search/event_type_prefix. |

**Background jobs / scheduled tasks:**
- **None.** No cron, no job queue, no scheduled tasks in the codebase.

**Data transformation:**
- `parseJson` / `stringifyJson` in `server/lib/db.js` for TEXT columns (settings, tags, applies_to, policy_sections, assigned_policy_ids, etc.). Policy targeting and applicability: in `server/routes/api.js` (applicable-policies, policies-for-employee, create-acknowledgment, publish-policy) using `applies_to` JSON and policy_targeting_overrides.

**Calculation logic:**
- Content hash for acknowledgments: `createHash('sha256').update(version.content || '').digest('hex')` in `server/routes/api.js` (create-acknowledgment). Verify-acknowledgment recomputes hash and compares. No other calculation modules.

---

════════════════════════════════════════
LAYER 6 — ELECTRICAL: AUTH AND SECURITY
════════════════════════════════════════

**Authentication:**
- **Library:** **jsonwebtoken** ^9.0.2. Tokens: signed with `JWT_SECRET`; payload includes `userId`, `email`, and optionally `isSuperAdmin`, `impersonateOrgId`. Default expiry **7d** (createToken in `server/lib/auth.js`); launch token 1h. Validation: Bearer token in Authorization header; verifyToken; then load user from `users` or super_admin from `super_admins`; req.user and req.superAdmin/req.impersonateOrgId set. No refresh token; client stores token in localStorage key `policyvault_token` (see `Handbook Policy App/src/api/client.js`).

**Roles (exact names and enforcement):**
- **super_admin:** Exists in `super_admins` table. Can: all super-admin routes, launch into org. Enforced by `requireSuperAdmin` and payload `isSuperAdmin`.
- **org_admin:** `employees.permission_level === 'org_admin'`. Can: admin-context, entity-write (Policy, Handbook, etc.), employee-write, publish-policy, invites, org-write, activity-log, acknowledgement-matrix, manage-hr-lifecycle, export-org-data, policy-update. Enforced by `isAdmin(employee)` in api routes (e.g. `server/routes/api.js` line 379).
- **employee:** Default permission_level. Can: policies-for-employee, create-acknowledgment (self), my-onboarding, my-acknowledgments, secure-incident-write (create own), acknowledge-hr-record (own), getPolicyForEmployee, etc. Authorization: org_id and (where relevant) employee_id must match context; some routes restrict by isAdmin.

**Passwords:**
- **bcrypt** (bcryptjs ^2.4.3), **SALT_ROUNDS = 10** (`server/lib/auth.js`). Stored in `users.password_hash` and `super_admins.password_hash`. Google users get a placeholder hash; auth_provider='google' blocks email/password login.

**Secrets:**
- **JWT_SECRET** from env; no default in production (server exits). No API keys in code; Google uses GOOGLE_CLIENT_ID (public). SMTP credentials in env.

**Security middleware:**
- **helmet** (contentSecurityPolicy: false). **cors** (origin from CORS_ORIGINS or FRONTEND_URL in prod, credentials: true). **express-rate-limit**: login 5/min; register, forgot-password, approve-org, invites/accept, reset-password, request-approval-again 10/min; /api 100/min. **express.json({ limit: '500kb' })**. **trust proxy** set to 1.

**Gaps / concerns:**
- Token in localStorage is vulnerable to XSS; no httpOnly cookie option. Password reset and invite tokens in URL (GET approve-org/validate, invites/validate) can leak via Referer; ResetPassword page moves token to sessionStorage and clears query (good). No CSRF tokens (rely on CORS + SameSite). No explicit rate limit on /api/me or other read-heavy endpoints beyond the global 100/min.

---

════════════════════════════════════════
LAYER 7 — HVAC: EXTERNAL INTEGRATIONS
════════════════════════════════════════

| Integration | Purpose | Connection | Credentials | If unavailable | Status |
|-------------|---------|------------|-------------|----------------|--------|
| **Google Sign-In** | Login and invite accept | google-auth-library verifyIdToken | GOOGLE_CLIENT_ID (env) | 401/500 to client | Working when GOOGLE_CLIENT_ID set. |
| **SMTP (Nodemailer)** | Password reset, org approval emails | nodemailer createTransport | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | When unset, logs to console; no error to user | Partial: optional; no send on failure handling. |
| **Base44** | Referenced in client (SmartGeneratorDialog, ApprovalWorkflow) | @base44/sdk createClient in `Handbook Policy App/src/api/base44Client.js` | appParams (VITE_BASE44_*, from lib/app-params) | Not wired to server; guardAiUsage is client stub | Partial: SDK present; server has no Base44; guardAiUsage returns allowed. |
| **OpenAI / LLM** | Policy AI (invokeLLM) | — | — | api.invokeLLM in client returns '' and logs warning | Not built: stub in `Handbook Policy App/src/api/client.js` (invokeLLM). |

**Webhooks:** None.

**SDKs:** @base44/sdk ^0.8.18, @react-oauth/google ^0.13.4 (client); google-auth-library ^10.6.1 (server). No Stripe usage in routes despite @stripe packages in client.

---

════════════════════════════════════════
LAYER 8 — INTERIOR: FRONTEND ARCHITECTURE
════════════════════════════════════════

**Framework:** **React** ^18.2.0. **Vite** ^6.1.0 (`Handbook Policy App/package.json`). **Web app only** (no mobile or Electron in repo).

**Top-level frontend structure (relevant):**
- `Handbook Policy App/src/App.jsx` — Router, AuthProvider, routes.
- `Handbook Policy App/src/main.jsx` — entry.
- `Handbook Policy App/src/Layout.jsx` — sidebar, logout, layout.
- `Handbook Policy App/src/pages.config.js` — page map and mainPage.
- `Handbook Policy App/src/pages/*.jsx` — 28 page components.
- `Handbook Policy App/src/lib/AuthContext.jsx`, `Handbook Policy App/src/components/hooks/useOrganization.jsx`, `usePermissions.jsx`.
- `Handbook Policy App/src/api/client.js` — API client and invoke map.
- `Handbook Policy App/src/utils/index.ts` — createPageUrl.
- `Handbook Policy App/src/components/ui/*` — shadcn-style UI.
- `Handbook Policy App/vite.config.js` — base, alias @ to src, proxy /api to localhost:3001.

**State management:** No Redux. **AuthContext** (`src/lib/AuthContext.jsx`) holds user, org, employee, superAdmin, superAdminImpersonating, isAuthenticated, isLoadingAuth, authError, login, loginWithGoogle, register, registerWithGoogle, logout, checkAuth, refreshContext. **useOrg** wraps AuthContext and exposes org, employee, loading, refreshOrg, logout. **usePermissions** derives isAdmin, isOrgAdmin, etc. from employee. **@tanstack/react-query** ^5.84.1 is present (queryClientInstance in `src/lib/query-client`) but most data fetching is ad hoc useState + useEffect + api.invoke.

**Navigation:** **react-router-dom** ^6.26.0. Routes in `App.jsx`: /Login, /Setup, /InviteAccept, /ApproveOrg, /ForgotPassword, /ResetPassword, /RequestApprovalAgain, /ForgotEmail, /Launch; then either redirect to /SuperAdmin (super admin) or Layout with / and /:page from pages.config. **createPageUrl** in `src/utils/index.ts` builds path with optional BASE (import.meta.env.BASE_URL). Router basename set from import.meta.env.BASE_URL.

**Backend communication:** **REST** (fetch). Base URL: `import.meta.env.VITE_API_URL || '/api'` (`Handbook Policy App/src/api/client.js`). All POST (except GET /me and GET /api/health). Token in localStorage; header `Authorization: Bearer <token>`.

**Frontend env vars:** **VITE_API_URL** (optional; default /api). **VITE_GOOGLE_CLIENT_ID** (optional). **VITE_BASE_URL** (optional; base path). **VITE_BASE44_*** (optional; Base44). Documented in `Handbook Policy App/.env.example`.

---

════════════════════════════════════════
LAYER 9 — ROOMS: SCREENS AND FEATURES
════════════════════════════════════════

| Component (file) | Displays | Actions | API calls | Status |
|------------------|----------|--------|-----------|--------|
| Login.jsx | Sign-in form, Google button | Login, Forgot password/Forgot email/Setup links | auth.login, auth.loginWithGoogle | Working. |
| Setup.jsx | Multi-step org signup | Register, Back steps | auth.register or registerWithGoogle | Working. |
| ForgotPassword.jsx | Email form, success message | Send reset, Back to Sign In | api.account.forgotPassword | Working. |
| ResetPassword.jsx | New password form | Reset, Back to Sign In | api.account.resetPassword | Working. |
| ForgotEmail.jsx | Info + links | Back to Sign In, Request approval again | — | Working. |
| RequestApprovalAgain.jsx | Email form | Request again, Back to Sign In | auth request-approval-again | Working. |
| InviteAccept.jsx | Invite form | Accept (password or Google) | invites/validate, invites/accept | Working. |
| ApproveOrg.jsx | Approve/deny org | Validate token, approve/deny | approve-org/validate, approve-org | Working. |
| Launch.jsx | Token in URL | Exchange launch token, redirect | /me with launch token | Working. |
| SuperAdmin.jsx | Pending orgs, approved orgs, platform locations, launch | Approve, reject, archive, launch, create location | super-admin/* | Working. |
| Dashboard.jsx | Stats, pending policies, links | — | getPoliciesForEmployee, getMyAcknowledgments, getIncidentReports, getActivityLog, getAdminContext, getMyOnboarding | Working; loadError + Retry. |
| Policies.jsx | Policy list, filters | Create, view, edit, archive | getPoliciesForEmployee, managePolicyLifecycle, secureEntityWrite | Working; loadError + Retry. |
| PolicyEditor.jsx | Policy form, versioning | Save, publish, archive, back | getPolicy, getPolicyVersions, entity-write, publish-policy, manage-policy-lifecycle | Working. |
| PolicyView.jsx | Single policy read-only | Back | getPolicyForEmployee | Working. |
| Handbook.jsx | Handbook list/sections | — | getHandbookData | Working; loadError + Retry. |
| Employees.jsx | Employee list, invite | Add, invite, edit | getAdminContext, secureEmployeeWrite, invites/create | Working; loadError + Retry. |
| EmployeeProfile.jsx | Profile, write-ups | Create write-up, acknowledge | getEmployeeProfile, getHRRecords, secureEntityWrite, acknowledgeHRRecord | Working. |
| HRRecords.jsx | HR records list | Add, filter, status, detail | getHRRecords, getAdminContext, secureEntityWrite, manageHRRecordLifecycle | Working; loadError + Retry. Severity/discipline_level not persisted on create. |
| Incidents.jsx | Incident list | Add, filter, status, notes | getIncidentReports, getLocations, secureIncidentWrite, manageHRRecordLifecycle | Working; loadError + Retry. |
| ActivityLog.jsx | Event list, pagination UI | — | getActivityLog (skip/search/type sent but ignored) | Working; server ignores pagination/filters. |
| AcknowledgementTracking.jsx | Matrix, export CSV | Export | getAcknowledgementMatrix | Working; loadError + Retry. |
| Onboarding.jsx | Onboarding list, create | Create, remind | getAdminContext, getPoliciesForEmployee, secureEntityWrite, sendOnboardingReminder | Working; loadError + Retry. |
| MyOnboarding.jsx | Own onboarding, policies | Acknowledge | getMyOnboarding, createSecureAcknowledgment | Working. |
| OrgSettings.jsx | Org name, industry, locations, roles, departments, tags | Save, add location, delete location | getAdminContext, secureOrgWrite | Working; loadError + Retry. |
| Profile.jsx | Account info, change password/email, profile form | Change password, change email, update profile | account.changePassword, changeEmail, updateProfile | Working. |
| ReAcknowledgmentManagement.jsx | Re-ack list, policies | Manage re-acks | getAdminContext, getPoliciesForEmployee, createSecureAcknowledgment | Working. |
| MyWriteUps.jsx | Own HR records | Acknowledge | getHRRecords (own) | Working. |
| AIHandbookGenerator.jsx | AI handbook flow | Generate, create handbook | getHandbookData, invokeLLM (stub), entity-write | Partial: LLM stub; Base44 guard stub. |

**Flows working end-to-end:** Login (email + Google), logout, register → approval → login, forgot password → reset, invite accept, super admin approve/reject/archive/launch, policy CRUD and publish, acknowledgments and re-ack, onboarding, HR records create/list/status/amend, incident create/list/notes, activity log (read), org settings, profile and change password/email.

**Partially implemented:** Activity log: pagination and filters not implemented server-side. HR record create: severity and discipline_level not saved. AI handbook: invokeLLM and guardAiUsage are stubs.

**Planned but no code:** No explicit “planned” feature list in repo; Stripe packages are installed but no payment routes or UI.

---

════════════════════════════════════════
LAYER 10 — INPUTS AND OUTPUTS
════════════════════════════════════════

**Inputs:** Form submissions (login, register, forgot password, reset password, invite accept, policy create/update, acknowledgment, HR record, incident, onboarding, org settings, profile, super admin actions) → POST to API with JSON. File upload: PolicyEditor/ImportCard uses file input and FileReader for text; no server upload endpoint for files (attachments on incidents are JSON-stored). No webhooks or scheduled pulls.

**Outputs:** API JSON responses. **Email:** password reset link, org approval notification (nodemailer; if SMTP unset, console only). **Exports:** AcknowledgementTracking CSV (client-side). export-org-data returns full org JSON (admin). No SMS, push, or print in code.

**Status:** All above inputs/outputs are implemented; email is optional (dev fallback to console).

---

════════════════════════════════════════
LAYER 11 — DATA INTEGRITY AND AUDIT
════════════════════════════════════════

**Soft delete:** Implemented for **organizations** (`deleted_at`), **platform_locations** (`deleted_at`). Queries filter `deleted_at IS NULL` where relevant. **employees** use status='inactive' (no deleted_at). No soft delete on policies (status=archived), hr_records, or incident_reports.

**Audit logging:** **system_events** table. Inserted from: create-acknowledgment (policy.acknowledged, with metadata ip_address, user_agent), publish-policy (policy.published), manage-policy-lifecycle (policy.archived). Columns: id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, created_at. Actor is always server-derived from JWT user. **amendments** table: immutable log for HR and incident changes (field_changed, old_value, new_value, amended_by_email, amendment_note, created_at).

**Immutability:** **policy_versions**, **acknowledgments**, **amendments**, **system_events** are never updated in code (insert-only). **hr_records** and **incident_reports** are updated (status, title, description, admin_notes, attachments, acknowledged_*) but changes are recorded in **amendments**. Lock: policy_versions.is_locked=1, acknowledgments.is_locked=1; hr_records/incident_reports have is_locked set when status is resolved/dismissed to block further edits.

**Timestamps:** created_at (and where present updated_at) set in app: `datetime('now')` or `datetime('now','utc')` in SQL. policy_versions has effective_date. acknowledgments has acknowledged_at (set at insert).

**Validation:** Server-side: isValidEmail, isValidPassword (auth); organization_id and employee_id checked against getContext; isAdmin checks; entity-write validates action and entity_type. Client-side: required fields and basic format (e.g. email type). Error responses: JSON `{ error: "..." }` or 4xx/5xx.

---

════════════════════════════════════════
LAYER 12 — DEVOPS AND BUILD
════════════════════════════════════════

**Hosting:** Not specified in repo. Deployment is described in DEPLOYMENT.md (same-origin or split); no platform or plan.

**Deploy method:** Manual (build client, run server). No CI/CD in project root (no `.github/workflows`, no other pipeline config). No Dockerfile or docker-compose in repo.

**Environment separation:** By env vars (NODE_ENV, JWT_SECRET, FRONTEND_URL, CORS_ORIGINS, etc.); no separate config files per environment.

**Monitoring / error tracking:** None. No Sentry, LogRocket, or similar. Errors logged with `console.error` in server; client has no global error reporting.

**Mobile:** N/A. No mobile build or app store submission.

**Containers:** None in project.

---

════════════════════════════════════════
LAYER 13 — KNOWN ISSUES AND TECHNICAL DEBT
════════════════════════════════════════

**Broken / missing:**
- **HR record create:** `entity-write` for HRRecord does not insert `severity` or `discipline_level` (table has columns; INSERT in `server/routes/api.js` lines 529–533 omits them).
- **Activity log:** Backend ignores `skip`, `search`, `event_type_prefix`; pagination and filtering in ActivityLog.jsx do not work server-side.
- **invokeLLM:** Stub returns empty string; AI policy generation does not call a real LLM.
- **TypeScript:** Full-project typecheck (`npm run typecheck:full`) fails (many UI/Radix typing errors); only `tsconfig.typecheck.json` (api, lib, utils) passes.

**Fragile / shortcuts:**
- **Migration story:** Inline ALTER in init-db.js; no versioning. Running init-db multiple times is safe (IF NOT EXISTS, add column if missing) but order of migrations is implicit and not tracked.
- **SQLite in production:** Single file; no replication, no connection pooling; concurrency and backup are operational concerns.
- **JWT in localStorage:** XSS can steal token; no httpOnly cookie or refresh flow.
- **Employee create (employee-write):** If user does not exist, server creates user with random password and does not send email (“In production: send email with temp password or magic link” comment in api.js).
- **Content hash for acknowledgments:** Stored at acknowledge time; verify-acknowledgment recomputes from current version. If policy version content were ever changed (it is not in code), hash would not match; currently policy_versions are insert-only so this is consistent.

**Scale / performance:**
- No pagination on several list endpoints (e.g. policies-for-employee returns all; activity-log has limit but no skip). Large orgs may see slow responses or large payloads.
- No caching layer; every request hits SQLite.

**Inconsistencies:**
- Naming: client uses camelCase for invoke (e.g. getActivityLog); server routes use kebab-case (activity-log). Documented in client invoke map.
- Some pages use loadError + Retry; others only loading + empty state (see FOUNDATION_AUDIT.md for which have been updated).

---

════════════════════════════════════════
LAYER 14 — ENGINEERING ASSESSMENT
════════════════════════════════════════

**Orientation for a new senior engineer:**
- Start with **DEPLOYMENT.md** and **ARCHITECTURE_AND_FOUNDATIONS.md** for deploy and flows. **FOUNDATION_AUDIT.md** for loading/error/empty and fixes. **TECHNICAL_AUDIT.md** (this doc) for schema, routes, and gaps.
- Backend: **server/server.js** → **server/routes/auth.js** and **server/routes/api.js**; **server/lib/auth.js**, **db.js**, **email.js**. DB schema and migrations in **server/scripts/init-db.js**.
- Frontend: **Handbook Policy App/src/App.jsx** (routes), **src/api/client.js** (invoke map and base URL), **src/lib/AuthContext.jsx** and **src/components/hooks/useOrganization.jsx**. Pages in **src/pages/**; layout and nav in **Layout.jsx** and **pages.config.js**.

**Overall health (1–10): 6.5.** Rationale: Clear separation of auth vs API, consistent use of JWT and org scoping, immutable audit tables and amendments, and content_hash on acknowledgments support defensibility. Gaps: HR record create missing severity/discipline_level, activity log filters/skip ignored, no migration versioning, no backup strategy, no production deployment or monitoring, and typecheck only passing on a subset.

**Single most important fix before real users:** **Persist severity and discipline_level on HR record create** (and optionally add a quick migration or comment so existing records can be updated if needed). This affects legal/HR accuracy of write-ups.

**Recommended next steps (engineering):**
1. Fix HR record create to include severity and discipline_level in INSERT.
2. Implement activity log skip/search/event_type_prefix (or document that only limit is supported and simplify frontend).
3. Add a migration version table and move init-db migrations into versioned steps (or adopt a migration tool).
4. Document or automate backup for server/data/policyvault.db.
5. Set up minimal CI (e.g. lint + typecheck + build + smoke) and a production-like deploy path.
6. Consider moving token to httpOnly cookie and CSRF for sensitive actions.

**Other concerns:** Base44 and invokeLLM are stubs; if product depends on AI, those need real implementations and error handling. No rate limit on export-org-data (large JSON); consider throttling or async export for large orgs.

---

## FINAL QUESTION: LEGAL DEFENSIBILITY OF RECORDS

**Requirement:** Records must be able to stand up in an employment dispute or legal proceeding (integrity and immutability).

**What is solid:**
- **Acknowledgments:** Insert-only table; **content_hash** (SHA-256 of policy version content) stored at acknowledge time; **verify-acknowledgment** endpoint allows verification that the hash matches the version content. **policy_versions** are insert-only and is_locked=1. **acknowledged_at** and employee/role/location at time are stored. **system_events** logs policy.acknowledged with actor and metadata (e.g. IP, user-agent). This supports “what was shown” and “who acknowledged when.”
- **HR records and incidents:** **amendments** table records every change (field, old_value, new_value, amended_by_email, amendment_note, created_at). Updates go through server; is_locked prevents further edits when resolved/dismissed. So change history exists and is append-only.
- **Policies:** Versioned; published content lives in policy_versions and is not overwritten. Draft edits stay in policies.draft_content until publish.

**What is missing or weak:**
- **HR record create:** **severity** and **discipline_level** are not saved. For write-ups, severity and level are often material; a lawyer could argue the record is incomplete or that the “real” severity was different. **Fix:** Add these fields to the entity-write INSERT for HRRecord.
- **Timestamp and timezone:** created_at uses `datetime('now')` (server local) or `datetime('now','utc')` in some tables. If servers are not UTC or timezone is not documented, “when” could be disputed. Explicit UTC and timezone documentation (or ISO with timezone) would strengthen.
- **No cryptographic signing:** Content hash proves content match but not “this org signed this at this time.” For higher assurance, consider signing acknowledgment or amendment records (e.g. with an org key or HSM). Not required for many disputes but may be requested in strict jurisdictions.
- **Retention and deletion policy:** No code or docs on how long records are kept, who can delete, or legal hold. Compliance officers typically expect a retention policy and audit of deletions.
- **Audit of reads:** system_events logs key writes; there is no audit of who read what (e.g. viewing an HR record). For strict compliance, read access to sensitive records may need to be logged.

**What a lawyer or compliance officer might flag:**
1. **Incomplete HR records** (severity/discipline_level not stored) — fix before production.
2. **No formal retention/legal-hold policy** in product or docs.
3. **Timestamp consistency** — document and standardize on UTC.
4. **Proof of delivery** — acknowledgments have content_hash and timestamp; they may ask for additional proof (e.g. email receipt or signed receipt) depending on jurisdiction.
5. **Access and audit trail** — who accessed what and when (read audit) may be requested in discovery; not implemented today.

Overall, the implementation is **reasonably strong** for a first release: immutable audit trail, content hash on acknowledgments, and amendment history on HR/incident records. The main fix before relying on it in disputes is **persisting severity and discipline_level** on HR record creation and clarifying/documenting time and retention expectations.
