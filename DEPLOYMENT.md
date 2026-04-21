# PolicyVault — Deployment & Web Hosting

This doc covers everything needed to deploy the app for web hosting and avoid future patching.

---

## 1. Architecture

- **Client:** Vite/React SPA in `Handbook Policy App/`. Build output: `Handbook Policy App/dist/`.
- **Server:** Node.js + Express in `server/`. Serves API at `/api/*` and can serve the built client static files.
- **Database:** SQLite at `server/data/noblehr.db` (run `npm run init-db` in `server/` once before first start).

**Deployment modes:**

- **Same-origin (recommended):** Build client, then run server. Server serves both API and static files from `Handbook Policy App/dist/`. One host, one port.
- **Split (API and client on different hosts):** Build client with `VITE_API_URL` set to the API base URL. Run server with `FRONTEND_URL` and `CORS_ORIGINS` set. Client and server deployed separately.

---

## 2. Environment Variables

### Server (`server/.env`)

Copy from `server/.env.example`. **Required in production:**

| Variable       | Required (prod) | Description |
|----------------|-----------------|-------------|
| `JWT_SECRET`   | **Yes**         | Secret for signing JWTs (min 32 chars). Server exits if unset in production. |
| `NODE_ENV`     | No              | `production` or `development`. |
| `PORT`         | No              | Port (default `3001`). |
| `FRONTEND_URL` | Yes (if split)  | Full URL of the client app (e.g. `https://app.example.com`). Used for invite/reset/launch links and CORS. |
| `CORS_ORIGINS` | Yes (if split)  | Comma-separated allowed origins (e.g. `https://app.example.com`). |

**Optional:** `GOOGLE_CLIENT_ID`, `RESEND_API_KEY` and `EMAIL_FROM` for transactional email (see `server/.env.example`). **`SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` (8+ chars):** applied on server startup (creates/updates super admin); also used for E2E/smoke. Optional legacy: `AUTO_SEED_SUPER_ADMIN=true` with password only.

### Client (`Handbook Policy App/.env` or `.env.production`)

Copy from `Handbook Policy App/.env.example`. All client vars must be prefixed with `VITE_`.

| Variable               | Required | Description |
|------------------------|----------|-------------|
| `VITE_API_URL`         | No       | API base URL. Omit or leave empty for same-origin (`/api`). Set to full API URL (e.g. `https://api.example.com/api`) for split deployment. |
| `VITE_GOOGLE_CLIENT_ID`| No       | Google OAuth Web client ID (same as server’s `GOOGLE_CLIENT_ID` for web). |
| `VITE_BASE_URL`        | No       | Base path for the app (e.g. `/app/`). Default `/`. Only needed if app is not at site root. |

---

## 3. Build & Run

### One-time setup

```bash
# Server: install deps, init DB, (optional) seed super admin
cd server
npm install
npm run init-db
# npm run seed-super-admin   # if you need a super admin user
```

### Same-origin deployment (single host)

```bash
# 1. Build client (from repo root)
cd "Handbook Policy App"
npm install
npm run build

# 2. Start server (serves API + static from Handbook Policy App/dist)
cd ../server
export NODE_ENV=production
export JWT_SECRET=your-secret-at-least-32-characters
# Optional: FRONTEND_URL=https://yourdomain.com
node server.js
# Or: npm start
```

Then open `http://localhost:3001` (or your host/port). No `VITE_API_URL` needed.

### Split deployment (client and API on different hosts)

1. **Build client** with API URL:
   ```bash
   cd "Handbook Policy App"
   echo "VITE_API_URL=https://api.yourdomain.com/api" > .env.production
   npm run build
   ```
2. Deploy `Handbook Policy App/dist/` to your static host (e.g. S3, Netlify, Vercel).
3. **Run server** with CORS and frontend URL:
   ```bash
   cd server
   export NODE_ENV=production
   export JWT_SECRET=...
   export FRONTEND_URL=https://app.yourdomain.com
   export CORS_ORIGINS=https://app.yourdomain.com
   node server.js
   ```

---

## 4. Health Check

- **Endpoint:** `GET /api/health`
- **Response:** `200` with `{ "ok": true, "db": "connected" }` when DB is reachable; `503` otherwise.
- Use this for load balancers and hosting health checks.

---

## 5. Security Checklist

- [ ] `JWT_SECRET` set in production (strong, ≥32 chars).
- [ ] `NODE_ENV=production` in production.
- [ ] `FRONTEND_URL` and `CORS_ORIGINS` set when client is on a different origin.
- [ ] No secrets in client env (only `VITE_*` vars; they are baked into the build).
- [ ] HTTPS in production (handled by your host or reverse proxy).
- [ ] Server runs behind a reverse proxy (e.g. nginx) with `trust proxy` (already set in server).

---

## 6. Foundations (no patching later)

- **Typecheck:** In `Handbook Policy App/` run `npm run typecheck`. This checks the critical paths (api, lib, utils). Optionally run `npm run typecheck:full` to check the full project (fix any new errors before deploy).
- **Lint:** Run `npm run lint` (and `npm run lint:fix` if needed).
- **Tests:** From `server/` with server running on port 3001: `npm run test:smoke`, `npm run test:e2e`.
- **Build:** Run `npm run build` in `Handbook Policy App/` before deploying; ensure it completes with no errors.

Keeping typecheck, lint, tests, and build green ensures stable deployments and avoids one-off patches.
