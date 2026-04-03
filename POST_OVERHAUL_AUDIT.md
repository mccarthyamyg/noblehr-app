# PolicyVault — Post-Overhaul Technical Audit (Engineering Blueprint)

**Application identity:** HR Policy and Handbook app (PolicyVault). Handles AI-assisted policy generation, employee digital acknowledgment of policies with legally defensible timestamps, incident reporting, progressive discipline tracking, and employee file management. Record integrity, immutability, and legal defensibility are primary design requirements. One of three apps in a multi-app restaurant operations platform.

**Audit standard:** Every statement references actual artifacts (file names, table/column names, route paths, function names, env vars, package versions). Where something is absent or uncertain, it is stated explicitly.

**Previous audit:** Rated 6.5/10. Critical issues: severity/discipline_level not persisted on HR record create (server/routes/api.js 529–533); JWT in localStorage (XSS risk); activity log ignoring skip, search, event_type_prefix; no CI/CD, Docker, monitoring; no backup strategy; no formal migration versioning.

**Target architecture (from preamble):** Dual auth (httpOnly cookies web, expo-secure-store mobile); PostgreSQL via Drizzle ORM; Expo SDK 55 + Expo Router v7 replacing React+Vite; TanStack Query v5 + Zustand v5; NativeWind v4; Railway Pro; Claude API with native web search.

---

## RE-AUDIT RUN — 2026-04-03 (14-layer pass)

**Method:** Re-read codebase artifacts; run `npm audit` (server + Handbook Policy App); run `node scripts/test-smoke-launch.js` and `node scripts/test-e2e.js` against local server on PORT 3001.

**Automated results (this run):**
| Check | Result |
|--------|--------|
| **Smoke** (`test-smoke-launch.js`) | **14/14 passed** when `SUPER_ADMIN_PASSWORD` matches the password used by `server.js` startup seed (`SuperAdminPassword123!` in current `execSync` call). Default in smoke script is `PolicyVault2025!` — **login fails** unless env is set. |
| **E2E** (`test-e2e.js`) | **25/25 passed** with same `SUPER_ADMIN_PASSWORD` override. |
| **Server `npm audit`** | **8 vulnerabilities** (1 low, 6 moderate, 1 high): @anthropic-ai/sdk (moderate, fix force → 0.82), brace-expansion (moderate), esbuild via drizzle-kit dev chain (moderate), nodemailer &lt;8.0.4 (SMTP injection), path-to-regexp (high ReDoS). |
| **Frontend `npm audit`** | **Non-zero**; includes transitive issues (e.g. brace-expansion, flatted, jspdf advisory chain). Run `npm audit` in `Handbook Policy App` for current detail. |

**Layer deltas verified in code since prior POST_OVERHAUL text:**
- **L1:** App is deployed on **Railway** at **`https://noblehr-app-production.up.railway.app`** (not encoded in repo; operational fact from 2026-Q1 verification). Still no `.github/workflows` at repo root.
- **L2:** **`employee_documents`** table + upload routes in `server/routes/api.js` (~1888+); `server/data/uploads`; `init-db.js` creates `employee_documents` + indexes.
- **L4:** **`publicFrontendBase(req)`** in `server/routes/api.js` — launch-token and invite links derive HTTPS host from proxy when `FRONTEND_URL` is missing or localhost-only. **`POST /activity-log`** maps each row with **`created_date: created_at`** for API consumers.
- **L6:** **`server/lib/auth.js`** cookie **`maxAge`** uses milliseconds (Express); session cookie must not be `Max-Age=0` in production.
- **L8–9:** **34** `*.jsx` page files under `Handbook Policy App/src/pages` (includes `legal/*`, `VerifyEmail.jsx`, etc.); prior audit said ~30.
- **L10:** **Multipart file upload** for employee documents (multer, `server/routes/api.js`); not “no dedicated multipart” anymore.
- **L13 (new debt):** **`server/server.js`** runs **`execSync('node scripts/seed-super-admin.js SuperAdminPassword123!', ...)`** on listen — plaintext password in process args / repo behavior risk; should be env-driven one-shot seed only.

**Engineering score (this run):** **~7.5/10** (up from 7.25): production path exercised; launch URL and activity-log/Dashboard date bugs addressed in code; remaining gaps: web localStorage JWT, npm audit debt, auto-seed password in `server.js`, no CI, SQLite on Railway unless volume-backed.

---

═══════════════════════════════════════════════════════════
LAYER 1 — PRODUCTION AND LIVE STATUS
═══════════════════════════════════════════════════════════

**Is any part of this app currently running in production or accessible at a live URL?**
- **Yes (operational).** Primary Railway URL: **`https://noblehr-app-production.up.railway.app`**. Not hardcoded in application source; set via hosting (`FRONTEND_URL`, `PORT`, `JWT_SECRET`, etc.). Repo still has no embedded production URL in config files beyond `.env.example` placeholders.

**Environment / access / data:** Node server + SQLite (`server/data/policyvault.db`) unless volume-mounted on Railway; static SPA from `Handbook Policy App/dist` when built and present (`server/server.js` ~88–96).

**Active use by real users:** Possible on deployed instance; not quantified in repo.

**Most recent deployment / what broke:** Manual/Railway deploys; no CI in repo (no root `.github/workflows`). Cookie `maxAge` and launch-link host issues were fixed in code (2026-Q1).

**Current state of the build:** **Deployable locally and on Railway.** Server: `server/server.js`, PORT from `process.env.PORT` (Railway sets this). Web: Vite build → `dist/`. Expo: `PolicyVaultExpo` unchanged. **Smoke 14/14** and **E2E 25/25** pass locally when super-admin password env matches seed.

**CHANGES SINCE PRIOR LAYER 1 TEXT:** Production URL live on Railway; `publicFrontendBase` mitigates wrong `FRONTEND_URL` for launch/invites; still no CI/Docker in repo.

---

═══════════════════════════════════════════════════════════
LAYER 2 — FOUNDATION: DATA AND STORAGE
═══════════════════════════════════════════════════════════

**Database type and version:** **SQLite** via **better-sqlite3** **^11.6.0** (`server/package.json`). No explicit SQLite binary version pinned.

**Hosting provider and plan:** File-based. Path: `server/data/policyvault.db` (`server/lib/db.js`: `dbPath = join(__dirname, '..', 'data', 'policyvault.db')`). No remote DB host.

**Connection method:** Synchronous: `export const db = new Database(dbPath)` in `server/lib/db.js`. No connection string or pool.

**Tables (exact names and columns):** All created in `server/scripts/init-db.js`. Base schema plus migrations (PRAGMA table_info + ALTER TABLE) add columns over time.

| Table | Columns (name, type, nullable/default) |
|-------|----------------------------------------|
| **users** | id TEXT PK, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT, auth_provider TEXT DEFAULT 'email', created_at TEXT DEFAULT (datetime('now')) |
| **super_admins** | id TEXT PK, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT, created_at TEXT DEFAULT (datetime('now')) |
| **organizations** | id TEXT PK, name TEXT NOT NULL, industry TEXT, settings TEXT, status TEXT DEFAULT 'pending_approval', created_at TEXT, plus migrations: approval_token, approval_token_expires_at, last_approval_email_sent_at, deleted_at, state, tos_accepted_at (all TEXT) |
| **platform_locations** | id TEXT PK, name TEXT NOT NULL, address TEXT, created_by_email TEXT, created_at TEXT, deleted_at (migration) |
| **locations** | id TEXT PK, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, address TEXT, created_at TEXT |
| **employees** | id TEXT PK, organization_id TEXT NOT NULL, user_email TEXT NOT NULL, full_name TEXT, role TEXT, department TEXT, location_id TEXT, permission_level TEXT DEFAULT 'employee', status TEXT DEFAULT 'active', hire_date TEXT, phone_number TEXT, email_reminders INTEGER DEFAULT 0, sms_reminders INTEGER DEFAULT 0, tags TEXT, created_at TEXT, UNIQUE(organization_id, user_email); migration: capabilities TEXT |
| **policies** | id TEXT PK, organization_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'draft', current_version INTEGER DEFAULT 0, draft_content TEXT, applies_to TEXT, acknowledgment_required INTEGER DEFAULT 1, handbook_category TEXT, handbook_id TEXT, created_at TEXT, updated_at TEXT |
| **policy_versions** | id TEXT PK, policy_id TEXT NOT NULL, version_number INTEGER NOT NULL, content TEXT NOT NULL, is_locked INTEGER DEFAULT 1, change_summary TEXT, effective_date TEXT, created_at TEXT |
| **acknowledgments** | id TEXT PK, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, policy_version_id TEXT NOT NULL, policy_title TEXT, version_number INTEGER, employee_id TEXT NOT NULL, employee_name TEXT, employee_email TEXT, employee_role_at_time TEXT, employee_location_at_time TEXT, acknowledged_at TEXT NOT NULL, content_hash TEXT NOT NULL, is_locked INTEGER DEFAULT 1, created_at TEXT |
| **pending_re_acknowledgments** | id TEXT PK, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, employee_id TEXT NOT NULL, version_number INTEGER, previous_version_number INTEGER, created_at TEXT; migration: due_date TEXT |
| **handbooks** | id TEXT PK, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'draft', policy_sections TEXT, source TEXT, created_by_email TEXT, created_by_name TEXT, created_at TEXT |
| **onboardings** | id TEXT PK, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT, employee_email TEXT, assigned_policy_ids TEXT, completed_policy_ids TEXT, due_date TEXT, start_date TEXT, completed_date TEXT, status TEXT DEFAULT 'not_started', reminder_sent_count INTEGER DEFAULT 0, last_reminder_date TEXT, created_at TEXT |
| **hr_records** | id TEXT PK, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, record_type TEXT DEFAULT 'write_up', title TEXT, description TEXT, status TEXT DEFAULT 'submitted', is_locked INTEGER DEFAULT 0, severity TEXT, discipline_level INTEGER, created_by_email TEXT, created_at TEXT, updated_at TEXT; migrations: acknowledged_at TEXT, acknowledged_by_email TEXT |
| **incident_reports** | id TEXT PK, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, title TEXT, description TEXT, status TEXT DEFAULT 'submitted', is_locked INTEGER DEFAULT 0, attachments TEXT, admin_notes TEXT, incident_type TEXT, incident_date TEXT, location_id TEXT, severity TEXT, witnesses TEXT, created_by_email TEXT, created_at TEXT, updated_at TEXT; migrations: acknowledged_at TEXT, acknowledged_by_email TEXT |
| **amendments** | id TEXT PK, organization_id TEXT NOT NULL, record_id TEXT NOT NULL, record_type TEXT NOT NULL, field_changed TEXT, old_value TEXT, new_value TEXT, amended_by_email TEXT, amendment_note TEXT, created_at TEXT; migrations: amendment_note TEXT, organization_id (backfilled from record) |
| **system_events** | id TEXT PK, organization_id TEXT NOT NULL, event_type TEXT NOT NULL, entity_type TEXT, entity_id TEXT, actor_email TEXT, actor_name TEXT, summary TEXT, metadata TEXT, created_at TEXT |
| **policy_targeting_overrides** | id TEXT PK, organization_id TEXT NOT NULL, policy_id TEXT NOT NULL, override_type TEXT NOT NULL, employee_id TEXT, role TEXT, location_id TEXT, applies INTEGER DEFAULT 0, created_at TEXT |
| **invites** | id TEXT PK, organization_id TEXT NOT NULL, email TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, created_by_email TEXT, created_at TEXT; migrations: full_name, role, location_id, used_at TEXT |
| **password_reset_tokens** | id TEXT PK, email TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT |
| **refresh_tokens** | id TEXT PK, user_type TEXT NOT NULL, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, created_at TEXT, expires_at TEXT NOT NULL, used_at TEXT, revoked_at TEXT |
| **compliance_checklist_items** | id TEXT PK, organization_id TEXT NOT NULL, state TEXT NOT NULL, industry TEXT, requirement_key TEXT NOT NULL, requirement_text TEXT NOT NULL, suggested_answer TEXT, confirmed INTEGER DEFAULT 0, confirmed_at TEXT, confirmed_by TEXT, notes TEXT, created_at TEXT, updated_at TEXT |
| **employee_documents** | id TEXT PK, organization_id TEXT NOT NULL, employee_id TEXT NOT NULL, uploaded_by TEXT, filename TEXT, stored_filename TEXT, file_size INTEGER, mime_type TEXT, category TEXT, notes TEXT, created_at TEXT, deleted_at TEXT (soft delete); indexes `idx_employee_documents_org_emp`, `idx_employee_documents_deleted` (`server/scripts/init-db.js`) |

**Indexes:** idx_employees_org (employees.organization_id), idx_employees_email (employees.user_email), idx_policies_org (policies.organization_id), idx_acknowledgments_emp (acknowledgments.employee_id), idx_acknowledgments_policy (acknowledgments.policy_id), idx_system_events_org (system_events.organization_id), idx_amendments_org (amendments.organization_id), idx_refresh_token_hash (refresh_tokens.token_hash), idx_refresh_user (refresh_tokens.user_type, user_id), idx_compliance_org, idx_compliance_state_industry; plus migration-added idx_amendments_org where applicable.

**Foreign keys:** locations.organization_id → organizations(id); employees.organization_id → organizations(id), employees.location_id → locations(id); policies.organization_id → organizations(id); policy_versions.policy_id → policies(id). No CASCADE defined in init-db.js; integrity by application.

**Migration system:** **No version table.** Migrations are inline in `server/scripts/init-db.js`: CREATE TABLE IF NOT EXISTS plus blocks that PRAGMA table_info and ALTER TABLE ADD COLUMN for amendments, incident_reports, users (auth_provider), employees (phone_number, email_reminders, sms_reminders, capabilities), invites, organizations (status, approval_token*, deleted_at, state, tos_accepted_at), platform_locations (deleted_at), hr_records / incident_reports (acknowledged_at, acknowledged_by_email), pending_re_acknowledgments (due_date), and CREATE TABLE IF NOT EXISTS for password_reset_tokens, refresh_tokens, compliance_checklist_items. Order is implicit; no `schema_version` or migration filename tracking. **Drizzle:** `server/db/schema.js` (PostgreSQL) and `server/db/migrations/` exist: `meta/_journal.json` lists `0000_bright_proteus`, `0001_fat_scourge` (dialect postgresql). Drizzle is **not** used at runtime; app uses `server/lib/db.js` (better-sqlite3). So: formal versioned migrations exist only for PostgreSQL (Drizzle); current app runs on SQLite with init-db.js amendments.

**Data hardcoded that might belong in DB:** Test org name `_TEST_Location_SuperAdmin` and test-user creation in `server/routes/api.js` (super-admin ensure-test-org); E2E uses env SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD. Default JWT secret in dev: `server/lib/auth.js` `'policyvault-dev-secret-change-in-production'`. Compliance seed: six MA restaurant requirement rows inserted into compliance_checklist_items when organization_id = '' template row missing (`server/scripts/init-db.js`).

**Backup strategy:** **Implemented.** `server/scripts/backup-db.js`: copies `server/data/policyvault.db` to `server/data/backups/policyvault-<timestamp>.db` using better-sqlite3 readonly connection and `db.backup(filename)`. Retention: keeps last `BACKUP_RETENTION_COUNT` (default 7, env-overridable); older files deleted by mtime. Env: `BACKUP_RETENTION_COUNT`, `BACKUP_DIR`. Restore: stop app, replace policyvault.db with backup file, restart. No cron or external copy (e.g. S3) in repo; RUNBOOK.md documents backup/restore.

**CHANGES SINCE LAST AUDIT:** Backup added (`server/scripts/backup-db.js`, npm script `backup`). New tables: refresh_tokens, compliance_checklist_items, password_reset_tokens, **employee_documents**; new columns on organizations (state, tos_accepted_at), employees (capabilities), pending_re_acknowledgments (due_date). Drizzle schema and migrations for PostgreSQL added (`server/db/schema.js`, `server/db/migrations/`) but not used at runtime. No migration version table for SQLite path; backup strategy is present.

---

═══════════════════════════════════════════════════════════
LAYER 3 — STRUCTURAL FRAME: BACKEND ARCHITECTURE
═══════════════════════════════════════════════════════════

**Language and version:** JavaScript (ES modules). `server/package.json`: `"type": "module"`. No Node version pinned (no .nvmrc or engines).

**Framework and version:** **Express** **^4.21.1** (`server/package.json`).

**Top-level backend structure:**  
`server/server.js` (entry), `server/routes/auth.js`, `server/routes/api.js`, `server/lib/db.js`, `server/lib/auth.js`, `server/lib/email.js`, `server/lib/audit.js`, `server/lib/claude.js`, `server/lib/db-pg.js`, `server/scripts/init-db.js`, `server/scripts/backup-db.js`, `server/scripts/seed-super-admin.js`, `server/scripts/test-e2e.js`, `server/scripts/test-smoke-launch.js`, `server/scripts/test-health.js`, `server/db/schema.js`, `server/drizzle.config.js`, `server/data/` (policyvault.db, backups/).

**Server entry point:** **server/server.js.** On startup: trust proxy 1; request-id middleware (req.id, X-Request-ID); helmet (contentSecurityPolicy: false); CORS (credentials: true, origin from CORS_ORIGINS or FRONTEND_URL); express.json(500kb); cookieParser(); GET /api/health; rate limits (auth endpoints 5–10/min, /api 100/min); mount authRouter at /api/auth; csrfMiddleware then apiRouter at /api; global error handler; serve static from `../Handbook Policy App/dist` if exists with SPA fallback; mkdirSync server/data; listen(PORT).

**Port:** `process.env.PORT` or **3001** (`server/server.js` line 21).

**Environment variables (backend):**  
- **PORT** — server port; default 3001.  
- **NODE_ENV** — production vs development; CORS, error messages, JWT_SECRET requirement.  
- **JWT_SECRET** — required in production; server exits if unset (`server/lib/auth.js`).  
- **FRONTEND_URL** — invite/reset/launch links; default http://localhost:5173.  
- **CORS_ORIGINS** — comma-separated; production CORS.  
- **GOOGLE_CLIENT_ID** — optional; Google Sign-In.  
- **SUPER_ADMIN_EMAIL**, **SUPER_ADMIN_PASSWORD** — E2E/seed.  
- **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS**, **SMTP_FROM** — optional; email to console when unset.  
- **ANTHROPIC_API_KEY** — optional; Claude API; when unset, AI generation no-op.  
- **BACKUP_RETENTION_COUNT**, **BACKUP_DIR** — backup script.  
- **DATABASE_URL** — documented in .env.example for “future Postgres”; not used by main app (SQLite).

**Dependencies (server/package.json):**  
@anthropic-ai/sdk ^0.79.0, bcryptjs ^2.4.3, better-sqlite3 ^11.6.0, drizzle-orm ^0.38.0, pg ^8.13.0, cookie-parser ^1.4.7, cors ^2.8.5, express ^4.21.1, express-rate-limit ^8.3.0, google-auth-library ^10.6.1, helmet ^8.1.0, jsonwebtoken ^9.0.2, nodemailer ^8.0.1, uuid ^11.0.3. Dev: drizzle-kit ^0.30.0.

**Start commands:** Development: `npm run dev` → `node --watch server.js` (from server). Production: `npm start` → `node server.js`. Client build separate: `npm run build` in Handbook Policy App; server serves dist if present.

**CHANGES SINCE LAST AUDIT:** cookie-parser added; auth and CSRF use cookies. New libs: server/lib/audit.js, server/lib/claude.js, server/lib/db-pg.js; drizzle-orm, pg, @anthropic-ai/sdk added. Scripts: backup, db:generate, db:migrate, db:push. No structural change to Express or entry flow beyond cookie + CSRF.

---

═══════════════════════════════════════════════════════════
LAYER 4 — PLUMBING: ROUTES AND ENDPOINTS
═══════════════════════════════════════════════════════════

**Auth routes** (mount `/api/auth`, `server/routes/auth.js`). All public; rate limits applied in server.js.

| Method | Path | Handler | Behavior |
|--------|------|---------|----------|
| POST | /api/auth/register | register | Create user, org (pending_approval), employee; send approval email. |
| GET | /api/auth/csrf | — | Generate CSRF token, set pv_csrf_token cookie, return { csrf }. |
| POST | /api/auth/logout | — | clearAuthCookie(res); return { ok: true }. |
| POST | /api/auth/refresh | — | Body refresh_token; validate via refresh_tokens table; issue new access + refresh; set cookie if web (X-Client-Type !== 'mobile'). |
| POST | /api/auth/login | login | Email/password; returns token, refresh_token, expires_in; sets pv_access_token cookie when X-Client-Type !== 'mobile'. |
| POST | /api/auth/google | — | Verify Google ID token; login or needSignup. |
| POST | /api/auth/google-register | — | Create user (auth_provider=google), org pending, employee; send approval email. |
| GET | /api/auth/approve-org/validate | — | Query token; validate; return org_name, admin. |
| POST | /api/auth/approve-org/validate | — | Body token; same. |
| POST | /api/auth/approve-org | — | approve or deny org. |
| POST | /api/auth/forgot-password | — | Insert password_reset_tokens; send email. |
| POST | /api/auth/reset-password | — | Consume token; update password (users or super_admins). |
| POST | /api/auth/request-approval-again | — | Re-pend rejected org; resend approval email. |
| GET | /api/auth/invites/validate | — | Query token. |
| POST | /api/auth/invites/validate | — | Body token. |
| POST | /api/auth/invites/accept | — | Accept invite (Google or password); create/update user and employee. |

**API routes** (mount `/api`, `server/routes/api.js`). All use authMiddleware (cookie or Bearer) and getContext(req). CSRF applied to state-changing requests (skipped for Bearer-only / X-Client-Type: mobile).

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | /api/health | None | SELECT 1; { ok, db } or 503. |
| GET | /api/capabilities | JWT | Returns capability keys for current employee (hasCapability list). |
| GET | /api/me | JWT | Returns org, employee (or super admin / impersonation). |
| POST | /api/super-admin/* | JWT + super admin | pending-orgs, approve-org, reject-org, archive-org, platform-locations, delete-platform-location, create-location, all-orgs, orgs-with-locations, launch-token, ensure-test-org. |
| POST | /api/account/change-password | JWT | Verify current password; update users or super_admins. |
| POST | /api/account/change-email | JWT | Verify password; update users.email and employees.user_email. |
| POST | /api/account/update-profile | JWT | Update employees (and users.full_name) or super_admins. |
| POST | /api/admin-context | JWT | Locations, employees, policies, overrides, onboardings/amendments. |
| POST | /api/applicable-policies | JWT | Policies applicable to employee_id (targeting). |
| POST | /api/policies-for-employee | JWT | Policies for current user. |
| POST | /api/create-acknowledgment | JWT | Create acknowledgment; content_hash SHA-256; system_events; delete pending_re_acknowledgments. |
| POST | /api/entity-write | JWT | create/update/amend/delete: Policy, Handbook, Onboarding, Location, PolicyTargetingOverride, HRRecord, IncidentReport. |
| POST | /api/employee-write | JWT | create/update/delete employees. |
| POST | /api/publish-policy | JWT | Insert policy_versions; set policies.status=active; pending_re_acknowledgments. |
| POST | /api/handbook-data | JWT | list_handbooks, get_policy_version, get_handbook_version, get. |
| POST | /api/my-onboarding | JWT | Onboarding + assigned policies + pending_re_acknowledgments. |
| POST | /api/my-acknowledgments | JWT | acknowledgments + pending_re_acknowledgments. |
| POST | /api/policy-for-employee | JWT | Single policy + current version. |
| POST | /api/activity-log | JWT | system_events with limit, skip, search (summary/metadata LIKE), event_type_prefix (event_type LIKE prefix%). |
| POST | /api/acknowledgement-matrix | JWT | Matrix employees × policies. |
| POST | /api/invites/create | JWT | Insert invite; return invite_link. |
| POST | /api/invites/list | JWT | List invites. |
| POST | /api/send-onboarding-reminder | JWT | Increment reminder_sent_count. |
| POST | /api/org-write | JWT | Update org; create/delete Location; PolicyTargetingOverride. |
| POST | /api/manage-policy-lifecycle | JWT | Archive policy. |
| POST | /api/hr-records | JWT | List hr_records (admin or own). |
| POST | /api/incident-reports | JWT | List incident_reports + amendments. |
| POST | /api/secure-incident-write | JWT | create incident; update_notes/update_attachments + amendments. |
| POST | /api/locations | JWT | List locations. |
| POST | /api/policy | JWT | Single policy. |
| POST | /api/policy-versions | JWT | All versions for policy_id. |
| POST | /api/manage-hr-lifecycle | JWT | Update status, is_locked; amendment. |
| POST | /api/acknowledge-hr-record | JWT | Set acknowledged_at, acknowledged_by_email on own record. |
| POST | /api/system-event | JWT | Insert system_events. |
| POST | /api/system-events | JWT | Query system_events. |
| POST | /api/policy-update | JWT | Update policy status. |
| POST | /api/verify-acknowledgment | JWT | Compare content_hash to current version content. |
| POST | /api/ai/generate-policy | JWT | Stream Claude policy generation. |
| POST | /api/ai/scan-handbook-missing | JWT | Claude: suggest missing policy titles. |
| POST | /api/ai/extract-handbook | JWT | Claude: extract policies from handbook text. |
| POST | /api/ai/handbook-recommend | JWT | Claude: recommend policy titles. |
| POST | /api/ai/handbook-generate-selected | JWT | Claude: generate selected policies. |
| POST | /api/ai/policy-suggest | JWT | Claude: apply user instruction to draft. |
| POST | /api/compliance-checklist | JWT | List/upsert compliance_checklist_items. |
| POST | /api/compliance-checklist/confirm | JWT | Confirm requirement. |
| POST | /api/gap-audit | JWT | Gap audit. |
| POST | /api/export-employee-file | JWT | Export employee file. |
| POST | /api/export-org-data | JWT | Full org JSON. |
| POST | /api/employee-profile | JWT | Employee + location + **employee_documents** list. |
| POST | /api/employee-documents/upload | JWT | Multipart upload (multer); writes `server/data/uploads`. |
| GET | /api/employee-documents/:employee_id | JWT | List documents for employee. |
| GET | /api/employee-documents/download/:document_id | JWT | Stream file. |
| DELETE | /api/employee-documents/:document_id | JWT | Soft-delete document. |

**Routes defined but not wired to frontend:** None identified; AI and compliance routes are called from Handbook Policy App (invoke map in client.js).

**CHANGES SINCE LAST AUDIT:** GET /api/auth/csrf, POST /api/auth/refresh, POST /api/auth/logout (cookie clear). GET /api/capabilities added. Activity-log respects skip, search, event_type_prefix and returns **`created_date`** alias from **`created_at`**. Entity-write HRRecord create inserts severity and discipline_level. **`publicFrontendBase(req)`** for launch-token + invite links. New routes: /api/ai/*, compliance, gap-audit, export, **employee document upload/download/delete**.

---

═══════════════════════════════════════════════════════════
LAYER 5 — BUSINESS LOGIC: SERVICES AND MODULES
═══════════════════════════════════════════════════════════

| File | Responsibility | Reads/Writes | External | State |
|------|----------------|--------------|----------|--------|
| **server/lib/db.js** | DB connection, parseJson, stringifyJson | — | — | Exports db, parseJson, stringifyJson. |
| **server/lib/auth.js** | JWT create/verify, bcrypt, authMiddleware, getContext, cookie (setAuthCookie, clearAuthCookie), refresh (store/find/mark/revoke), CSRF (csrfMiddleware, generateCsrfToken, setCsrfCookie) | users, super_admins, employees, organizations, refresh_tokens | — | JWT_SECRET required in prod. |
| **server/lib/email.js** | sendEmail, sendPasswordReset, sendOrgApprovalNotification, sendAcknowledgmentConfirmation | — | Nodemailer (SMTP or console) | SMTP optional. |
| **server/lib/audit.js** | Audit logging helpers | system_events (via callers) | — | Used by api.js for key actions. |
| **server/lib/claude.js** | streamPolicyGeneration, generatePolicyText, scanHandbookMissing, extractPoliciesFromHandbook, handbookRecommend, policySuggest; isClaudeConfigured | — | Anthropic API (@anthropic-ai/sdk) | Real API when ANTHROPIC_API_KEY set. |
| **server/lib/db-pg.js** | PostgreSQL connection when DATABASE_URL set | — | pg | Not used by main app path (SQLite). |
| **server/routes/auth.js** | Register, login, Google, refresh, logout, approve-org, forgot/reset password, invite validate/accept, CSRF | users, super_admins, organizations, employees, locations, invites, password_reset_tokens, refresh_tokens | Google, email | Complete; cookie + refresh for web. |
| **server/routes/api.js** | All authenticated API; getContext, hasCapability, canAccessEntityWrite; entity-write (create/update/amend/delete); HR create includes severity/discipline_level; activity-log with skip/search/event_type_prefix; create-acknowledgment with content_hash; AI routes call claude.js | All tables | — | HR create and activity-log bugs fixed. |

**Background jobs / scheduled tasks:** None. No cron, no job queue in repo. Backup is manual (`npm run backup`) or external cron.

**Data transformation:** parseJson/stringifyJson (db.js) for TEXT columns. Policy targeting in api.js (applicable-policies, policies-for-employee, create-acknowledgment, publish-policy) using applies_to and policy_targeting_overrides.

**Calculation logic:** Content hash: `createHash('sha256').update(version.content || '').digest('hex')` in create-acknowledgment (`server/routes/api.js` line 535). verify-acknowledgment recomputes and compares. No other dedicated calculation modules.

**CHANGES SINCE LAST AUDIT:** server/lib/audit.js, server/lib/claude.js, server/lib/db-pg.js added. auth.js: cookie, refresh token, CSRF. api.js: HRRecord create fixed; activity-log filtering fixed; AI routes delegate to claude.js. No background jobs still.

---

═══════════════════════════════════════════════════════════
LAYER 6 — ELECTRICAL: AUTH AND SECURITY
═══════════════════════════════════════════════════════════

**Authentication:** **jsonwebtoken** ^9.0.2. Tokens signed with JWT_SECRET; payload: userId, email; optional isSuperAdmin, impersonateOrgId. Access token expiry **15m** for login/refresh; launch token 1h. **authMiddleware** (`server/lib/auth.js`): token from `req.cookies[COOKIE_ACCESS_TOKEN]` (pv_access_token) first, then `Authorization: Bearer <token>`. Verify JWT; load user from users or super_admins; set req.user, req.superAdmin, req.impersonateOrgId.

**Refresh tokens:** Stored in table `refresh_tokens` (id, user_type, user_id, token_hash, expires_at, used_at, revoked_at). Created on login/register/Google; rotation on use; reuse detection (revoke all for user). createRefreshTokenValue (64 bytes hex), storeRefreshToken, findRefreshTokenByValue, markRefreshTokenUsed, revokeAllRefreshTokensForUser in auth.js. POST /api/auth/refresh accepts refresh_token in body; returns new access + refresh; sets pv_access_token cookie when request is “web” (no X-Client-Type: mobile).

**Cookie (web):** COOKIE_ACCESS_TOKEN = 'pv_access_token'; httpOnly, path '/', sameSite 'strict', maxAge 15 min; secure in production. setAuthCookie(res, token) used in auth.js on login/refresh when isWeb (login: `req.headers['x-client-type'] !== 'mobile'`; refresh checks same). clearAuthCookie on logout.

**CSRF:** Double-submit: pv_csrf_token cookie and X-CSRF-Token header must match for state-changing methods. csrfMiddleware skips GET/HEAD/OPTIONS; skips when Bearer-only (X-Client-Type: mobile or Authorization Bearer with no CSRF cookie). GET /api/auth/csrf returns { csrf } and sets cookie.

**User roles:** Org: permission_level (employee, org_admin). Super admins in super_admins table; launch token can impersonate org (impersonateOrgId). Capabilities: hasCapability(employee, key) used for view_activity_log, view_acknowledgments, manage_hr_records, manage_incidents (employees.capabilities JSON).

**Authorization:** getContext(req) from auth middleware provides org and employee (or super admin). Routes check organization_id match and hasCapability where needed. requireSuperAdmin for super-admin routes.

**Passwords:** bcrypt (bcryptjs ^2.4.3), SALT_ROUNDS 10. Stored in users.password_hash and super_admins.password_hash.

**Secrets:** JWT_SECRET from env; required in production (exit if unset). ANTHROPIC_API_KEY optional. No API keys in code.

**SPECIFIC CHECK — JWT and dual auth:**  
- **Backend:** Dual auth is implemented: for web (no X-Client-Type: mobile) server sets httpOnly cookie and accepts cookie or Bearer; for mobile (X-Client-Type: mobile) server does not set cookie and expects Bearer only; CSRF skipped for Bearer-only.  
- **Handbook Policy App (web):** Still stores JWT in **localStorage** (`policyvault_token`) and refresh in localStorage (`policyvault_refresh_token`) — see `Handbook Policy App/src/api/client.js` getToken/setToken, getRefreshToken/setRefreshToken. Client sends Authorization Bearer and credentials: 'include', so cookie is also sent when present. So **JWT remains in localStorage on the web client** (XSS risk); server supports cookie but web app has not been switched to cookie-only.  
- **PolicyVaultExpo:** Uses **expo-secure-store** for tokens (per target architecture); sends Bearer and X-Client-Type: mobile; no cookie.  
**Conclusion:** Backend supports dual auth; Expo uses secure store + Bearer; **web app still uses localStorage for JWT** — not fully aligned with “httpOnly cookies for web.”

**CHANGES SINCE LAST AUDIT:** Refresh token flow and table added. Cookie (pv_access_token) set on login/refresh for web. CSRF middleware and GET /api/auth/csrf added. authMiddleware reads cookie first, then Bearer. Web client still stores token in localStorage; Expo app uses secure store.

---

═══════════════════════════════════════════════════════════
LAYER 7 — HVAC: EXTERNAL INTEGRATIONS
═══════════════════════════════════════════════════════════

**External services:**

1. **Anthropic (Claude) API**  
   - **Use:** Policy generation, handbook scan/extract/recommend, policy suggest.  
   - **Package:** @anthropic-ai/sdk ^0.79.0.  
   - **Connection:** server/lib/claude.js; client created when ANTHROPIC_API_KEY is set.  
   - **Credentials:** ANTHROPIC_API_KEY env.  
   - **If unavailable:** client is null; streamPolicyGeneration/generatePolicyText no-op (empty string); scanHandbookMissing returns []; extractPoliciesFromHandbook returns []; handbookRecommend returns []; policySuggest returns ''. API routes return 503 when guard fails (e.g. generate-policy).  
   - **Status:** **Real integration.** Not stub; no invokeLLM in codebase.

2. **Google Sign-In**  
   - **Use:** Login and register via Google ID token.  
   - **Package:** google-auth-library ^10.6.1.  
   - **Credentials:** GOOGLE_CLIENT_ID.  
   - **Status:** Implemented in auth.js (google, google-register).

3. **SMTP (Nodemailer)**  
   - **Use:** Approval emails, password reset, acknowledgment confirmation.  
   - **Package:** nodemailer ^8.0.1.  
   - **Credentials:** SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.  
   - **If unset:** Logs to console (server/lib/email.js).

**Webhooks:** None.

**SPECIFIC CHECK — Claude API:**  
- **Real.** Uses Anthropic SDK; model **claude-sonnet-4-20250514**; max_tokens 8192 (stream) or 1024/8192 per call; temperature 0.1–0.2.  
- **Web search:** Not enabled. No tools or web-search parameters in streamPolicyGeneration or messages.create calls in claude.js.  
- **Cost governance:** No rate limiting or token budget in code; only general /api rate limit (100/min).  

**CHANGES SINCE LAST AUDIT:** invokeLLM stub removed; real Claude integration in server/lib/claude.js. No web search; no dedicated cost/rate limits for AI.

---

═══════════════════════════════════════════════════════════
LAYER 8 — INTERIOR: FRONTEND ARCHITECTURE
═══════════════════════════════════════════════════════════

**Web frontend — Handbook Policy App:**  
- **Framework:** React ^18.2.0, Vite ^6.1.0 (`Handbook Policy App/package.json`).  
- **Type:** Web app (browser).  
- **Structure:** src/App.jsx, src/main.jsx, src/api/client.js (invoke map, getToken/setToken from localStorage, ensureCsrf, credentials: 'include', refresh flow), src/lib/AuthContext.jsx, src/pages/*.jsx (30 page components), Layout, pages.config.js, etc.  
- **State:** TanStack React Query ^5.84.1 for server state; no Zustand in package.json.  
- **Navigation:** react-router-dom ^6.26.0.  
- **Backend communication:** REST; base URL `import.meta.env.VITE_API_URL || '/api'`; credentials: 'include'; Bearer from getToken(); X-CSRF-Token on state-changing requests.  
- **Env:** VITE_API_URL.

**Expo frontend — PolicyVaultExpo:**  
- **Framework:** Expo ~55.0.6, React 19.2.0, react-native 0.83.2 (`PolicyVaultExpo/package.json`).  
- **Type:** Mobile (and web via react-native-web).  
- **Structure:** app/_layout.tsx, app/(auth)/login.tsx, app/(auth)/setup.tsx, app/(auth)/forgot-password.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, app/(tabs)/policies.tsx, app/(tabs)/profile.tsx, app/modal.tsx, app/+not-found.tsx, app/+html.tsx.  
- **Navigation:** expo-router ~55.0.5.  
- **State:** No TanStack Query or Zustand in package.json; local/context only.  
- **Backend:** REST; token from expo-secure-store; Bearer + X-Client-Type: mobile.

**SPECIFIC CHECK — React+Vite vs Expo:**  
- **Web:** Still **React + Vite** (Handbook Policy App).  
- **Mobile:** **Expo SDK 55 + Expo Router** present (PolicyVaultExpo). So migration toward Expo has started as a **separate app**; the main web app has not been replaced by Expo for web.

**CHANGES SINCE LAST AUDIT:** PolicyVaultExpo added (Expo 55, Expo Router). Web app unchanged (React, Vite, no Zustand). TanStack Query present on web; no NativeWind in either package.json.

---

═══════════════════════════════════════════════════════════
LAYER 9 — ROOMS: SCREENS AND FEATURES
═══════════════════════════════════════════════════════════

**Handbook Policy App — pages (exact file names):**  
Dashboard.jsx, Login.jsx, ForgotPassword.jsx, ForgotEmail.jsx, ResetPassword.jsx, Setup.jsx, ApproveOrg.jsx, RequestApprovalAgain.jsx, InviteAccept.jsx, Launch.jsx, SuperAdmin.jsx, Policies.jsx, PolicyEditor.jsx, PolicyView.jsx, Handbook.jsx, AIHandbookGenerator.jsx, OrgSettings.jsx, Employees.jsx, EmployeeProfile.jsx, Onboarding.jsx, MyOnboarding.jsx, AcknowledgementTracking.jsx, ReAcknowledgmentManagement.jsx, ActivityLog.jsx, HRRecords.jsx, MyWriteUps.jsx, Incidents.jsx, ComplianceChecklist.jsx, GapAudit.jsx, Profile.jsx.  
**Total: 30 page components** under src/pages (vs 28 previously; slight increase with Compliance/GapAudit and/or naming).

**PolicyVaultExpo — screens:**  
(tabs) index, (tabs) policies, (tabs) profile; (auth) login, setup, forgot-password; modal; +not-found. Fewer than web; core flows (login, setup, policies, profile) present.

**Status:**  
- **End-to-end working:** Register → approval → login → dashboard; policy CRUD and publish; acknowledgments; activity log (with skip/search/event_type_prefix); HR records (create with severity/discipline_level); incidents; invites; super-admin flows; export; AI generate/suggest when ANTHROPIC_API_KEY set; compliance checklist.  
- **Partially implemented:** Expo app has limited screens vs web; no full parity.  
- **Placeholder / not built:** No feature identified as “planned but no code”; AI and compliance have backend and frontend.

**SPECIFIC CHECK — Screen count:** ~30 web pages (up from 28); Expo has ~8 distinct screens. No removal of major screens; ComplianceChecklist, GapAudit, AIHandbookGenerator and related AI flows added or confirmed.

**CHANGES SINCE LAST AUDIT:** Activity log pagination/filter now works server-side. HR record create captures severity/discipline_level. New screens/features for compliance and AI; Expo app added with subset of flows.

---

═══════════════════════════════════════════════════════════
LAYER 10 — INPUTS AND OUTPUTS
═══════════════════════════════════════════════════════════

**Inputs:**  
- **Form submissions:** Login, register, Google, invite accept, approve-org, forgot/reset password, policy create/edit, handbook, onboarding, employee create/edit, HR record create/amend, incident create/update, compliance confirm, org/location/targeting, super-admin actions. All via POST (or GET for validate) to /api/auth/* and /api routes.  
- **File uploads:** **Employee documents** — multipart via multer (`server/routes/api.js`, `server/data/uploads`). Incident attachments may still be references (attachments TEXT on incident_reports).  
- **External API calls:** None into this app.  
- **Scheduled pulls:** None.

**Outputs:**  
- **API responses:** JSON from all /api and /api/auth routes.  
- **File exports:** export-employee-file, export-org-data (JSON).  
- **Email:** Approval, password reset, acknowledgment confirmation (server/lib/email.js) when SMTP configured.  
- **SMS/push:** email_reminders/sms_reminders on employees; no SMS/push sending code found.  
- **Print/Bluetooth:** None.

**CHANGES SINCE LAST AUDIT:** No material change to input/output surface; export and email behavior unchanged. Acknowledgment confirmation email present.

---

═══════════════════════════════════════════════════════════
LAYER 11 — DATA INTEGRITY AND AUDIT
═══════════════════════════════════════════════════════════

**Soft delete:**  
- **organizations:** deleted_at (TEXT); archive-org sets it.  
- **platform_locations:** deleted_at; delete-platform-location sets it.  
- No generic “deleted_at” across all tables; only these two. Enforced in queries (e.g. deleted_at IS NULL) where applicable.

**Audit logging:**  
- **system_events:** id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, metadata, created_at. Written from api.js (e.g. create-acknowledgment, entity-write, publish, etc.) and auth flows where relevant.  
- **amendments:** id, organization_id, record_id, record_type, field_changed, old_value, new_value, amended_by_email, amendment_note, created_at. Append-only; used for HR records and incidents.  
- server/lib/audit.js provides helpers used by routes.

**Immutability:**  
- **policy_versions:** Insert-only; is_locked 1. No update/delete in code.  
- **acknowledgments:** Insert-only; is_locked 1. No update/delete.  
- **hr_records:** is_locked 1 for immediate_termination from create; locked records reject amend (entity-write checks row.is_locked).  
- **amendments:** Append-only; no updates.

**Timestamps:** created_at (and updated_at where present) on major tables; policy_versions, acknowledgments, hr_records, incident_reports, system_events, amendments use TEXT datetime('now') or datetime('now','utc'). No centralized timestamp service.

**Validation:** Input validation in route handlers (required body fields, org match, capability checks). No shared Zod/Joi layer; errors return 400/403 with message.

**SPECIFIC CHECK — SHA-256 and immutability:**  
- **Content hash:** create-acknowledgment computes `contentHash = createHash('sha256').update(version.content || '').digest('hex')` and stores in acknowledgments.content_hash (`server/routes/api.js` line 535). verify-acknowledgment recomputes and compares. **Intact.**  
- **policy_versions and acknowledgments:** Still insert-only and is_locked; no update/delete paths. **Enforced.**

**CHANGES SINCE LAST AUDIT:** Audit helpers in server/lib/audit.js; system_events and amendments usage unchanged. Immutability and content_hash behavior unchanged.

---

═══════════════════════════════════════════════════════════
LAYER 12 — DEVOPS AND BUILD
═══════════════════════════════════════════════════════════

**Hosting:** **Railway** used in production for Noble HR (`noblehr-app-production.up.railway.app` — not in git). DEPLOYMENT.md / DEPLOY.md still describe manual/split options.

**Deploy method:** **Railway** (typical) or manual: build Vite client; Node serves API + static `dist`. No CI/CD in repo (no root `.github/workflows`).

**CI/CD:** None. Scripts exist: test:smoke (test-smoke-launch.js), test:e2e (test-e2e.js); no automation that runs them on commit.

**Environments:** NODE_ENV, FRONTEND_URL, CORS_ORIGINS, JWT_SECRET, etc.; no separate staging/production config files. .env.example documents variables.

**Monitoring / error tracking:** None. No Sentry, LogRocket, or similar; only console.error in global handler.

**Mobile build:** PolicyVaultExpo: `expo start`, `expo start --android`, `expo start --ios`, `expo start --web`. No eas.json or app-store submit config in repo; no build status or store submission result documented.

**Docker/containers:** None. No Dockerfile or docker-compose in project.

**CHANGES SINCE LAST AUDIT:** Production hosting on Railway in use; repo still has no pipeline YAML or Docker at project root.

---

═══════════════════════════════════════════════════════════
LAYER 13 — KNOWN ISSUES AND TECHNICAL DEBT
═══════════════════════════════════════════════════════════

**Fixed since last audit:**  
- **HR record create:** severity and discipline_level are now persisted in entity-write HRRecord INSERT (`server/routes/api.js` lines 621–624).  
- **Activity log:** skip, search, event_type_prefix are applied in SQL; response includes **`created_date`** for UI (`created_at` alias).  
- **Dashboard date crash:** Frontend uses `isValid` + `created_at` fallback; API maps `created_date`.  
- **Launch / invite URLs:** `publicFrontendBase(req)` when env is localhost-only.  
- **Session cookie:** Express `maxAge` in milliseconds for `pv_access_token`.

**Broken / missing:**  
- **Web client token storage:** JWT and refresh token still in localStorage (Handbook Policy App/src/api/client.js); XSS can steal token. Backend supports httpOnly cookie but web app does not rely on it only.  
- **Server boot:** `server/server.js` **`execSync` seeds super admin with plaintext password in argv** — security/process-list risk; smoke default password does not match unless env aligned.  
- **npm audit:** Server **8** and frontend **multiple** open advisories (see RE-AUDIT RUN table); not auto-remediated.  
- **TypeScript:** Full-project typecheck may still fail on UI/Radix (previous audit); not re-verified this run.  
- **Migration versioning:** No schema_version table for SQLite; Drizzle migrations exist for PostgreSQL only; init-db.js order is implicit.

**Fragile / shortcuts:**  
- **SQLite in production:** Single file; no replication or pooling; backup is file copy + retention.  
- **Employee create (employee-write):** If user does not exist, server creates user with random password; comment mentions sending email in production; not implemented.  
- **Content hash:** Stored at acknowledge time; verify uses current version content; policy_versions are insert-only so safe; if version content were ever changed in DB, hash would mismatch.  
- **Claude:** No per-org or per-user rate limit or token budget; only global 100/min.

**Scale:**  
- Some list endpoints return all (e.g. policies-for-employee); activity-log has limit/skip. No caching layer.

**Inconsistencies:**  
- Naming: client camelCase (getActivityLog) vs server kebab-case (activity-log).  
- Two frontends (Handbook Policy App + PolicyVaultExpo) with different state and screen coverage.

**SPECIFIC CHECK — severity/discipline_level and activity log:** Both fixed. **New issues from overhaul:** Web app still using localStorage despite backend cookie support; Expo app parity incomplete; no migration versioning for SQLite.

**CHANGES SINCE LAST AUDIT:** Severity/discipline_level and activity-log bugs resolved. New: token storage gap on web; dual frontends; Drizzle present but not used at runtime.

---

═══════════════════════════════════════════════════════════
LAYER 14 — ENGINEERING ASSESSMENT
═══════════════════════════════════════════════════════════

**Orientation for a new senior engineer:**  
- **Docs:** RUNBOOK.md (setup, dev/prod, backup/restore), DEPLOYMENT.md, FOUNDATION.md (stack, 28 screens), TECHNICAL_AUDIT.md (previous), this POST_OVERHAUL_AUDIT.md.  
- **Backend:** server/server.js → auth then api routes; server/lib (auth, db, email, audit, claude); server/scripts/init-db.js (schema + migrations); server/scripts/backup-db.js.  
- **Web frontend:** Handbook Policy App/src/App.jsx, src/api/client.js (invoke + token in localStorage), AuthContext, src/pages/*.jsx.  
- **Expo:** PolicyVaultExpo/app with Expo Router (auth + tabs).

**Overall health:** **7.5/10** (re-audit 2026-04-03).  
- **Improvements:** Production on Railway; HR create and activity-log fixed; employee documents; backup; refresh/cookie/CSRF; real Claude when keyed; `publicFrontendBase`; cookie maxAge fix; smoke **14/14** + E2E **25/25** with correct env.  
- **Gaps:** Web still uses localStorage for JWT; npm audit debt; auto-seed password in `server.js`; no CI/Docker/monitoring in repo; SQLite migration versioning; Expo not at parity.

**Single most important fix before real users:** **Stop storing JWT in localStorage on the web client** and use cookie-only auth for the Handbook Policy App (backend already supports it), to remove XSS token theft risk. **Second:** remove hardcoded super-admin password from `execSync` boot; use env + manual/one-off seed.

**Recommended next steps (engineering):**  
1. Web client: remove localStorage for access/refresh token; use credentials: 'include' only; rely on server-set cookie and refresh endpoint (no Bearer from client for web).  
2. Add migration version table for SQLite or adopt a single migration strategy (e.g. Drizzle for SQLite or full cutover to PostgreSQL).  
3. Add minimal CI (lint, typecheck, build, smoke, E2E).  
4. Document or automate production deploy (e.g. Railway); add health/monitoring.  
5. Decide Expo vs web path: parity for Expo or deprecate one client.

**Other concerns:** Employee create without email for new users; no rate/cost guard on Claude; export-org-data unbounded for very large orgs; timestamp consistency (UTC) and retention/legal-hold policy not in code.

**COMPARISON TO PREVIOUS AUDIT:** Previous **6.5/10** with top priority severity/discipline_level persistence; interim **7.25/10** in POST_OVERHAUL body. **Re-audit 2026-04-03: 7.5/10.** What changed: Railway production; employee documents; launch URL + activity date + cookie fixes; tests re-run green. What remains: localStorage on web, npm audit cleanup, remove boot `execSync` password, CI/monitoring, SQLite versioning.

---

═══════════════════════════════════════════════════════════
LAYER 15 — DISTANCE TO TARGET ARCHITECTURE
═══════════════════════════════════════════════════════════

**Target (from preamble):** Dual auth (httpOnly web, expo-secure-store mobile); PostgreSQL + Drizzle; Expo SDK 55 + Expo Router v7 replacing React+Vite; TanStack Query v5 + Zustand v5; NativeWind v4; Railway Pro; Claude with native web search.

**Backend transfer to target:**  
- **~70%** can transfer. Routes, auth logic, entity-write, policies, acknowledgments, HR/incidents, activity log, and most of api.js are framework-agnostic. Changes: swap server/lib/db.js to Drizzle + pg (server/db/schema.js and db-pg.js exist but unused); ensure all SQL uses Drizzle or parameterized API; keep cookie/refresh/CSRF as-is.  
- **Blockers:** Every direct `db.prepare(...).run/get/all` must be replaced with Drizzle or a single DB abstraction layer.

**Business logic reuse:**  
- **~75%.** Validation rules, capability checks, targeting logic, content_hash, amendment rules are in server/routes/api.js and server/lib; can be extracted into shared modules. Types and utilities would need to be ported to a shared package or duplicated in Expo.  
- **Hooks (React):** Web uses custom hooks and TanStack Query; Expo does not yet use TanStack Query or Zustand — so “hooks” in the sense of React Query hooks would need to be reimplemented or shared via a monorepo.

**Breaking changes to reach target:**  
1. **Database:** Switch from better-sqlite3 to pg + Drizzle; run Drizzle migrations; remove init-db.js SQLite path or keep for local dev only.  
2. **Web frontend:** Replace React+Vite with Expo for web (Expo web) **or** keep web as-is and only standardize on Expo for mobile — target says “replacing React+Vite” so this is a product decision.  
3. **Auth (web):** Remove localStorage; cookie-only for web (backend ready).  
4. **State (Expo):** Add TanStack Query v5 and Zustand v5 to PolicyVaultExpo if target requires them.  
5. **Styling (Expo):** Add NativeWind v4 to Expo (not present now).  
6. **Hosting:** Configure Railway Pro; env and secrets.  
7. **Claude:** Enable “native web search” in API if required (not currently used).

**Recommended order of migration:**  
1. Backend: Introduce Drizzle as single DB layer; migrate to PostgreSQL (e.g. Railway); run existing Drizzle migrations; remove or gate SQLite.  
2. Web auth: Switch Handbook Policy App to cookie-only; remove token from localStorage.  
3. Expo: Add TanStack Query + Zustand + NativeWind; expand screens to parity as needed.  
4. If replacing web with Expo: build Expo web and deprecate Vite app; else keep both and align API/state patterns.  
5. Railway deploy; CI/CD; monitoring.

**Decisions that conflict or complicate target:**  
- **Two frontends:** Handbook Policy App (Vite) and PolicyVaultExpo (Expo) both exist; target implies one Expo app for web+mobile. Either consolidate on Expo for web or accept two codebases.  
- **Web client still using localStorage:** Delays “httpOnly for web” and keeps XSS risk until client is updated.  
- **Drizzle schema exists for PostgreSQL but app runs SQLite:** Good for eventual migration but adds maintenance (two schemas) until cutover.

---

═══════════════════════════════════════════════════════════
FINAL QUESTION — CROSS-APP INTEGRATION
═══════════════════════════════════════════════════════════

This app is one of three: Inventory and Food Cost (central data hub), Keno Financial Tracker (already on Railway with PostgreSQL), and this HR app (PolicyVault). **How ready is this HR app to share authentication, user profiles, and organizational data with the other two?**

**Current state:**  
- **Auth:** Self-contained. users, super_admins, refresh_tokens are local. JWT is issued and validated with JWT_SECRET; no shared identity provider or SSO.  
- **User profiles:** users + employees (per-org); no shared “platform user” or link to Keno/Inventory.  
- **Organizations:** organizations table is local; platform_locations exists for super-admin but no evidence of shared org ID or schema with other apps.  
- **No shared code or API** in this repo for cross-app auth or org data.

**What would need to change for cross-app integration:**  
1. **Shared auth:** Either a single auth service (e.g. BFF or Auth0/SSO) that all three apps use, or a shared JWT issuer and validation (shared JWT_SECRET or JWKS) and a common “platform user” or “tenant” claim. PolicyVault would need to accept tokens issued by the central hub or auth service and map them to local users/employees or a shared user store.  
2. **User profiles:** Shared user/org store (e.g. in central hub or shared DB) with org_id and roles; PolicyVault would resolve org and permissions from token or central API instead of only local users/employees.  
3. **Organizational data:** Agreed org ID and location ID semantics across apps; PolicyVault would use the same org/location identifiers as Keno and Inventory (e.g. from a shared API or DB).  
4. **Deployment:** If Keno is on Railway with PostgreSQL, moving PolicyVault to Railway and PostgreSQL (per target) would align hosting and allow a shared DB or shared services later.  

**Summary:** PolicyVault is **not** ready today to share auth or org data; it is a standalone app with its own users, orgs, and JWT. To integrate: introduce a shared auth mechanism and shared or linked user/org model, and align deployment and data store (e.g. PostgreSQL on Railway) with the other apps.
