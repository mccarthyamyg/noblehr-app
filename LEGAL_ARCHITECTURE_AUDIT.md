# PolicyVault — Legal & Architecture Audit

**Senior Engineer Level | Legal Defensibility Focus**  
**Date:** March 2025  
**Status:** Remediation completed (March 2025)

---

## Executive Summary

PolicyVault manages legally sensitive HR data: policy acknowledgments, disciplinary records, and incident reports. This audit identifies **critical legal defects**, **high-risk gaps**, and **recommendations** for production readiness.

**Overall verdict:** The architecture has solid foundations (immutability design, multi-tenant model, content hashing). **All P0 and P1 issues have been remediated.** See "Remediation Status" at end of document.

---

## 1. CRITICAL DEFECTS (Must Fix Before Production)

### 1.1 Acknowledgment Applicability Not Verified

**Location:** `server/routes/api.js` — `create-acknowledgment`

**Issue:** The backend does **not** verify that the policy applies to the employee before creating an acknowledgment. The comment says "Verify applicable (simplified - could call applicable-policies logic)" but the logic is never invoked.

**Legal risk:** An employee could acknowledge a policy that was explicitly excluded for their role/location via `PolicyTargetingOverride`. In a dispute, an employer could not prove the employee was required to acknowledge that policy. The acknowledgment could be invalidated.

**Fix:** Call `getApplicablePolicies` (or inline the same logic) before creating the acknowledgment. Reject if the policy is not in the applicable set.

---

### 1.2 HR Record / Incident Updates Do Not Create Amendment Records

**Location:** `server/routes/api.js` — entity-write `action: 'update'` for HRRecord/IncidentReport

**Issue:** When HR records or incident reports are updated, the code performs a direct `UPDATE` without creating an `Amendment` record. The `Amendment` table exists but is never populated.

**Legal risk:** Employment law and NLRB guidance require a clear audit trail for disciplinary records. Any change to a write-up or incident report must be logged with: who changed it, what changed, when, and why. Without Amendment records, the chain of custody is broken.

**Fix:** Before every `UPDATE` on `hr_records` or `incident_reports`, create an `Amendment` record with `field_changed`, `old_value`, `new_value`, `amended_by_email`, `record_id`, `record_type`.

---

### 1.3 HR Record Create Not Restricted to Admin

**Location:** `server/routes/api.js` — entity-write

**Issue:** The admin-only check applies to Policy, Handbook, Onboarding, Location, PolicyTargetingOverride. **HRRecord** and **IncidentReport** are not in that list. Any authenticated user can create an HRRecord for any employee.

**Legal risk:** An employee could create a false write-up for another employee or themselves. Disciplinary records must be created only by authorized personnel.

**Fix:** Add `HRRecord` to the admin-only entity list. For `IncidentReport`, allow employees to create only for themselves (`employee_id === current_employee.id`).

---

### 1.4 XSS — Unsanitized HTML in Policy/HR Content

**Location:**  
- `MyOnboarding.jsx` line 195: `dangerouslySetInnerHTML={{ __html: selectedPolicy?.currentVersion?.content || '' }}` — **no DOMPurify**
- `MyWriteUps.jsx` lines 99, 169: `dangerouslySetInnerHTML={{ __html: record.description }}` — **no sanitization**
- `EmployeeProfile.jsx` line 180: `dangerouslySetInnerHTML={{ __html: record.description }}` — **no sanitization**

**Legal risk:** Malicious content in policy or HR records could execute scripts in the user's browser. If an attacker injects content, the employer could be liable. Policy content is admin-controlled but HR descriptions could be user-supplied.

**Fix:** Apply `DOMPurify.sanitize()` to all user-generated or policy content before rendering. PolicyView and Handbook already use DOMPurify; align MyOnboarding, MyWriteUps, EmployeeProfile.

---

### 1.5 Amendment Table Missing organization_id

**Location:** `server/scripts/init-db.js` — `amendments` table

**Issue:** The `amendments` table has no `organization_id` column. Multi-tenant isolation cannot be enforced for amendments.

**Legal risk:** In a multi-tenant deployment, a query could theoretically return amendments from another organization. Data leakage.

**Fix:** Add `organization_id TEXT NOT NULL` to `amendments` and populate it. Add index. Filter all amendment queries by `organization_id`.

---

## 2. HIGH-RISK GAPS

### 2.1 No Policy Applicability Check Before Acknowledgment (Duplicate of 1.1)

Already covered above.

---

### 2.2 PendingReAcknowledgment Not Created on Publish

**Location:** `server/routes/api.js` — `publish-policy`

**Issue:** When a policy is published (new version), the system does not create `PendingReAcknowledgment` records for employees who had previously acknowledged an older version. The original design required re-acknowledgment when policy content changes.

**Legal risk:** Employees who acknowledged v1 may never be prompted to re-acknowledge v2. If v2 contains material changes, the employer cannot prove the employee acknowledged the current version.

**Fix:** After publishing, for each employee who has an existing `Acknowledgment` for this policy and whose role/location still applies, create a `PendingReAcknowledgment` for the new version.

---

### 2.3 No Database-Level Immutability Enforcement

**Location:** Schema — PolicyVersion, Acknowledgment, SystemEvent, Amendment

**Issue:** No triggers or constraints prevent `UPDATE` or `DELETE` on these tables. Enforcement is application-only. A bug or direct DB access could corrupt records.

**Legal risk:** In a forensic scenario, a party could argue that records were altered. Without DB-level protection, the integrity is harder to prove.

**Fix:** Add SQLite triggers or application-level guards that reject DELETE/UPDATE on these tables. Consider read-only replicas for audit logs.

---

### 2.4 Timestamps Not Explicitly UTC

**Location:** `datetime('now')` in SQLite, `new Date().toISOString()` in Node

**Issue:** SQLite `datetime('now')` returns local time. For legal consistency, all timestamps should be stored in UTC with timezone metadata.

**Legal risk:** Disputes across timezones or jurisdictions require unambiguous timestamps. "When did the employee acknowledge?" must be unambiguous.

**Fix:** Use `datetime('now', 'utc')` in SQLite. Store timezone in metadata where relevant. Document timestamp format in audit export.

---

### 2.5 No Content Hash Verification Endpoint

**Location:** Missing

**Issue:** Acknowledgment records store `content_hash` (SHA-256 of policy version content). There is no endpoint to verify that the hash still matches the stored PolicyVersion content. Tampering could go undetected.

**Legal risk:** If PolicyVersion content were altered (e.g., by a bug), the acknowledgment would no longer match. No automated way to detect this.

**Fix:** Add `GET /api/verify-acknowledgment/:id` that recomputes the hash from PolicyVersion and compares to Acknowledgment.content_hash. Return match/mismatch. Include in periodic compliance checks.

---

### 2.6 No IP/Session Capture for Acknowledgments

**Location:** `create-acknowledgment`

**Issue:** Acknowledgment records do not capture IP address or session identifier. In a dispute, "who actually clicked" could be questioned.

**Legal risk:** Lower than the above, but in some jurisdictions or union contexts, additional proof of identity may be requested.

**Fix:** Optionally capture `ip_address` and `user_agent` from `req` and store in Acknowledgment or SystemEvent. Document in privacy policy.

---

## 3. MEDIUM-RISK ITEMS

### 3.1 JWT_SECRET Default in Code

**Location:** `server/lib/auth.js`

**Issue:** `JWT_SECRET` defaults to a hardcoded string if not set. In production, this must be overridden.

**Fix:** Require `JWT_SECRET` in production. Fail startup if not set and `NODE_ENV=production`.

---

### 3.2 HR Record Amendment Log Expects Different Schema

**Location:** `HRRecordAmendmentLog.jsx` — expects `amend.created_date`, `amend.amended_by_name`, `amend.amendment_note`

**Issue:** The `amendments` table has `created_at`, `amended_by_email`, and no `amendment_note`. The UI will show broken or empty data.

**Fix:** Align schema: add `amendment_note` if needed, or map `created_at` → `created_date` and resolve `amended_by_email` to name in the API.

---

### 3.3 secureIncidentWrite Parameter Mismatch

**Location:** `Incidents.jsx` calls `secureIncidentWrite` with `action: 'create'`, `form`, `location_name` — but `entity-write` expects `action`, `entity_type`, `organization_id`, `data`.

**Issue:** The frontend passes a different structure than the backend expects. Incident creation may fail or behave incorrectly.

**Fix:** Add a dedicated `secureIncidentWrite` route or adapt the client to pass `entity_type: 'IncidentReport'` and `data: { ...form, employee_id }` correctly.

---

### 3.4 No Rate Limiting

**Location:** All API routes

**Issue:** No rate limiting on auth or API endpoints. Vulnerable to brute force and DoS.

**Fix:** Add rate limiting (e.g., express-rate-limit) on login and sensitive endpoints.

---

## 4. WHAT IS DONE WELL

| Area | Status |
|------|--------|
| **Multi-tenant isolation** | organization_id on entities; queries filtered by org |
| **Backend authority** | Employee identity from session; org_id never trusted from client |
| **Content hashing** | SHA-256 of policy version stored with acknowledgment |
| **Immutability design** | PolicyVersion, Acknowledgment, SystemEvent, Amendment are append-only by design |
| **HR/Incident locking** | is_locked when resolved/dismissed; blocks further edits |
| **Audit trail** | SystemEvent for policy.acknowledged, policy.published, policy.archived |
| **Policy targeting** | getApplicablePolicies consolidates override logic |

---

## 5. RECOMMENDED REMEDIATION ORDER

1. **P0 — Before any production use**
   - Fix 1.1: Verify policy applicability before acknowledgment
   - Fix 1.2: Create Amendment records on HR/Incident updates
   - Fix 1.3: Restrict HRRecord create to admin; IncidentReport create to self only
   - Fix 1.4: Sanitize all HTML with DOMPurify
   - Fix 1.5: Add organization_id to amendments

2. **P1 — Before legal defensibility claim**
   - Fix 2.2: Create PendingReAcknowledgment on publish
   - Fix 2.4: Use UTC for all timestamps
   - Fix 2.5: Add content hash verification endpoint

3. **P2 — Before scale**
   - Fix 2.3: Database-level immutability (triggers or guards)
   - Fix 2.6: Optional IP/session capture
   - Fix 3.1: JWT_SECRET enforcement
   - Fix 3.3: secureIncidentWrite parameter alignment
   - Fix 3.4: Rate limiting

---

## 6. LEGAL DOCUMENTATION RECOMMENDATIONS

- **Privacy Policy:** Disclose what data is collected (employee, role, location, timestamps, optionally IP).
- **Retention Policy:** Define how long acknowledgments, HR records, and audit logs are retained. Document in system.
- **Employee Consent:** Ensure acknowledgment flow includes clear consent language (already present in PolicyView).
- **Export for Legal Hold:** Add ability to export immutable records (acknowledgments, amendments, system events) in a forensically sound format for litigation.

---

## Remediation Status (March 2025)

| ID | Issue | Status |
|----|-------|--------|
| 1.1 | Acknowledgment applicability check | ✅ Fixed |
| 1.2 | Amendment records on HR/Incident updates | ✅ Fixed |
| 1.3 | HRRecord admin-only; IncidentReport self-only | ✅ Fixed |
| 1.4 | XSS / DOMPurify | ✅ Fixed |
| 1.5 | Amendment organization_id | ✅ Fixed |
| 2.2 | PendingReAcknowledgment on publish | ✅ Fixed |
| 2.4 | UTC timestamps | ✅ Fixed |
| 2.5 | Content hash verification endpoint | ✅ Fixed |
| 2.6 | IP/session capture | ✅ Added (optional) |
| 3.1 | JWT_SECRET enforcement | ✅ Fixed |
| 3.3 | secureIncidentWrite | ✅ Fixed (dedicated route) |
| 3.4 | Rate limiting | ✅ Fixed |

---

*This audit is a snapshot. Re-audit after further changes and before production deployment.*
