# Noble HR — End-to-end walkthrough audit log

**Date:** 2026-04-03  
**Environment:** SQLite `server/data/noblehr.db`, API `http://localhost:3001`, Vite `http://localhost:5173` (proxy `/api`).  
**Super admin (seeded):** `mccarthy.amyg@gmail.com` — password reset locally via `node server/scripts/seed-super-admin.js '<password>'` (min 8 chars).

---

## Scenario coverage

| Scenario | Status | Notes |
|----------|--------|--------|
| 1 Super Admin login & dashboard | **Pass** | Login → `/SuperAdmin`; org list loads; launch token API works with CSRF + cookies. |
| 1 Launch token → org | **Pass** | `/Launch?token=…` sets impersonation cookie and lands on `/Dashboard` as org admin (`admin@noblehr.local`). |
| 2 Setup wizard | **Skipped** | `Noble HR Test Org` already active; wizard not shown for existing org. |
| 2 Handbook / AI | **Partial** | AI Handbook step runs; API returns clear error when `ANTHROPIC_API_KEY` unset (**expected** in local dev). |
| 2 Policies — new draft | **Not completed** | Policies page loads (“No policies found”); browser automation viewport intermittently narrow (~129px), clicks blocked; manual test recommended. |
| 2 Employee invite | **Not completed** | Same; retrieve invite from `invites` table when needed. |
| 3 Employee accept / ack | **Not completed** | Depends on invite token. |
| 4 Manager verification | **Not completed** | Depends on prior steps. |

---

## Issues found & fixes applied

### 1. Mobile main content hidden behind bottom nav (HIGH — UX)

**Symptom:** Primary actions (e.g. industry select, “Get recommended policies”) sat under the fixed mobile bottom bar; clicks hit `Dashboard` in the nav instead.

**Fix:** Increased bottom padding on the main content wrapper: `pb-36` + `scroll-pb-36` (from `pb-20`) in `Handbook Policy App/src/Layout.jsx`. Users can scroll CTAs above the bar; `scrollIntoView` works better.

**Files:** `Handbook Policy App/src/Layout.jsx`

---

### 2. Noble HR Test Org missing `industry` (MODERATE — blocked AI form CTA)

**Symptom:** “Get recommended policies” stayed disabled until industry was set; org row had empty `industry`.

**Fix:** One-time DB update script `server/scripts/_walkthrough-db-prep.mjs` sets `industry = 'restaurant'` when empty for org named `Noble HR Test Org`. Run: `node server/scripts/_walkthrough-db-prep.mjs`.

**Files:** `server/scripts/_walkthrough-db-prep.mjs` (optional maintenance script)

---

### 3. Inter font (INFO — already wired)

**Note:** `Handbook Policy App/src/index.css` imports Inter from Google Fonts; Tailwind `fontFamily.sans` uses `Inter`. No change required beyond favicon/branding below.

---

### 4. Branding: favicon still pointed at Base44 (LOW)

**Symptom:** `index.html` used `https://base44.com/logo_v2.svg` as favicon.

**Fix:** Added `Handbook Policy App/public/favicon.svg` (Noble “N” on blue) and set `<link rel="icon" href="/favicon.svg" />`.

**Files:** `Handbook Policy App/index.html`, `Handbook Policy App/public/favicon.svg`

---

### 5. Remove legacy Base44 packages (MODERATE — architecture)

**Symptom:** `package.json` still listed `@base44/sdk` and `@base44/vite-plugin` though Vite config no longer used the plugin.

**Fix:** `npm uninstall @base44/sdk @base44/vite-plugin` in `Handbook Policy App`.

**Files:** `Handbook Policy App/package.json`, `package-lock.json`

---

### 6. Legacy Base44 naming in `app-params.js` (LOW)

**Symptom:** LocalStorage keys and env fallbacks referenced `base44_` / `VITE_BASE44_*`.

**Fix:** Keys migrated to `noblehr_*`; old `base44_access_token` still cleared once for cleanup; env defaults renamed to `VITE_APP_ID`, `VITE_FUNCTIONS_VERSION`, `VITE_APP_BASE_URL` (optional).

**Files:** `Handbook Policy App/src/lib/app-params.js`

---

### 7. AI features require API key (INFO — not a code defect)

**Symptom:** After “Get recommended policies”, UI shows: `AI not configured. Set ANTHROPIC_API_KEY.`

**Fix:** Configure `ANTHROPIC_API_KEY` on the server for full AI walkthrough; no app bug.

---

### 8. Legal footer placeholder copy (INFO)

**Symptom:** Footer still shows placeholder text unless `VITE_LEGAL_ENTITY_NAME` is set.

**Fix:** Set env for production; out of scope for this pass.

---

### 9. Cursor MCP browser viewport (TOOLING)

**Symptom:** Automated clicks sometimes reported ~129px width and intercepts; manual testing at real desktop width is more reliable.

---

## Follow-ups (manual)

1. Complete **New Policy** → save draft → **Publish** on `/Policies` and `/PolicyEditor` (or equivalent route).
2. **Employees** → create invite → read `token` from `invites` in `noblehr.db`.
3. Open `/InviteAccept?token=…` (or app route shape) → register employee → login → **My Onboarding** → secure acknowledgment.
4. **Acknowledgement matrix** / compliance views as org admin.
5. **Incident** / write-up + **employee document** upload on employee profile.

---

## Commands reference

```powershell
cd server
node scripts/seed-super-admin.js YourSecurePassword
node scripts/_walkthrough-db-prep.mjs
node server.js
```

```powershell
cd "Handbook Policy App"
npm run dev
```

Super admin **launch token** (requires prior login cookies + CSRF): use browser “Launch” / “Copy Link” on Super Admin, or implement a short-lived admin-only script that mirrors the same API calls.
