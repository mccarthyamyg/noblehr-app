# Antigravity Session Report — April 3, 2026

## What Was Done & Why

### 1. Railway Production Environment Variables (Injected via CLI)
**Files changed:** None (Railway dashboard config)

We authenticated the Railway CLI and pushed the following production variables directly into the `noblehr-app` service on the `respectful-liberation` project:

| Variable | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Enables JSON request logging, secure cookie flags |
| `FRONTEND_URL` | `https://noblehr-app-production.up.railway.app` | Cookie `domain` + CORS origin |
| `CORS_ORIGINS` | `https://noblehr-app-production.up.railway.app` | Explicit allowed origin |
| `JWT_SECRET` | *(32+ char secret)* | Required for token signing |
| `AUTO_SEED_SUPER_ADMIN` | `true` | One-time seed on next deploy |
| `SUPER_ADMIN_PASSWORD` | `TempVaultAdmin2026!` | Temporary first-login password |

**Action required:** After first successful login, remove `AUTO_SEED_SUPER_ADMIN` from Railway variables.

---

### 2. Security Dependency Upgrades
**Files changed:** `server/package.json`, `server/package-lock.json`, `Handbook Policy App/package.json`, `Handbook Policy App/package-lock.json`

- `@anthropic-ai/sdk` → upgraded to latest (closes SDK advisory)
- `drizzle-kit` → upgraded to latest (closes esbuild chain advisory)
- `path-to-regexp` → upgraded to latest (closes ReDoS advisory)
- `npm audit fix` run on both server and frontend

**Why:** These were flagged by Cursor's Phase 3 audit but left unfixed because they contained breaking API changes. Antigravity verified that `claude.js` still works with the new SDK — no breaking syntax changes were needed.

---

### 3. PostgreSQL Schema Dialect Fix
**Files changed:** `server/db/schema.js`

Converted all SQLite-flavored column types to native PostgreSQL types:

| Before (SQLite hack) | After (Native PG) |
|---|---|
| `integer('is_locked').default(1)` | `boolean('is_locked').default(true)` |
| `integer('confirmed').default(0)` | `boolean('confirmed').default(false)` |
| `integer('applies').default(0)` | `boolean('applies').default(false)` |
| `text('effective_date')` | `timestamp('effective_date', { withTimezone: true })` |
| `text('deleted_at')` (on some tables) | `timestamp('deleted_at', { withTimezone: true })` |

**Why:** These were identified as **MIGRATION-BLOCKERS** — PostgreSQL would reject implicit `0`/`1` as boolean, and storing ISO date strings in `text` columns defeats indexing and timezone handling.

---

### 4. AST Surgery: Async/Await Transpilation + PostgreSQL Adapter
**Files changed:** `server/routes/api.js`, `server/routes/auth.js`, `server/lib/auth.js`, `server/lib/audit.js`
**Files created:** `server/lib/db-pg-adapter.js`, `server/scripts/ast-surgery.cjs`

**The Problem:** Every route used synchronous SQLite calls (`db.prepare().get()`). PostgreSQL works over the network and is inherently asynchronous. You cannot just swap the import — every single `.get()`, `.all()`, `.run()` call must be `await`ed, and every enclosing route handler must become `async`.

**The Solution:**
1. Created `db-pg-adapter.js` — a drop-in replacement that:
   - If `DATABASE_URL` is set → routes queries to PostgreSQL (`pg.Pool`)
   - If `DATABASE_URL` is NOT set → falls back seamlessly to the existing SQLite (`better-sqlite3`)
   - Automatically converts `?` placeholders to PostgreSQL `$1, $2, ...` syntax
2. Ran a `jscodeshift` AST transpiler (`ast-surgery.cjs`) across all 4 files that:
   - Converted every `db.prepare().get/all/run()` call to an `await` expression
   - Made every enclosing Express route handler `async`
   - Updated the import from `../lib/db.js` to `../lib/db-pg-adapter.js`

**Why:** This is the single largest architectural change in the app's history. Without this, the PostgreSQL migration would be impossible. The adapter pattern ensures zero downtime — the app continues running on SQLite today and will automatically switch to Postgres when `DATABASE_URL` is provided.

---

### 5. Git Commit & Push
All changes were committed to `main` and pushed to GitHub.

---

## Current Production State
- **Database:** SQLite on persistent volume (unchanged, stable)
- **PostgreSQL:** Code is ready, but no PG database is provisioned yet
- **Auth:** Refresh token cookies, secure flags, auto-seed all deployed
- **Dependencies:** All critical advisories patched
