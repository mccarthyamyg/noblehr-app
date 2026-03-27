# PolicyVault — Deploy to production

This guide covers deploying the web app to a hosted server (e.g. **Railway**, Render, Fly.io). The app runs as a **single Node server** that serves both the API and the static frontend (SQLite for now; Postgres can be added later).

---

## 1. What gets deployed

- **Backend:** Node.js (Express) on `PORT` (default 3001).
- **Frontend:** Static files (Vite build) served from the same server at `/`; API at `/api`.
- **Database:** SQLite file at `server/data/policyvault.db`. On Railway/Render use a **persistent volume** so the file survives restarts.

---

## 2. Build and run locally (production mode)

```bash
# From project root

# 1. Install dependencies (if not already)
cd server && npm install
cd "../Handbook Policy App" && npm install

# 2. Build the frontend (output: Handbook Policy App/dist)
cd "../Handbook Policy App" && npm run build

# 3. Initialize DB and seed super admin (first time only)
cd ../server && npm run init-db && npm run seed-super-admin

# 4. Set production env (see below)
# export NODE_ENV=production
# export JWT_SECRET=your-secret-at-least-32-chars
# export FRONTEND_URL=https://yourdomain.com

# 5. Start the server (serves API + static frontend)
cd ../server && npm start
```

Or from the **server** directory after building the client once:

```bash
cd server
npm run build:client   # builds Handbook Policy App into dist
npm start
```

Then open `http://localhost:3001` — the app and API are on the same origin.

---

## 3. Environment variables (production)

Set these on your host (Railway dashboard, Render dashboard, or `.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `JWT_SECRET` | Yes | Random secret (e.g. 32+ chars). Server exits if unset in prod. |
| `PORT` | No | Default 3001; host often sets this (e.g. Railway sets PORT). |
| `FRONTEND_URL` | Yes | Full app URL, e.g. `https://yourapp.up.railway.app` (for invite/reset/launch links). |
| `CORS_ORIGINS` | No | Comma-separated origins; defaults to `FRONTEND_URL` if unset. |
| `GOOGLE_CLIENT_ID` | No | For Google Sign-In. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | No | For E2E/CI; in prod you use seed-super-admin and set your own. |
| SMTP_* | No | For approval and password-reset emails; optional. |

---

## 4. Deploy on Railway

1. **Create a new project** and add a **Web Service** (not a static site).

2. **Connect the repo** and set:
   - **Root directory:** leave default (repo root) or set to the folder that contains `server` and `Handbook Policy App`.
   - **Build command:** Build the client and install server deps. Example (from repo root):
     ```bash
     cd "Handbook Policy App" && npm ci && npm run build && cd ../server && npm ci
     ```
     Or use a single script in a root `package.json` if you add one.
   - **Start command:** From repo root, something like:
     ```bash
     cd server && node server.js
     ```
     Ensure the server’s working directory is `server` so `data/` and paths resolve. If Railway runs from repo root:
     ```bash
     node server/server.js
     ```
     But then `__dirname` in server is `server/`, so `data` is `server/data` — that’s fine. Check that `server.js` and `lib/db.js` paths are correct when started from repo root (they use `__dirname` so they should be).

3. **Persistent volume (SQLite):** Add a volume and mount it to a path, e.g. `server/data`. Configure the app so the SQLite file is written there (it already is: `server/data/policyvault.db`). So mount the volume at `server/data` (or the path your app uses).

4. **Env vars:** Set `NODE_ENV=production`, `JWT_SECRET`, `FRONTEND_URL` (your Railway app URL, e.g. `https://policyvault-production.up.railway.app`).

5. **First deploy:** After the first successful deploy, run migrations and seed super admin. Use Railway’s “one-off command” or a deploy hook:
   ```bash
   cd server && npm run init-db && npm run seed-super-admin
   ```
   Or run them once via Railway CLI or a temporary script.

6. **Health check:** Set the health check path to `/api/health`. Railway will use it to know when the app is up.

---

## 5. Deploy on Render

1. **New Web Service**, connect repo.
2. **Build:** `cd "Handbook Policy App" && npm install && npm run build && cd ../server && npm install`
3. **Start:** `cd server && npm start` (or `node server.js` from server directory).
4. **Env:** Same as above; set `FRONTEND_URL` to your Render URL.
5. **Persistent disk:** Add a disk and mount to `server/data` so SQLite persists.
6. **Init DB:** Run `init-db` and `seed-super-admin` once (Render shell or one-off).

---

## 6. Post-deploy checklist

- [ ] `https://your-app-url/api/health` returns `{"ok":true,"db":"connected"}`.
- [ ] Open `https://your-app-url` and see the login page (no blank or 404).
- [ ] Log in as super admin (after seeding); Super Admin page loads.
- [ ] Set up SMTP (optional) for approval and password-reset emails.

---

## 7. Postgres (future)

The app currently uses **SQLite**. To switch to **Postgres** you would:

1. Add a Postgres driver (e.g. `pg`) and an adapter in `server/lib/db.js` that matches the current `db.prepare().run/get/all` usage, or refactor routes to use async SQL.
2. Set `DATABASE_URL` in production and run schema migrations (derived from `server/scripts/init-db.js`).
3. Keep SQLite as the default when `DATABASE_URL` is unset so local dev is unchanged.

That’s a separate phase; this guide uses SQLite with a persistent volume.
