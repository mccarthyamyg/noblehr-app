# PolicyVault Runbook

**Last updated:** March 2025

---

## Prerequisites

- Node.js 18+
- SQLite3 (via better-sqlite3)

---

## First-Time Setup

```bash
# 1. Install server deps
cd server && npm install

# 2. Initialize database
node scripts/init-db.js

# 3. (Optional) Google Sign-In
# - Create a project in Google Cloud Console, enable "Google+ API" / "Google Identity Services"
# - Create OAuth 2.0 credentials (Web application), add authorized origins (e.g. http://localhost:5173, http://localhost:3001)
# - Set GOOGLE_CLIENT_ID in server/.env and VITE_GOOGLE_CLIENT_ID in Handbook Policy App/.env.local

# 4. Install frontend deps
cd "../Handbook Policy App" && npm install

# 5. Set env (production)
export JWT_SECRET="your-secure-random-secret"
export NODE_ENV=production
```

---

## Running

### Development

```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Frontend
cd "Handbook Policy App" && npm run dev
```

- Server: http://localhost:3001
- Frontend: http://localhost:5173 (proxies /api to server)

### Production (single server)

```bash
# Build frontend, then start server (serves API + static from dist/)
cd server && npm run build:client && npm start
```

- App: http://localhost:PORT (or set FRONTEND_URL for invite/reset links)
- Full deploy guide (Railway, Render, env): see **DEPLOY.md**

---

## Health Check

```bash
curl http://localhost:3001/api/health
# Expected: {"ok":true,"db":"connected"}
```

## Smoke test (Launch flow)

With the server running, set the same credentials as in the DB (match `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` if you use env-based sync):

```bash
cd server && SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=YourPass123! npm run test:smoke
```

E2E: `SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run test:e2e`

**Production / Railway:** If both `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (8+ chars) are set, the server applies them on **each startup** (see `server/server.js`). Legacy: `AUTO_SEED_SUPER_ADMIN=true` with password only uses the seed script’s default email when `SUPER_ADMIN_EMAIL` is unset.

Verifies: super admin login → ensure test org → launch token → GET /me, policies-for-employee, handbook-data, my-acknowledgments (Dashboard/Handbook/Policies would load in browser).

---

## Database

- **Path:** `server/data/noblehr.db` (see `server/lib/db.js`)
- **Backup:** `npm run backup --prefix server`, or copy the file / use volume snapshots
- **Restore:** Stop server, replace `noblehr.db` with backup, restart.
- **Production:** Use a persistent volume (Railway/Render disk) mounted at `server/data` so the DB survives deploys.

---

## Rollback

1. Revert code (git).
2. If schema changed: restore DB from backup or run migration down.
3. Rebuild frontend: `npm run build`
4. Restart server.

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| 401 Unauthorized | Token expired or invalid; user must re-login |
| 403 Forbidden | Permission check failed; verify org_id and role |
| 503 on /health | DB connection failed; check DB file exists and is readable |
| Rate limit 429 | Wait 1 min or increase limit in server.js |

---

## Logs and operations

- **Logs:** Console only. In production, redirect to file or use a logging service: `npm start >> logs/app.log 2>&1`. Optional: Sentry (or similar) for error tracking.
- **Health:** Use `/api/health` for load balancer or host health checks (returns 200 when DB is connected).
- **Backups:** Schedule `npm run backup --prefix server` or copies of `server/data/noblehr.db` (cron or host backup). See Database above.

---

## Happy-path flows (manual smoke)

Use these to verify core flows after changes or before release.

### Super Admin

1. Log in at http://localhost:5173/Login with super admin email/password (`server/.env` / Railway: `SUPER_ADMIN_*`, or run `npm run seed-super-admin` once).
2. You should land on **Super Admin**.
3. **Pending approvals:** If any orgs are pending, use Approve or Reject (with confirmation).
4. **Launch Test Instance:** Click “Launch Test App” → a new tab opens the app as the test org; confirm Dashboard, Handbook, and Policies load (no infinite loading).
5. **Approved Organizations:** Pick an org → Copy Link or Launch; confirm the launched app loads.
6. **More options:** Expand → add/delete Platform Location (with delete confirmation); review All Organizations.

### Org Admin (after approval)

1. Log in with an org admin account (or use Super Admin → Launch for an approved org).
2. **Dashboard:** Stats and links load; no error banner.
3. **Policies:** List policies; create a draft, publish; view as employee.
4. **Handbook:** Open handbook; confirm content loads.
5. **Employees:** List; create invite (link is returned; transactional email uses Resend when `RESEND_API_KEY` is set — see `server/.env.example`).
6. **HR Records / Incidents:** List; create if needed.
7. **Settings:** Org Settings, Activity Log — load without error.

### Employee

1. Log in via invite-accept flow or as an existing employee.
2. **Dashboard:** “Your Policies & Compliance”; pending acknowledgments visible if any.
3. **Policies:** View and acknowledge a policy (if required).
4. **Handbook:** Open and read.
5. **My Onboarding:** See assigned onboarding if any.
6. **My Account:** Profile, change password — no errors.
