# PolicyVault HR App — Phased Remediation Plan

**Document Version:** 1.0  
**Created:** March 8, 2025  
**Source:** Issues from TEST_PLAN.md §3 (Potential Weak Points)

---

## Overview

This plan addresses security, data isolation, error handling, edge cases, and configuration issues in phases. After each phase, E2E tests and health checks run to verify no regressions.

---

## Phase 1: Security Fixes (Critical)

| Fix | Location | Change |
|-----|----------|--------|
| **1.1 System Event Actor Forge** | `server/routes/api.js` | Ignore `actor_email` and `actor_name` from `req.body`; always use server-derived identity from `user` |
| **1.2 E2E Super Admin Email** | `server/scripts/test-e2e.js` | Use `process.env.SUPER_ADMIN_EMAIL` with fallback to hardcoded value for local dev |
| **1.3 Activity Log Limit Cap** | `server/routes/api.js` | Cap `limit` at 200 to prevent unbounded queries |

**Test:** `npm run test:e2e` and `npm run test:health`

---

## Phase 2: Data Isolation

| Fix | Location | Change |
|-----|----------|--------|
| **2.1 getEmployeeContext Case** | `server/lib/auth.js` | Use `LOWER(e.user_email) = LOWER(?)` for case-insensitive email match |
| **2.2 Auth Pass DB Email** | `server/routes/auth.js` | Pass `user.email` (from DB) to `getEmployeeContext` instead of raw body/payload email in login, google, invite-accept |

**Test:** `npm run test:e2e`

---

## Phase 3: Error Handling

| Fix | Location | Change |
|-----|----------|--------|
| **3.1 Auth Error Sanitization** | `server/routes/auth.js` | In production (`NODE_ENV=production`), return generic `"An error occurred"` instead of `e.message` |

**Test:** `npm run test:e2e`

---

## Phase 4: Edge Cases

| Fix | Location | Change |
|-----|----------|--------|
| **4.1 Pending Re-Acknowledgments** | `server/routes/api.js` | In `my-onboarding` and `my-acknowledgments`, fetch real `pending_re_acknowledgments` for employee from DB |
| **4.2 Acknowledge HR Record** | `server/routes/api.js` + `init-db.js` | Add `acknowledged_at`, `acknowledged_by_email` to `hr_records`; implement real logic: verify record exists, employee is subject, record not locked, then update |
| **4.3 System Events Limit** | `server/routes/api.js` | Add limit cap (e.g. 200) to `system-events` query if applicable |

**Test:** `npm run test:e2e`

---

## Phase 5: Config & Email

| Fix | Location | Change |
|-----|----------|--------|
| **5.1 .env.example** | `server/.env.example` | Add `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` for E2E/CI; document JWT_SECRET requirement |
| **5.2 Invite Email (Deferred)** | — | Optional: when SMTP configured, send invite email. Current behavior: link-only; admin shares manually. |

**Test:** `npm run test:e2e`

---

## Phase 6: Final Verification

- Run full E2E suite
- Run health check
- Manual smoke: login, super admin approve, invite accept, forgot password

---

## Completion Status (March 8, 2025)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ✅ Done | System event actor fix, E2E env var, activity limit cap |
| Phase 2 | ✅ Done | getEmployeeContext case-insensitive, auth passes DB email |
| Phase 3 | ✅ Done | Auth errors sanitized in production |
| Phase 4 | ✅ Done | Pending re-acks from DB, HR acknowledge logic, system-events limit |
| Phase 5 | ✅ Done | .env.example updated |
| Phase 6 | ✅ Done | E2E: 25/25 passed; health check: OK |

---

## Rollback

Each phase is independent. If issues arise, revert the specific commits for that phase.
