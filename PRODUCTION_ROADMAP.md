# PolicyVault — Production Roadmap

**Goal:** Web app production-ready on a hosted server, then mobile (App Store / Play Store).  
**Created:** March 2025

---

## Phase 1 status (started)

| Done | Item |
|------|------|
| ✅ | E2E suite passes (25/25) when server is running |
| ✅ | Security checklist 1.3.1–1.3.4 verified in code |
| ✅ | Nav routes match pages.config; no broken links found |
| ✅ | Manual smoke: Launch Test Instance → Dashboard/Handbook/Policies *(automated: npm run test:smoke — 14/14 passed)* |
| ✅ | Optional: document happy paths in RUNBOOK; add user-facing error on Dashboard load failure |

---

## Prerequisites for Phase 1

- **E2E tests:** Require the API server to be running. In one terminal run `cd server && npm run dev`; in another run `cd server && npm run test:e2e`. Default super admin password for E2E: `PolicyVault2025!` (or set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`).
- **DB:** Run `cd server && npm run init-db` then `npm run seed-super-admin` if the database is new or reset.

---

## Phase 1: Stabilize & Harden the Web App

**Objective:** One stable, secure web app that works end-to-end for all roles. No production deploy yet; focus on flows, tests, and security.

### 1.1 Core flows — lock down and verify

| Flow | Steps | Owner/Notes |
|------|--------|-------------|
| **Super Admin** | Login → Pending approvals → Approve/Reject → Launch Test Instance → Launch org → Copy link → Archive org → Platform locations CRUD | Already audited; ensure E2E covers main paths. |
| **Org signup** | Setup (register) → Pending approval → Super admin approves → Org admin logs in → Dashboard | E2E covers this. |
| **Org admin** | Dashboard → Policies (list, create, publish) → Handbook → Employees → Invites → HR Records → Incidents → Org Settings → Activity Log | Manual + E2E for critical paths. |
| **Employee** | Login/Invite accept → Dashboard → Policies view → Acknowledge → Handbook → My Onboarding → Profile | Verify launch flow and handbook/policies load. |

**Tasks:**
- [x] **1.1.1** Document happy-path steps for Super Admin, Org Admin, Employee (this doc or RUNBOOK). *(Done in RUNBOOK.md § Happy-path flows.)*
- [x] **1.1.2** Run full E2E suite; fix any failures. *(Passed 25/25 with server running.)*
- [x] **1.1.3** Manual smoke: Super Admin → Launch Test Instance → open launched app → Dashboard, Handbook, Policies load without hanging. *(Script: server/scripts/test-smoke-launch.js; npm run test:smoke)*
- [x] **1.1.4** Fix any broken links or 404s in main nav (Layout / pages.config). *(Nav uses pages.config keys; routes match.)*

### 1.2 Testing

| Task | Description |
|------|-------------|
| **1.2.1** | E2E: Ensure test org launch and launched-app /me, handbook-data, policies-for-employee work (already fixed in past chats). |
| **1.2.2** | Add E2E or script: Org admin creates policy, publishes; employee sees policy and can acknowledge (optional for Phase 1). |
| **1.2.3** | Health check and E2E run in CI or pre-deploy script. |

### 1.3 Security pass

| Task | Description |
|------|-------------|
| **1.3.1** | Confirm JWT_SECRET required in production (server exits if missing). |
| **1.3.2** | Confirm CORS/FRONTEND_URL used in production (no wildcard origin). |
| **1.3.3** | Confirm all super-admin and org-scoped routes enforce auth and org_id. |
| **1.3.4** | No tokens in URL for sensitive flows (approve-org, invite, reset-password, launch — already moved to POST/body or removed from URL after read). |

### 1.4 Cleanup and UX

| Task | Description |
|------|-------------|
| **1.4.1** | Identify pages that are stubs or not ready; hide from nav or add “Coming soon” with feature flag. |
| **1.4.2** | Ensure key list pages (Policies, Employees, HR Records, Incidents) have loading and error states. *(Dashboard now has load-error banner + Retry; others have loading.)* |
| **1.4.3** | Consistent 403/401 handling: redirect to Login, clear token; no redirect loops. *(AuthContext handles.)* |

### Phase 1 exit criteria

- [x] E2E suite passes (signup, approval, super admin, launch, org admin features).
- [x] Manual smoke: Launch Test Instance → Dashboard, Handbook, Policies all load. *(test:smoke)*
- [x] Security checklist (1.3) verified.
- [x] No critical broken links or missing error handling on main flows.

### Phase 1 — Security checklist (verified in code)

| Item | Status | Location |
|------|--------|----------|
| **1.3.1** JWT_SECRET required in production | ✅ | `server/lib/auth.js`: production exits if JWT_SECRET unset |
| **1.3.2** CORS / FRONTEND_URL in production | ✅ | `server/server.js`: `isProd` → `CORS_ORIGINS` or `[FRONTEND_URL]`; no wildcard |
| **1.3.3** Super-admin and org-scoped routes | ✅ | `requireSuperAdmin`; `getContext(req)` enforces org |
| **1.3.4** No tokens in URL for sensitive flows | ✅ | Approve-org, invite, reset-password use POST body or strip from URL after read |

---

## Phase 2: UX and design polish (done)

**Objective:** Cohesive, professional UI and copy; no new features. Implemented: smoke test script, Phase 2.1–2.3 (nav labels, error states, a11y titles).

### 2.1 Information architecture

- Audit nav labels vs actual content (e.g. “Acknowledgement Tracking” vs “Matrix”).
- Remove or hide unfinished features; add tooltips/help where needed.

### 2.2 Visual consistency (done)

- Dashboard, Policies, Handbook: load-error banner + Retry; consistent pattern.

### 2.3 Copy and accessibility

- Consistent terminology (e.g. “Organization” vs “Location” where we fixed Super Admin).
- Basic a11y: focus order, labels, contrast.

---

## Phase 3: Production backend (started)

**Objective:** Deploy API + DB to a hosted environment (e.g. Railway); HTTPS, env-based config.

### 3.1 Environment and config (done)

- **.env.example** updated with production block and all vars (JWT_SECRET, FRONTEND_URL, CORS_ORIGINS, SMTP, DATABASE_URL note for future).
- **SQLite** is the current production DB; use a persistent volume. Postgres is documented as a future step (Phase 3b).

### 3.2 Hosting (done)

- **DEPLOY.md** added: build steps, env table, Railway and Render deploy instructions, persistent volume for SQLite, post-deploy checklist.
- **RUNBOOK** updated: production run (`build:client` then `start`), link to DEPLOY.md, persistent volume note.
- **server/package.json:** `build:client` script to build the frontend from the server directory.

### 3.3 Operations (done)

- **Health:** `/api/health` documented for load balancer / host checks.
- **Backups:** RUNBOOK documents backing up `server/data/policyvault.db` and using a persistent volume.
- **Logs:** RUNBOOK notes stdout redirect or Sentry for production.

---

## Phase 4: Mobile (store distribution)

**Objective:** App available on Apple and Android stores.

### Option A — Web wrapper (fast)

- Use Capacitor (or similar) to wrap the existing web app.
- Configure app icons, splash, deep links; build and submit to stores.
- Ensure web app is responsive and touch-friendly.

### Option B — Native app (Expo/React Native)

- New Expo project; reuse API client and auth flow.
- Build native screens for high-value flows (dashboard, acknowledgments, policies).
- Same backend (Phase 3); deploy mobile builds via EAS.

---

## Phase 1 — Immediate next steps (start here)

1. **Run E2E** and fix any failures.
2. **Manual smoke** Super Admin → Launch Test Instance → verify Dashboard, Handbook, Policies in launched app.
3. **Security checklist** (1.3.1–1.3.4) — confirm in code.
4. **Nav audit** — ensure no broken routes; add loading/error where missing on main pages.

Once Phase 1 exit criteria are met, we move to Phase 2 (UX polish), then Phase 3 (deploy).
