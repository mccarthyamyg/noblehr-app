# PolicyVault — Architecture & Foundations

Single reference for how the app is built: architecture, flows, navigation, security, and “normal” UX (forgot password, back buttons, etc.).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (Vite + React)  —  Handbook Policy App/                 │
│  • React Router (basename from VITE_BASE_URL)                    │
│  • AuthContext (user, org, employee, superAdmin, login/logout)   │
│  • useOrg / usePermissions (wraps AuthContext, permission flags)  │
│  • API client (src/api/client.js) → VITE_API_URL or /api         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / fetch (JWT in Authorization)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server (Node + Express)  —  server/                             │
│  • /api/auth/* (login, register, forgot-password, reset-password)│
│  • /api/* (me, account/*, invites, super-admin, invoke)         │
│  • /api/health (no auth)                                        │
│  • Static: serves Handbook Policy App/dist when present         │
│  • SQLite (server/data/policyvault.db)                           │
└─────────────────────────────────────────────────────────────────┘
```

- **Routing:** `pages.config.js` + `App.jsx` define routes; Layout wraps authenticated pages and provides sidebar nav from `createPageUrl(page)`.
- **Data:** Pages call `api.invoke('functionName', { ... })` or `api.auth.*` / `api.account.*`; token from `localStorage`; org/employee from AuthContext after `/me`.
- **Permissions:** `usePermissions()` → `isAdmin`, `isOrgAdmin`, etc.; nav items and PermissionGate hide or show UI by role.

---

## 2. Auth & Account Flows

| Flow | Route | Client | Server | Notes |
|------|--------|--------|--------|--------|
| **Login** | `/Login` | `Login.jsx` | `POST /api/auth/login` | Email/password + optional Google; redirects Super Admin → SuperAdmin, else → Dashboard. |
| **Logout** | — | Layout “Sign Out”, AuthContext | Client clears token | `navigate(createPageUrl('Login'), { replace: true })`. |
| **Register (Setup)** | `/Setup` | `Setup.jsx` | `POST /api/auth/register` | New org; pending approval; link to RequestApprovalAgain on auth error. |
| **Forgot password** | `/ForgotPassword` | `ForgotPassword.jsx` | `POST /api/auth/forgot-password` | Enter email → “If that email exists…” message; **Back to Sign In** (Link). |
| **Reset password** | `/ResetPassword` | `ResetPassword.jsx` | `POST /api/auth/reset-password` | Token from URL (stored, then removed from URL); new password + confirm; success → Sign In link; **Back to Sign In** on form. |
| **Change password** | (Profile) | `Profile.jsx` | `POST /api/account/change-password` | Logged-in; current + new + confirm; success/error message. |
| **Change email** | (Profile) | `Profile.jsx` | `POST /api/account/change-email` | Logged-in; new email + password; then refreshContext. |
| **Update profile** | (Profile) | `Profile.jsx` | `POST /api/account/update-profile` | Name, phone, reminders; then refreshContext. |
| **Forgot email** | `/ForgotEmail` | `ForgotEmail.jsx` | — | Info only: “Contact your organization administrator”; links to Login and RequestApprovalAgain. |
| **Request approval again** | `/RequestApprovalAgain` | `RequestApprovalAgain.jsx` | (approval flow) | For rejected org signups; link from Login auth error and ForgotEmail. |
| **Invite accept** | `/InviteAccept` | `InviteAccept.jsx` | `POST /api/auth/invites/accept` | Token in URL; set password, join org. |
| **Approve org** | `/ApproveOrg` | `ApproveOrg.jsx` | `POST /api/auth/approve-org` | Super admin; token in URL. |
| **Launch (impersonate)** | `/Launch` | `Launch.jsx` | Launch token in URL | Super admin launches into org context. |

All auth routes are public (no Layout sidebar). Login has links: **Forgot password?**, **Forgot email?**, **Set up your organization**, and auth-error link to **Request approval again**.

---

## 3. Navigation & Back Behavior

| Place | Behavior |
|-------|----------|
| **Sidebar** | Links via `createPageUrl(item.page)`; `title="Go to {name}"`; active state by `currentPageName`. |
| **Logout** | `navigate(createPageUrl('Login'), { replace: true })` so base URL is respected. |
| **PolicyView** | **Back** → `Link to={createPageUrl('Policies')}`. |
| **PolicyEditor** | **Back** → `Link to={createPageUrl('Policies')}`. |
| **EmployeeProfile** | **Back** → `Link to={createPageUrl('Employees')}`. |
| **ForgotPassword** | **Back to Sign In** → `Link to={createPageUrl('Login')}` (after send and on form). |
| **ResetPassword** | **Back to Sign In** → `Link to={createPageUrl('Login')}` on form; **Sign In** after success. |
| **ForgotEmail** | **Back to Sign In** → `Link to={createPageUrl('Login')}`. |
| **RequestApprovalAgain** | **Back to Sign In** → button to `createPageUrl('Login')`. |
| **Setup** | Step **Back** buttons → previous step (no route change). |
| **SmartGeneratorDialog** | **Back** → previous step in wizard. |

Detail pages (policy, employee) use **Back** with `Link` to the list page so history and base URL work. Auth pages use **Back to Sign In** / **Sign In** with `createPageUrl('Login')`.

---

## 4. Visual & UX Consistency

- **Loading:** Key list/settings pages show “Loading…” (or similar) while data is fetched.
- **Error + Retry:** Dashboard, Policies, Handbook, SuperAdmin, HRRecords, Employees, Incidents, ActivityLog, AcknowledgementTracking, Onboarding, OrgSettings have loadError state and a Retry button (same pattern).
- **Empty states:** EmptyState component or inline text where lists can be empty.
- **Public/auth pages:** Centered card, same gradient background; primary actions (Sign In, Send Reset Link, etc.) and secondary (Back to Sign In) consistent.
- **Layout:** Sidebar (desktop) and mobile drawer with same nav items; Sign Out at bottom; impersonation banner when super admin is viewing as org.

---

## 5. Security (Foundations)

| Layer | What’s in place |
|-------|------------------|
| **Auth** | JWT in `Authorization: Bearer`; server validates on /me and protected routes. |
| **Server** | `helmet`, CORS from env, `trust proxy`, body size limit; rate limits on auth endpoints (login, register, forgot-password, reset-password, invite accept, etc.) and general `/api`. |
| **Production** | `JWT_SECRET` required (server exits if unset); `FRONTEND_URL` / `CORS_ORIGINS` for split deploy. |
| **Client** | Token in localStorage; no secrets in client (only `VITE_*` env). |
| **Permissions** | Nav and PermissionGate use `usePermissions()`; server enforces by org/employee and role. |
| **Reset token** | Stored in sessionStorage and stripped from URL after read to avoid referrer/history leaks. |

---

## 6. Connections & Data Flow

- **AuthContext:** On load, `checkAuth()` → `api.me()`; sets user, org, employee, superAdmin. Login/register set token and context; logout clears token and state.
- **useOrg:** Exposes AuthContext’s org, employee, loading, refreshOrg (calls `refreshContext`), logout. Used by Layout and pages.
- **usePermissions:** Derives isAdmin, isOrgAdmin, etc. from `useOrg().employee`.
- **API:** All server calls go through `src/api/client.js`; base URL from `VITE_API_URL` or `/api`; errors can have `.status` and `.data` (see `vite-env.d.ts` Error augmentation).
- **Invoke:** Backend functions called via `api.invoke('functionName', { organization_id, ... })`; server resolves org/employee from JWT and applies permissions.

---

## 7. Checklist: “Normal” Things

- [x] **Forgot password** — ForgotPassword page, email submit, Back to Sign In, server forgot-password + reset-password.
- [x] **Forgot email / username** — ForgotEmail page (contact admin + request approval again); linked from Login.
- [x] **Change password** — Profile, change password form, server change-password.
- [x] **Back buttons** — Detail pages (Policy, Employee, Editor) back to list; auth pages Back to Sign In; Layout logout to Login.
- [x] **Navigation** — Sidebar and mobile drawer, createPageUrl for all links; Router basename for subpath.
- [x] **Security** — JWT, rate limits, CORS, JWT_SECRET in prod, permissions in UI and server.
- [x] **Reset password** — Token in URL → sessionStorage, URL cleaned; form has Back to Sign In; success → Sign In link.
- [x] **Login links** — Forgot password, Forgot email, Set up organization, Request approval again (on error) use `Link` and `createPageUrl`.

This doc should stay in sync with the app so foundations, flows, connections, visuals, and “normal” behaviors are clear and consistent.
