# Super Admin Flow – Senior Engineer Audit

**Scope:** Login → Super Admin page → all functions, hooks, workflows, API contracts, security, UX  
**Date:** March 2025

---

## 1. Executive Summary

The Super Admin flow enables platform administrators to approve organizations, manage platform locations, and launch into org instances. This audit identifies **naming confusion** (TEST Location vs Approved Locations), **API response shape inconsistencies**, **missing error handling**, and **26 approved orgs** that appear to be E2E/test artifacts rather than production data.

---

## 2. Login Flow

### 2.1 Entry Points

| Path | Auth Required | Redirect |
|------|---------------|----------|
| `/Login` | No | — |
| `/SuperAdmin` | Yes (super admin) | Redirects to `/Login` if not super admin |
| `/` (authenticated super admin) | Yes | → `/SuperAdmin` |

### 2.2 Super Admin Login (Email/Password)

**Flow:**
1. User submits email + password on `Login.jsx`
2. `handleSubmit` → `login(email, password)` from AuthContext
3. `api.auth.login()` → `POST /api/auth/login`
4. Backend checks `super_admins` table first (before `users`)
5. If match: returns `{ token, user, superAdmin: true, org: null, employee: null }`
6. Login.jsx: `navigate(data?.superAdmin ? createPageUrl('SuperAdmin') : createPageUrl('Dashboard'))`

**Findings:**
- Super admin login works correctly
- Super admins must use **email/password only** — Google Sign-In does **not** support super admin (auth route never checks `super_admins` for Google)
- AuthContext sets `setSuperAdmin(!!data.superAdmin)`; `org` and `employee` are null for super admin

### 2.3 Token & Session

- Token stored in `localStorage` via `api.setToken()` / `api.getToken()`
- Super admin token has no `impersonateOrgId` until Launch flow
- `/api/me` returns `{ superAdmin: true, user: {...}, org: null, employee: null }` for super admin

---

## 3. Super Admin Page – Structure & UX

### 3.1 Section Layout (Top to Bottom)

1. **Header** – Super Admin title, user email, My Account, Sign Out
2. **Pending Approvals** – Orgs with `status = 'pending_approval'` (amber card)
3. **TEST Location** – Single purple card, “Launch Test App” button
4. **Approved Locations** – All orgs with `status = 'active'` (neutral card)
5. **More options** (collapsible) – Platform Locations, All Organizations

### 3.2 Naming & UX Confusion (Critical)

| Term | Meaning | User Expectation |
|------|---------|-------------------|
| **TEST Location** | Single special org `_TEST_Location_SuperAdmin` used to launch a test instance | Often confused with “test locations” in the list below |
| **Approved Locations** | All active organizations (26 in your screenshot) | Label says “locations” but these are **organizations** |
| **Platform Locations** | Global location templates (e.g. “Main Office”) used during org setup | Different concept from org-level locations |

**Recommendations:**
- Rename “TEST Location” → “Launch Test Instance” or “Quick Test” to clarify it’s an action, not a list item
- Rename “Approved Locations” → “Approved Organizations” for accuracy
- Add a short tooltip/description: “Organizations that have completed signup and been approved”

### 3.3 Visual Inconsistency

- **TEST Location** uses `border-violet-200 bg-violet-50/30`, purple button
- **Approved Locations** uses default Card styling, indigo buttons
- **Pending Approvals** uses amber styling

The purple TEST section is intentionally distinct to signal “special/dev” — acceptable, but the label should be clearer.

---

## 4. Data Flow & API Contracts

### 4.1 Load Sequence

On mount (when `superAdmin` is true):

```javascript
loadData() → Promise.all([
  api.superAdmin.orgsWithLocations(),
  api.superAdmin.pendingOrgs(),
  api.superAdmin.allOrgs(),
  api.superAdmin.platformLocations(),
])
```

**API Response Shapes:**

| Method | Returns | Backend Response |
|--------|---------|------------------|
| `orgsWithLocations()` | `res.data` (array) | `{ data: orgs[] }` |
| `pendingOrgs()` | `res.data` (array) | `{ data: orgs[] }` |
| `allOrgs()` | `res.data` (array) | `{ data: orgs[] }` |
| `platformLocations()` | `res.data` (array) | `{ data: locations[] }` |
| `ensureTestOrg()` | `res.data` (object) | `{ data: { organization_id, name } }` |
| `launchToken(orgId)` | Full response | `{ data: { token, launch_link } }` |

### 4.2 API Response Inconsistencies (Bug Risk)

| Method | Frontend Expectation | Actual |
|--------|----------------------|--------|
| `launchToken()` | `const { data } = await api.superAdmin.launchToken(orgId)` | `launchToken` returns full `request()` result = `{ data: { token, launch_link } }` → `data` exists ✓ |
| `ensureTestOrg()` | Was `const { data: testData }` (fixed) | Returns `res.data` = `{ organization_id, name }` → no nested `data` ✓ (now fixed) |

**Current state:** `launchOrg` and `copyAccessLink` use `const { data } = await api.superAdmin.launchToken(orgId)`. Since `launchToken` returns the full response object, `data` is correctly `{ token, launch_link }`. ✓

### 4.3 Error Handling Gaps

- `loadData()`: Errors only `console.error(e)` — no user feedback
- `approveOrg`, `rejectOrg`, `launchOrg`, `copyAccessLink`, `launchTest`, `createLocation`, `confirmDeleteLocation`: All use `alert(e.data?.error || e.message)` — acceptable but not ideal for production (consider toast/notification)
- No retry logic for failed API calls
- No loading skeleton; only a single spinner for the whole page

---

## 5. Workflows – Detailed

### 5.1 Approve / Reject Org

- **Approve:** `approveOrg(orgId)` → `POST /super-admin/approve-org` → `UPDATE organizations SET status = 'active'`
- **Reject:** `rejectOrg(orgId)` → `POST /super-admin/reject-org` → `UPDATE organizations SET status = 'rejected'`
- Both call `loadData()` on success
- `actionLoading` prevents double-clicks

### 5.2 Launch Org (Approved List)

- `launchOrg(orgId)` → `launchToken(orgId)` → opens `launch_link` in new tab
- Launch link: `{FRONTEND_URL}/Launch?token={jwt}`
- JWT payload: `{ isSuperAdmin: true, impersonateOrgId: organization_id, expiresIn: '1h' }`
- Launch page stores token, redirects to Dashboard; `/me` returns org context for impersonated org

### 5.3 Launch Test App

- `launchTest()` → `ensureTestOrg()` → `launchToken(orgId)`
- `ensureTestOrg` creates org `_TEST_Location_SuperAdmin` if missing (single canonical test org)
- Same launch flow as regular org launch

### 5.4 Copy Access Link

- `copyAccessLink(orgId)` → `launchToken(orgId)` → `navigator.clipboard.writeText(launch_link)`
- Duplicate API call per org (could cache token per org if needed)

### 5.5 Platform Locations

- **Create:** `createLocation(name, address)` → `POST /super-admin/create-location`
- **Delete:** Soft delete via `deleted_at`; confirmation dialog before delete
- **List:** Excludes `deleted_at IS NOT NULL`

### 5.6 Profile / Sign Out

- “My Account” → `window.location.href = createPageUrl('Profile')` (full reload)
- “Sign Out” → `logout()` + redirect to Login
- Profile page disables email change and some profile fields for super admin

---

## 6. Hooks & State

### 6.1 AuthContext

- `user`, `org`, `employee`, `superAdmin`, `superAdminImpersonating`, `isAuthenticated`, `isLoadingAuth`, `authError`
- For super admin (non-impersonating): `org = null`, `employee = null`, `superAdmin = true`
- `checkAuth()` runs on mount; `/me` determines super admin status

### 6.2 SuperAdmin Page State

| State | Purpose |
|-------|---------|
| `approvedOrgs` | Active orgs with locations |
| `pendingOrgs` | Pending approval orgs |
| `allOrgs` | All orgs (in More options) |
| `locations` | Platform locations |
| `loading` | Initial load |
| `actionLoading` | Per-action loading (orgId or 'create-loc' or 'delete-{id}') |
| `launchingOrgId` | Org being launched (or '_TEST_') |
| `newLocName`, `newLocAddress` | Create location form |
| `showMore` | Collapsible section |
| `locationToDelete` | Location selected for delete (triggers AlertDialog) |

### 6.3 useEffect Guard

```javascript
useEffect(() => {
  if (!superAdmin) {
    window.location.href = createPageUrl('Login');
    return;
  }
  loadData();
}, [superAdmin]);
```

- Redirects to Login if not super admin
- `loadData` has no dependency array — could re-run unnecessarily if `loadData` identity changes (currently stable)

---

## 7. Security

### 7.1 Backend

- All super admin routes use `requireSuperAdmin` middleware
- `authMiddleware` runs first; JWT must be valid
- Super admin check: `req.superAdmin === true` (from JWT)
- No additional rate limiting on super admin endpoints (consider for approve/reject/launch)

### 7.2 Launch Token

- 1-hour expiry
- Contains `impersonateOrgId` — full org access
- Token in URL briefly; Launch page removes it via `replaceState`

### 7.3 Profile

- Super admin cannot change email (enforced in Profile + backend)
- Password change uses shared `/account/change-password`; backend routes to `super_admins` table when `req.superAdmin`

---

## 8. The 26 “Approved Locations”

**Cause:** `orgs-with-locations` returns all orgs with `status = 'active'`. The 26 orgs are likely:

1. E2E test runs creating orgs like `Test Org 1773039073809`
2. Manual testing creating multiple orgs
3. No cleanup of test orgs

**Recommendations:**
- Add “Delete org” or “Archive org” for super admin (with confirmation)
- Add optional filter: “Hide test orgs” (e.g. name starts with `Test Org` or `_TEST_`)
- Run a one-time cleanup script to remove obvious test orgs
- Consider a `created_by` or `is_test` flag for future filtering

---

## 9. Bugs & Issues Summary

| Severity | Issue | Location |
|----------|-------|----------|
| **Fixed** | `ensureTestOrg` response shape — frontend expected `{ data }` | SuperAdmin.jsx |
| **Medium** | `loadData` errors not shown to user | SuperAdmin.jsx |
| **Low** | Inconsistent API response handling (some return `res.data`, some full response) | client.js |
| **Low** | Reject button has no confirmation | SuperAdmin.jsx |
| **Low** | `createPageUrl('Profile')` uses `window.location.href` (full reload) | SuperAdmin.jsx |
| **Info** | 26 approved orgs likely test data | Database |

---

## 10. Recommendations

### 10.1 UX / Copy

1. Rename “TEST Location” → “Launch Test Instance” or “Quick Test”
2. Rename “Approved Locations” → “Approved Organizations”
3. Add confirmation dialog for Reject (similar to Delete location)

### 10.2 Error Handling

1. Show toast or inline error when `loadData` fails
2. Consider retry button for failed loads

### 10.3 API Client

1. Standardize: either all super admin methods return `res.data`, or document which return full response
2. Add TypeScript types for API responses

### 10.4 Data Management ✅ Implemented

1. Add org archival (soft delete via `deleted_at`) — **Done**
2. Add "Hide test orgs" filter — **Done**
3. Clean up: use Archive to hide test orgs; filter to focus on production

### 10.5 Security

1. Add rate limiting to approve/reject/launch endpoints
2. Audit log for super admin actions (approve, reject, delete location, launch)

---

## 11. Appendix – File Reference

| File | Purpose |
|------|---------|
| `Handbook Policy App/src/pages/Login.jsx` | Login form, super admin redirect |
| `Handbook Policy App/src/pages/SuperAdmin.jsx` | Super admin dashboard |
| `Handbook Policy App/src/lib/AuthContext.jsx` | Auth state, login, checkAuth |
| `Handbook Policy App/src/api/client.js` | API client, superAdmin methods |
| `Handbook Policy App/src/App.jsx` | Routing, super admin route guard |
| `Handbook Policy App/src/pages/Launch.jsx` | Token consumption, redirect to Dashboard |
| `Handbook Policy App/src/pages/Profile.jsx` | Profile (super admin restrictions) |
| `server/routes/auth.js` | Login, super admin check |
| `server/routes/api.js` | /me, super admin routes, getContext |
