# PolicyVault HR Governance Platform — Architecture

This document describes the system architecture, domain model, and engineering guardrails for the PolicyVault HR governance platform. **All changes must preserve auditability, security, and legal defensibility.**

---

## 1. System Overview

PolicyVault is a multi-tenant SaaS platform for:
- **Policy management** — Create, version, publish, and archive policies
- **Handbook** — Organize policies by category for employee access
- **Acknowledgments** — Employees acknowledge policies; records are immutable and tamper-evident
- **HR records** — Write-ups, incidents, discipline with amendment tracking
- **Onboarding** — Assign policies to new hires and track completion

**Tech stack:** React 18 + Vite 6 (frontend), Base44 (backend: Deno serverless, auth, entities).

---

## 2. Domain Model

### Core Entities

| Entity | Purpose | Immutable? | Key Fields |
|--------|---------|------------|------------|
| **Organization** | Tenant root | No | id, name, industry, settings |
| **Location** | Org locations | No | id, organization_id, name, address |
| **Employee** | User–org link | No (soft) | id, organization_id, user_email, full_name, role, department, location_id, permission_level |
| **Policy** | Policy definition | No | id, organization_id, title, status (draft/active/archived), current_version, applies_to |
| **PolicyVersion** | Immutable policy snapshots | **Yes** | id, policy_id, version_number, content, is_locked |
| **Acknowledgment** | Policy acknowledgment | **Yes** | id, policy_id, policy_version_id, employee_id, content_hash, is_locked |
| **Handbook** | Handbook container | No | id, organization_id, name, policy_sections |
| **Onboarding** | Employee onboarding | No | id, employee_id, assigned_policy_ids, completed_policy_ids, status |
| **HRRecord** | Write-ups | No (locked when resolved) | id, employee_id, record_type, status, is_locked |
| **IncidentReport** | Incidents | No (locked when resolved) | id, employee_id, status, is_locked |
| **SystemEvent** | Audit log | **Yes** | organization_id, event_type, entity_type, entity_id, actor_email |
| **Amendment** | HR/incident change history | **Yes** | record_id, record_type, field_changed, old_value, new_value |
| **PolicyTargetingOverride** | Per-role/location/employee policy exclusions | No | policy_id, override_type, employee_id/role/location_id, applies |

### Policy Targeting

- **Policy.applies_to** — `{ all_employees, roles, departments, locations, tags }` (OR logic)
- **PolicyTargetingOverride** — Exclude specific policies from roles, locations, or individuals
- **Single source of truth:** `getApplicablePolicies` — all targeting logic lives here

---

## 3. Immutability Rules

**Never modify these records after creation:**
- `PolicyVersion` — Append-only; publishing creates new version
- `Acknowledgment` — Once created, never update
- `SystemEvent` — Append-only audit trail
- `Amendment` — Append-only change history

**Locked records:** `HRRecord` and `IncidentReport` with `status: resolved|dismissed` set `is_locked: true` — no further edits.

---

## 4. Multi-Tenant Isolation

- **Tenant key:** `organization_id` on all entities
- **Resolution:** `getEmployeeContext` → Employee by `user_email` → Organization
- **Enforcement:** Every query filters by `organization_id`; `secureEntityWrite` overwrites `data.organization_id` with server-verified value
- **Cross-org access:** Impossible — backend validates org membership

---

## 5. Backend Authority

**Never trust client-provided data for:**
- Employee identity
- Employee role or permissions
- Policy targeting
- Acknowledgment creation
- Policy publishing

All sensitive operations validated server-side via `secureEntityWrite`, `secureEmployeeWrite`, `secureOrgWrite`, `secureIncidentWrite`, `createSecureAcknowledgment`, `publishPolicy`.

---

## 6. Key Workflows

### Policy Lifecycle
1. **Draft** — Editable, not visible to employees
2. **Publish** (`publishPolicy`) — Creates `PolicyVersion`, sets `status: active`, creates `PendingReAcknowledgment` for applicable employees
3. **Archive** (`secureArchivePolicy`) — Removes from handbooks, sets `status: archived`; does not delete `PolicyVersion` or `Acknowledgment`

### Acknowledgment
1. Employee sees policy in Handbook / MyOnboarding
2. Clicks Acknowledge → `createSecureAcknowledgment`
3. Backend: verifies policy applies via `getApplicablePolicies`, creates immutable `Acknowledgment` with `content_hash` (SHA-256)

### HR Record / Incident
1. Create via `secureIncidentWrite` / `secureEntityWrite`
2. Status flow: submitted → under_review → resolved/dismissed
3. Edits create `Amendment` records; terminal states lock record

---

## 7. Code Modification Rules

When modifying code:
1. **Explain** what the code currently does
2. **Explain** the problem to solve
3. **Propose** the minimal safe change
4. Do not refactor entire subsystems unless necessary
5. Prefer small, incremental improvements

---

## 8. Deployment

- **Frontend:** `npm run build` → static assets; host on any static host or local for testing
- **Backend:** Base44 serverless functions (Deno)
- **Cross-platform:** Responsive design; viewport meta; mobile bottom nav; works on iOS, Android, Chrome, tablets, desktops

---

## 9. Permission Model

**Only org_admin has elevated access.** Manager and employee both have basic (entry-level) access.

| Level | Access |
|-------|--------|
| **org_admin** | Full: settings, employees, policies, handbooks, onboarding, HR records, incidents, activity log |
| **manager** | Same as employee (basic) — reserved for future granular permissions |
| **employee** | Basic: read/acknowledge handbook, submit incidents, view own HR docs |

Admin can grant granular permissions to managers later (e.g., per legal) without opening everything.

---

## 10. Foundational Policies to Preserve

The following policies are considered foundational and should be preserved when migrating or seeding:
- Code of Conduct
- Attendance & Punctuality
- Anti-Harassment
- Workplace Safety

See `FOUNDATIONAL_POLICIES.md` for export/import guidance.
