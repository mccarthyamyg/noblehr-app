# PolicyVault HR Governance Platform

A self-hosted HR policy management and acknowledgment platform. Employees can access from any device (iOS, Android, tablets, laptops) to acknowledge handbooks and policies.

## Quick Start

### 1. Initialize the database
```bash
cd server
npm install
node scripts/init-db.js
```

### 2. Start the backend
```bash
cd server
npm run dev
```
Server runs on http://localhost:3001

### 3. Start the frontend
```bash
cd "Handbook Policy App"
npm install
npm run dev
```
Frontend runs on http://localhost:5173 (proxies /api to backend)

### 4. First-time setup
1. Open http://localhost:5173/Setup
2. Create your organization: name, industry, your email/password
3. Add locations, roles, departments
4. You're the org admin

### 5. Add employees
- Go to Employees → Add Employee
- Enter email, name, role, location
- A user account is created; share the app URL and they sign in with their email + temp password (check server logs for temp password, or add email sending later)

## Production deployment

1. **Build frontend:** `cd "Handbook Policy App" && npm run build`
2. **Set JWT_SECRET:** `export JWT_SECRET=your-secure-secret`
3. **Run server:** `cd server && npm start`
4. The server serves the built frontend from `Handbook Policy App/dist` when present

## PWA (App-like on mobile)

The app is responsive. To make it installable as a PWA, add a `manifest.json` and service worker. The viewport and mobile nav are already in place.

## Tech Stack

- **Frontend:** React 18, Vite 6, Tailwind, shadcn/ui
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Auth:** JWT (email/password)
