# HR App — Detailed Task and Execution List

This document breaks down the work from **HR_APP_TRUTH_AND_REBUILD_GAP.md** and **TECHNICAL_AUDIT.md** into concrete, executable tasks with file references, acceptance criteria, and dependencies. Use it as a sprint/backlog and checklist.

**Execution order:** Complete tasks in the order listed within each phase. Phases can be sequenced Phase 1 → 2 → 3 → 4; Tier 4 (platform/rebuild) can be deferred.

---

## Phase 1 — Before Real Users (Legal Defensibility & Data Correctness)

*Estimated: 1–2 days*

---

### TASK 1.1 — Persist severity and discipline_level on HR record create

| Field | Detail |
|-------|--------|
| **ID** | 1.1 |
| **Title** | Persist severity and discipline_level on HR record create |
| **Source** | TECHNICAL_AUDIT Layer 13, HR_APP_TRUTH_AND_REBUILD_GAP Tier 1 |
| **Files** | `server/routes/api.js` |
| **Description** | The `entity-write` handler for `HRRecord` create (lines ~529–533) inserts only `id, organization_id, employee_id, record_type, title, description, status, created_by_email`. The table `hr_records` has columns `severity` and `discipline_level` (see `server/scripts/init-db.js`); they are never set and remain NULL. |
| **Steps** | 1. In the HRRecord `INSERT` statement, add `severity` and `discipline_level` to the column list. 2. Bind `safeData.severity ?? null` and `safeData.discipline_level ?? null` (or appropriate defaults). 3. If entity-write allows `update` for HRRecord and updates these fields, ensure the update path also includes severity/discipline_level where allowed. 4. Run a quick test: create an HR record from the UI with severity and discipline level set; verify DB row has non-null values. |
| **Acceptance criteria** | Creating an HR record (write-up) with severity and/or discipline_level in the request body results in those values stored in `hr_records`. Existing records can remain NULL; no migration required for old rows. |
| **Dependencies** | None |
| **Estimate** | 30 min |

---

### TASK 1.2 — Incident report confidentiality: subject must never see report (TRUTH #160)

| Field | Detail |
|-------|--------|
| **ID** | 1.2 |
| **Title** | Ensure incident report subject never receives incident data |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #160 |
| **Files** | `server/routes/api.js` — `POST /incident-reports` (lines ~995–1015) |
| **Description** | In `incident_reports`, `employee_id` is the **subject** of the incident. Currently, when `!isAdmin(employee)`, the code returns `incident_reports WHERE organization_id = ? AND employee_id = ?` with the current user's employee id — i.e. incidents where the current user is the subject. TRUTH #160: the subject must never see the incident report. |
| **Steps** | 1. Change the non-admin branch of `POST /incident-reports`: do not return incident reports where `employee_id === employee.id`. Options: (A) Return empty list for non-admin for incidents (only admins see incident reports). (B) Add a `reporter_employee_id` column later and return only reports the employee created; for now, (A) is sufficient. 2. Confirm that `secure-incident-write` create path uses `employee_id` as subject; do not allow non-admin to fetch or edit any incident where they are the subject. 3. Check any other routes that return incident_reports (e.g. export, employee file) and ensure subject never receives incident content. |
| **Acceptance criteria** | Logged-in non-admin user receives no incident reports in `/incident-reports` response (or only reports they reported, if reporter is added). Subject employee has no way to view or receive the content of an incident about them. |
| **Dependencies** | None |
| **Estimate** | 45 min |

---

### TASK 1.3 — Log super admin launch (TRUTH #57)

| Field | Detail |
|-------|--------|
| **ID** | 1.3 |
| **Title** | Log every super admin launch into an org |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #57 (second), Tier 1 |
| **Files** | `server/routes/api.js` — `POST /super-admin/launch-token` (lines ~166–182); `server/lib/auth.js` or middleware (optional: capture “session end” later); `server/scripts/init-db.js` (if new columns needed) |
| **Description** | Every time a super admin launches into an org (gets a launch token or uses it), log: org_id, super_admin identity, timestamp. No need for “session end” in Phase 1 unless required. |
| **Steps** | 1. In the handler that issues the launch token (e.g. after generating the JWT in `POST /super-admin/launch-token`), insert a row into `system_events`: event_type e.g. `super_admin.launch`, organization_id = target org, entity_type = 'Organization', entity_id = org id, actor_email/actor_name = super admin, summary = 'Super admin launched into org', metadata = JSON e.g. `{ "impersonate_org_id": org.id }`, created_at = now. 2. Use existing `createSystemEvent` helper if one exists, or `db.prepare('INSERT INTO system_events ...').run(...)`. 3. Document in FOUNDATION.md or OPERATIONS.md that super admin access is logged. |
| **Acceptance criteria** | Every call that results in a super admin launch (e.g. successful launch-token response) produces exactly one `system_events` row with event_type indicating super admin launch and org id. |
| **Dependencies** | None |
| **Estimate** | 45 min |

---

## Phase 2 — Truth Alignment (Current Stack, No Full Rebuild)

*Estimated: 3–5 days*

---

### TASK 2.1 — Progressive discipline record types (TRUTH #159)

| Field | Detail |
|-------|--------|
| **ID** | 2.1 |
| **Title** | Add progressive discipline record types and visibility rules |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #159 |
| **Files** | `server/scripts/init-db.js` (optional: add column or migrate); `server/routes/api.js` (entity-write HRRecord create/update, hr-records list, employee-file export); `Handbook Policy App/src/pages/HRRecords.jsx`, `EmployeeProfile.jsx`, `MyWriteUps.jsx` |
| **Description** | Support record types: internal_note, verbal_warning, written_warning, final_warning, immediate_termination, commendation. internal_note never shown to employee; immediate_termination immutable once created. |
| **Steps** | 1. **Schema:** Ensure `hr_records.record_type` (or add `discipline_type`) can store: internal_note, verbal_warning, written_warning, final_warning, immediate_termination, commendation. If current column is free text, document allowed values; optionally add a CHECK or application validation. 2. **Create:** In entity-write HRRecord create, accept `record_type`/`discipline_type` and persist it. For immediate_termination, set `is_locked = 1` on insert. 3. **Visibility:** For non-admin employee-facing endpoints (e.g. hr-records when employee requests own list, my-write-ups, employee file export), filter out rows where record_type === 'internal_note'. 4. **Lock:** On update/amend, if record_type === 'immediate_termination', reject any update (already is_locked). 5. **UI:** In HRRecords.jsx and EmployeeProfile, allow selecting discipline type when creating/editing; in MyWriteUps, only show non–internal_note records. |
| **Acceptance criteria** | Internal notes are never returned to the employee. Immediate termination records cannot be updated after create. All six types can be created and stored; admin sees all, employee sees all except internal_note. |
| **Dependencies** | 1.1 (severity/discipline_level already in create) |
| **Estimate** | 2–3 hrs |

---

### TASK 2.2 — Acknowledgment window configuration (TRUTH #157)

| Field | Detail |
|-------|--------|
| **ID** | 2.2 |
| **Title** | Add configurable acknowledgment windows (platform default, business default, per-publish) |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #157 |
| **Files** | `server/scripts/init-db.js` (add columns or use organizations.settings); `server/routes/api.js` (publish-policy, my-onboarding, invites/accept or onboarding creation); optional: `Handbook Policy App/src/pages/OrgSettings.jsx`, PolicyEditor publish flow |
| **Description** | Platform default: e.g. 14 days new employees, 7 days policy updates. Business (org) default overrides platform. Per-publish override when publishing a policy. |
| **Steps** | 1. **Storage:** Add to organization or settings: `default_ack_window_new_days`, `default_ack_window_update_days` (e.g. in `organizations.settings` JSON or new columns). If no platform table, use constants in code as “platform default” (e.g. 14 and 7). 2. **Publish:** In `publish-policy`, compute due date for pending_re_acknowledgments. Use (in order): req.body override → org default → platform default. Store due_date on pending_re_acknowledgments. 3. **Onboarding:** When creating onboarding (e.g. on invite accept or admin creates onboarding), set due_date = now + default_ack_window_new_days from org/platform. 4. **UI (optional):** In OrgSettings, add fields for business default ack windows. In PolicyEditor publish flow, add optional “acknowledgment due in X days” override. |
| **Acceptance criteria** | New onboarding gets a due_date from org/platform default. New pending_re_acknowledgments from publish get due_date from override or org/platform. Values are stored and used consistently. |
| **Dependencies** | None |
| **Estimate** | 2 hrs |

---

### TASK 2.3 — Add state to organization (TRUTH #153, #163)

| Field | Detail |
|-------|--------|
| **ID** | 2.3 |
| **Title** | Add state field to organization for state-aware generation and compliance |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #153, #163 |
| **Files** | `server/scripts/init-db.js` (add column or migration); `server/routes/api.js` (org-write, admin-context, register); `Handbook Policy App` — Setup, OrgSettings, any handbook generator UI |
| **Description** | State is required for AI policy generation and compliance checklist. Add `state` (e.g. US state code or name) to organization. |
| **Steps** | 1. **Schema:** Add `state TEXT` to organizations (e.g. in init-db.js migration block: `PRAGMA table_info(organizations)` then `ALTER TABLE organizations ADD COLUMN state TEXT` if not present). 2. **API:** Include state in admin-context and org-write; allow setting state in org-write. 3. **Register:** In auth register flow, optionally collect state and set on organization. 4. **UI:** Add state field to OrgSettings and Setup (dropdown or text). 5. **Validation:** Optional: validate state against a list of allowed codes (e.g. MA, NY). |
| **Acceptance criteria** | Organization has a state value; it can be set and read via API and UI; state is available for future AI and compliance features. |
| **Dependencies** | None |
| **Estimate** | 1 hr |

---

### TASK 2.4 — Activity log: support skip, search, event_type_prefix

| Field | Detail |
|-------|--------|
| **ID** | 2.4 |
| **Title** | Implement activity log pagination and filtering |
| **Source** | TECHNICAL_AUDIT Layer 4, HR_APP_TRUTH_AND_REBUILD_GAP Tier 2 |
| **Files** | `server/routes/api.js` — `POST /activity-log` (lines ~815–825); `Handbook Policy App/src/pages/ActivityLog.jsx` (already sends skip, search, event_type_prefix) |
| **Description** | Frontend sends `skip`, `limit`, `search`, `event_type_prefix`; backend currently uses only `organization_id` and `limit`. Add OFFSET and WHERE filters. |
| **Steps** | 1. In activity-log handler, read `skip` (default 0) and `event_type_prefix` (optional) and `search` (optional) from req.body. 2. Build query: `SELECT * FROM system_events WHERE organization_id = ?` plus optional `AND event_type LIKE ?` (e.g. event_type_prefix + '%') and optional `AND (summary LIKE ? OR metadata LIKE ?)` for search. Use `ORDER BY created_at DESC LIMIT ? OFFSET ?`. 3. Sanitize: cap limit (e.g. 200), ensure skip/limit are non-negative integers. 4. Return `{ data: { events, total } }` if total count is needed for UI; otherwise frontend can infer from length. |
| **Acceptance criteria** | ActivityLog.jsx pagination (page/skip) works; type filter and search filter narrow results. No breaking change to existing clients that only send limit. |
| **Dependencies** | None |
| **Estimate** | 1 hr |

---

### TASK 2.5 — Employee file export endpoint and re-hire documentation

| Field | Detail |
|-------|--------|
| **ID** | 2.5 |
| **Title** | Add employee file export and document re-hire behavior |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #56, #164 |
| **Files** | `server/routes/api.js` (new or existing route); `Handbook Policy App` (e.g. EmployeeProfile or Employees page — “Export file” button); docs |
| **Description** | Single export that includes for one employee: acknowledgments, hr_records (respecting internal_note visibility), incident_reports (admin only; subject never in their own export), amendments for that employee’s records. Document that re-hire = same employee_id, file preserved. |
| **Steps** | 1. **Endpoint:** Add e.g. `POST /export-employee-file` or extend a similar route. Input: organization_id, employee_id. Auth: admin only, or employee can export own file (excluding internal_note and incidents where they are subject). 2. **Data:** Query acknowledgments, hr_records (exclude internal_note for non-admin if employee is requesting own), incident_reports only if admin (and exclude from subject’s own export). Query amendments for those record ids. 3. **Format:** Return JSON (or allow CSV/PDF later) with clear sections: acknowledgments, hr_records, incident_reports (if allowed), amendments. 4. **UI:** Add “Export employee file” button on EmployeeProfile or employee detail; call new endpoint and download or show data. 5. **Docs:** In FOUNDATION.md or OPERATIONS.md, add: “Re-hire: use same employee_id; file is preserved. Termination: access revoked, file retained.” |
| **Acceptance criteria** | Admin can export a complete employee file. Employee can export own file without internal_note and without incident reports about them. Re-hire and termination file retention are documented. |
| **Dependencies** | 2.1 (internal_note visibility), 1.2 (incident subject visibility) |
| **Estimate** | 2–3 hrs |

---

### TASK 2.6 — Policy targeting: document default “all employees”; optional always_include flag (TRUTH #156)

| Field | Detail |
|-------|--------|
| **ID** | 2.6 |
| **Title** | Document policy targeting default; add optional always_include for alcohol policy |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #156 |
| **Files** | Docs (FOUNDATION.md, or product doc); optionally `server/scripts/init-db.js` and `server/routes/api.js` (policies table, applicable-policies logic) |
| **Description** | Default is all employees; restriction is deliberate. Optionally add an “always include” flag so certain policies (e.g. alcohol) cannot be restricted from anyone. |
| **Steps** | 1. Document in FOUNDATION.md: “Policy targeting default is all employees. Restriction requires explicit admin action. Alcohol policy (and similar) should be acknowledged by everyone.” 2. Optional: Add `always_include INTEGER DEFAULT 0` to policies table. In applicable-policies (and policies-for-employee), if policy.always_include is set, ignore targeting overrides and always include for every employee. 3. UI: In policy edit, add checkbox “Require acknowledgment from all employees (e.g. alcohol policy)”. |
| **Acceptance criteria** | Default behavior is documented. If always_include is implemented, policies so flagged appear for every employee regardless of overrides. |
| **Dependencies** | None |
| **Estimate** | 30 min (doc only) or 1.5 hrs (with flag + UI) |

---

### TASK 2.7 — Termination flow: revoke access and document (TRUTH #164)

| Field | Detail |
|-------|--------|
| **ID** | 2.7 |
| **Title** | Explicit termination flow and access revocation |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #164 |
| **Files** | `server/routes/api.js` (employee-write or new terminate endpoint); `server/lib/auth.js` (optional: token invalidation); docs; `Handbook Policy App` — Employees or EmployeeProfile |
| **Description** | When an employee is set to terminated/inactive, “access revoked immediately” and “file preserved.” Re-hire carries forward same employee_id. |
| **Steps** | 1. **Termination action:** Add a dedicated “terminate” action in employee-write (or new endpoint) that sets employee status to inactive/terminated and records system_event. Optionally: maintain a server-side blocklist of invalidated user ids (or refresh token store) so next API call with their token returns 401. 2. **Document:** “On terminate: status set to inactive, access revoked at next request; file preserved. Re-hire: reactivate same employee_id, previous file remains.” 3. **UI:** “Terminate” or “Deactivate” button that calls the terminate flow; confirm dialog. 4. **Re-hire:** Document that re-hire uses same employee record (same employee_id); no new record. |
| **Acceptance criteria** | Terminated employee cannot perform actions (token invalid or status check returns 403). File remains exportable by admin. Re-hire process is documented. |
| **Dependencies** | None (token invalidation optional) |
| **Estimate** | 1.5 hrs |

---

### TASK 2.8 — FOUNDATION.md: single source of truth for Cursor (Blueprint)

| Field | Detail |
|-------|--------|
| **ID** | 2.8 |
| **Title** | Create FOUNDATION.md for Cursor and test accounts |
| **Source** | Blueprint, TRUTH #57, #167 |
| **Files** | New file `FOUNDATION.md` in repo root; optionally `.cursor/rules/foundation.mdc` with alwaysApply |
| **Description** | Single ~2k-token document: tech stack, ADRs, critical rules (always organization_id, soft delete, no localStorage tokens in production), schema summary, migration status, 28-screen list with rebuild status. Include three test accounts and production vs test org. |
| **Steps** | 1. Create FOUNDATION.md with: (1) Stack (Node, Express, SQLite, React, Vite), (2) Key ADRs (e.g. “Backend evolves, frontend can rebuild”), (3) Rules: always scope by organization_id; soft delete where applicable; no localStorage for tokens in production when web hardening is added, (4) Database: list tables and one-line purpose, (5) Migrations: “init-db.js, no version table”, (6) 28 screens: name, path, status (e.g. working/partial), (7) Test accounts: mccarthy.amyg@gmail.com (super admin), ajstrailsidepub@gmail.com (production org), ames0304@gmail.com (test employee), (8) Production vs test: AJ’s Trailside = production; Test Location = _TEST_Location_SuperAdmin; never test on production. 2. Optional: add .cursor/rules/foundation.mdc that references FOUNDATION.md and set alwaysApply: true. |
| **Acceptance criteria** | New engineer or Cursor can read FOUNDATION.md and understand stack, rules, schema, screens, and test vs prod. |
| **Dependencies** | None |
| **Estimate** | 1 hr |

---

## Phase 3 — AI and Product Completeness

*Estimated: 1–2 weeks (depends on Claude integration)*

---

### TASK 3.1 — Claude API integration: server-side, streaming (TRUTH #154)

| Field | Detail |
|-------|--------|
| **ID** | 3.1 |
| **Title** | Integrate Claude API for policy generation (server-side, SSE) |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #154, Blueprint |
| **Files** | New: `server/lib/claude.js` or `server/services/claude.js`; `server/routes/api.js` (new routes); env: ANTHROPIC_API_KEY |
| **Description** | All Claude calls from server only. Use Claude Sonnet 4.5; no frequency_penalty (use low temperature + prompt). Stream responses via SSE. |
| **Steps** | 1. Add dependency: @anthropic-ai/sdk. 2. Create server module that: loads ANTHROPIC_API_KEY, calls Claude with temperature 0.2, uses web_search tool (web_search_20250305) with domain allow list (dol.gov, eeoc.gov, osha.gov, state labor sites), max_uses: 5. 3. Add route e.g. POST /generate-policy (or /ai/generate-policy) that accepts prompt, organization context (name, industry, state), streams response via SSE. 4. Client: replace invokeLLM stub with fetch to new endpoint, parse SSE. 5. Document: redundancy control via prompt (“Be concise, cross-reference, no repetition”) and temperature, not frequency_penalty. |
| **Acceptance criteria** | Policy generation request from UI triggers server-side Claude call; response streams to client; web search used for law/state; no client-side API key. |
| **Dependencies** | 2.3 (state on org) |
| **Estimate** | 1 day |

---

### TASK 3.2 — Generate specific policy path (TRUTH #161 path 1)

| Field | Detail |
|-------|--------|
| **ID** | 3.2 |
| **Title** | Implement “generate specific policy” flow |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #161 |
| **Files** | `server/routes/api.js` (generate-policy or extend); `Handbook Policy App` — PolicyEditor or dedicated “Generate policy” screen |
| **Description** | Admin types conversational prompt; AI generates one policy; result lands in draft policy editor. |
| **Steps** | 1. Backend: Accept prompt, org id, optional policy title/category. Call Claude with system prompt + user prompt; return full policy text. Optionally create policy record in draft status with draft_content = generated text. 2. Frontend: “Generate policy” entry (e.g. in PolicyEditor or Policies list); text area for prompt; submit → stream or wait for full response; on success, open PolicyEditor with new draft or show “before/after” for paste. |
| **Acceptance criteria** | Admin can request one policy from a conversational prompt and get draft content usable in PolicyEditor. |
| **Dependencies** | 3.1 |
| **Estimate** | 4 hrs |

---

### TASK 3.3 — Scan handbook for missing policies (TRUTH #161 path 2)

| Field | Detail |
|-------|--------|
| **ID** | 3.3 |
| **Title** | Implement “scan for missing policies” flow |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #161 |
| **Files** | `server/routes/api.js` (e.g. scan-handbook-missing); Handbook Policy App — handbook or policy list UI |
| **Description** | AI reviews current handbook/policy list, returns 4–6 suggested missing policies; admin picks one; AI generates that policy. |
| **Steps** | 1. Backend: New route that takes organization_id. Fetch handbook policy list (titles + optional summaries). Send to Claude: “Given these policies, suggest 4–6 policies that are commonly missing for [industry] in [state]. Return only titles/short descriptions.” Return list. 2. Second step: admin selects one; call generate-policy with that title/description to produce full content. 3. Frontend: “Scan for missing” button; show list of suggestions; on select, trigger generate and open editor with draft. |
| **Acceptance criteria** | Admin can run “scan for missing”; get 4–6 suggestions; pick one and get generated draft. |
| **Dependencies** | 3.1 |
| **Estimate** | 4 hrs |

---

### TASK 3.4 — Upload handbook and extract policies (TRUTH #161 path 3)

| Field | Detail |
|-------|--------|
| **ID** | 3.4 |
| **Title** | Implement “upload existing handbook” and extract policies |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #161 |
| **Files** | `server/routes/api.js` (upload endpoint, file parse, Claude extract); Handbook Policy App — upload UI |
| **Description** | Admin uploads PDF or doc; server extracts text; AI extracts policy-like sections; import as draft policies. |
| **Steps** | 1. Backend: Accept file upload (PDF/DOCX); extract text (e.g. pdf-parse, mammoth, or similar). Send text to Claude: “Extract discrete policies from this handbook. Return structured list: title, content, suggested category.” 2. For each extracted policy, create policy record in draft with draft_content. 3. Frontend: Upload button; choose file; submit; show progress; on success, list created drafts with links to edit. |
| **Acceptance criteria** | Admin can upload a handbook file and receive multiple draft policies created from it. |
| **Dependencies** | 3.1 |
| **Estimate** | 6 hrs |

---

### TASK 3.5 — Guided handbook generator Phase 1 (TRUTH #153)

| Field | Detail |
|-------|--------|
| **ID** | 3.5 |
| **Title** | Phased handbook generator: Phase 1 (name, industry, state → recommended list → generate) |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #153 |
| **Files** | `server/routes/api.js` (handbook-generator routes); `Handbook Policy App/src/pages/AIHandbookGenerator.jsx` |
| **Description** | Minimum input: business name, industry, state. Phase 1: AI returns recommended policy list (state- and industry-aware); user selects which to include; AI generates full content for each; all land in draft. |
| **Steps** | 1. Backend: Route e.g. POST /handbook-generator/recommend: input name, industry, state; Claude with web search returns list of recommended policy titles. Route POST /handbook-generator/generate-selected: input list of titles, org context; for each title, generate full policy; create draft policies. 2. Frontend: AIHandbookGenerator: step 1 collect name, industry, state (prefill from org); step 2 show recommended list, checkboxes; step 3 “Generate” → create drafts; link to handbook or policy list. 3. Ensure state is required before any generation (validation). |
| **Acceptance criteria** | User completes Phase 1 flow: enter name/industry/state → see recommended policies → select → get draft policies created. |
| **Dependencies** | 2.3, 3.1 |
| **Estimate** | 1 day |

---

### TASK 3.6 — Policy draft audit log (TRUTH #155)

| Field | Detail |
|-------|--------|
| **ID** | 3.6 |
| **Title** | Log policy draft edits in audit trail |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #155 |
| **Files** | `server/routes/api.js` (entity-write Policy update, or dedicated draft-save); system_events or new draft_audit table |
| **Description** | “Audit log starts at draft.” Every draft save (not only publish) should be logged. |
| **Steps** | 1. When policy draft_content is updated (entity-write update for Policy), insert system_event: event_type e.g. policy.draft_updated, entity_type Policy, entity_id, summary, metadata (e.g. { field: 'draft_content', length: newContent.length }). 2. Optionally store diff or length only to avoid huge payloads. 3. No need to log every keystroke; debounced save is enough. |
| **Acceptance criteria** | Each draft save creates an audit entry. Admin can see history of draft changes before publish. |
| **Dependencies** | None |
| **Estimate** | 2 hrs |

---

### TASK 3.7 — Policy editor AI prompt box (TRUTH #155)

| Field | Detail |
|-------|--------|
| **ID** | 3.7 |
| **Title** | AI prompt box in policy editor: before/after, accept/reject |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #155 |
| **Files** | `server/routes/api.js` (e.g. POST /policy-ai-suggest); `Handbook Policy App` — PolicyEditor |
| **Description** | Admin types plain-language instruction; AI returns suggested change as before/after; admin accepts or rejects. Never auto-apply. |
| **Steps** | 1. Backend: Route that accepts policy_id, current draft_content, and user instruction. Claude returns suggested new content (or diff). Return { before, after } or { suggested_content }. 2. Frontend: In PolicyEditor, add “AI assist” text input; on submit, show side-by-side or inline diff; Accept / Reject buttons; on Accept, update draft_content. 3. Do not auto-apply; always require explicit accept. |
| **Acceptance criteria** | Admin can request AI suggestion from natural language; see before/after; accept or reject. |
| **Dependencies** | 3.1 |
| **Estimate** | 4 hrs |

---

### TASK 3.8 — Acknowledgment reminder and confirmation emails (TRUTH #158)

| Field | Detail |
|-------|--------|
| **ID** | 3.8 |
| **Title** | Email (and optional SMS) for acknowledgment reminder and confirmation |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #158 |
| **Files** | `server/lib/email.js`; `server/routes/api.js` (send-onboarding-reminder, create-acknowledgment); optional SMS (Twilio) |
| **Description** | Send email when policies are due for acknowledgment; send email when employee has acknowledged a policy. |
| **Steps** | 1. Add sendAcknowledgmentReminder(employeeEmail, policyTitles, dueDate) and sendAcknowledgmentConfirmation(employeeEmail, policyTitle). 2. In send-onboarding-reminder, after incrementing reminder_sent_count, call sendAcknowledgmentReminder with list of pending policies. 3. In create-acknowledgment, after successful insert, call sendAcknowledgmentConfirmation. 4. Use existing SMTP config; optional: add SMS via Twilio for same events. |
| **Acceptance criteria** | Reminder email sent when admin triggers onboarding reminder; confirmation email sent when employee acknowledges a policy. |
| **Dependencies** | None |
| **Estimate** | 2 hrs |

---

### TASK 3.9 — Compliance checklist data model and API (TRUTH #162)

| Field | Detail |
|-------|--------|
| **ID** | 3.9 |
| **Title** | Compliance checklist: state- and industry-based requirements with confirmation |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #162 |
| **Files** | `server/scripts/init-db.js` (new table); `server/routes/api.js` (CRUD or read + confirm); Handbook Policy App — new ComplianceChecklist page |
| **Description** | Separate from handbook. Checklist items: requirement text, suggested answers, confirmation field, last_confirmed_at. Generated from state + industry. |
| **Steps** | 1. Create table compliance_checklist_items (id, organization_id, state, industry, requirement_key, requirement_text, suggested_answer, confirmed INTEGER, confirmed_at, confirmed_by, notes). Or similar. 2. Seed or generate list per state/industry (e.g. MA restaurant: workers comp, harassment training, posters, etc.). 3. API: GET checklist for org (filter by org state/industry), POST to confirm item. 4. UI: Compliance checklist page; list requirements; show suggested answer; allow confirm + date; show last confirmed. |
| **Acceptance criteria** | Admin can view state/industry checklist and mark items confirmed with date. |
| **Dependencies** | 2.3 |
| **Estimate** | 1 day |

---

### TASK 3.10 — Gap audit: required policies vs handbook (TRUTH #163)

| Field | Detail |
|-------|--------|
| **ID** | 3.10 |
| **Title** | Gap audit: required state policies vs current handbook |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #163 |
| **Files** | `server/routes/api.js` (e.g. GET /gap-audit); config or DB: required_policies by state/industry; Handbook Policy App — Gap audit view |
| **Description** | System knows required policies per state (e.g. MA 18). Compare handbook policies to that list; flag missing. |
| **Steps** | 1. Define required policy list per state (e.g. JSON or table): state, industry optional, list of policy titles or keys. 2. Route GET /gap-audit: input organization_id; get org state/industry; get current policy titles; return { required: [...], current: [...], missing: [...] }. 3. UI: “Gap audit” or “Compliance” view; show missing required policies; link to create policy. |
| **Acceptance criteria** | Admin can run gap audit and see which required policies are missing from the handbook. |
| **Dependencies** | 2.3, 3.9 (optional: reuse state/industry config) |
| **Estimate** | 6 hrs |

---

### TASK 3.11 — ToS / signup consent (TRUTH #57)

| Field | Detail |
|-------|--------|
| **ID** | 3.11 |
| **Title** | Signup consent and ToS (data ownership, access, portability, retention) |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #57 |
| **Files** | `server/routes/auth.js` (register); `server/scripts/init-db.js` (optional: consent timestamp); Handbook Policy App — Setup or register page |
| **Description** | At signup, user accepts ToS covering data ownership, super admin access for support only, data portability, retention, confidentiality. |
| **Steps** | 1. Add checkbox “I agree to the Terms of Service” on register/setup; require checked to submit. 2. Store consent: e.g. organizations.tos_accepted_at or users.consent_at (timestamp). 3. Document ToS content: business owns data; super admin access for support only; data export available; retention on lapse; no sale/sharing. 4. Optional: link to full ToS page. |
| **Acceptance criteria** | User cannot complete signup without accepting ToS; acceptance is stored with timestamp. |
| **Dependencies** | None |
| **Estimate** | 2 hrs |

---

## Phase 4 — Platform and Rebuild (Blueprint)

*Estimated: 10–15 weeks per Blueprint; list for reference only.*

---

### TASK 4.1 — Auth hardening: httpOnly cookie (web) + CSRF

| Field | Detail |
|-------|--------|
| **ID** | 4.1 |
| **Title** | Web auth: httpOnly cookie + CSRF (double-submit) |
| **Source** | Blueprint |
| **Files** | `server/lib/auth.js`, `server/server.js`, `server/routes/auth.js`; Handbook Policy App — api client, login response handling |
| **Steps** | 1. Login endpoint: if X-Client-Type !== 'mobile', set httpOnly secure cookie with access token instead of body. 2. Middleware: accept token from cookie or Bearer. 3. Add CSRF token (e.g. csrf-csrf); send in header; validate on state-changing requests. 4. Client: credentials: 'include'; send CSRF header from meta or first response. |
| **Dependencies** | None |
| **Estimate** | 1 day |

---

### TASK 4.2 — Refresh token rotation and reuse detection

| Field | Detail |
|-------|--------|
| **ID** | 4.2 |
| **Title** | Refresh token rotation; store hash in DB; reuse revokes all sessions |
| **Source** | Blueprint |
| **Files** | `server/lib/auth.js`, new table refresh_tokens; client auth store |
| **Steps** | 1. Issue refresh token with access token; store SHA-256(refresh_token) in DB per user/session. 2. On refresh: verify, issue new pair, invalidate old refresh hash. 3. If same refresh token used twice, revoke all refresh tokens for that user. 4. Access token 15 min; refresh 7 days; absolute session 30 days. |
| **Dependencies** | 4.1 (optional) |
| **Estimate** | 1 day |

---

### TASK 4.3 — PostgreSQL migration (pgloader) and Drizzle ORM

| Field | Detail |
|-------|--------|
| **ID** | 4.3 |
| **Title** | Migrate SQLite to PostgreSQL; introduce Drizzle ORM and versioned migrations |
| **Source** | Blueprint |
| **Files** | New: server/db/schema (Drizzle), migrations; pgloader config; server/lib/db.js → Drizzle client |
| **Steps** | 1. Define Drizzle schema from current tables. 2. pgloader SQLite → PostgreSQL (type mapping: INTEGER→BIGINT, 0/1→BOOLEAN, text dates→TIMESTAMPTZ, JSON→JSONB). 3. Drizzle Kit for future migrations. 4. Replace raw db.prepare in api.js with Drizzle queries (incremental). |
| **Dependencies** | None |
| **Estimate** | 1–2 weeks |

---

### TASK 4.4 — Audit schema: separate schema, immutable

| Field | Detail |
|-------|--------|
| **ID** | 4.4 |
| **Title** | Audit log in separate PostgreSQL schema; REVOKE UPDATE/DELETE |
| **Source** | Blueprint, TRUTH #53 |
| **Files** | PostgreSQL: CREATE SCHEMA audit; audit.logged_actions; trigger or app layer to raise on UPDATE/DELETE |
| **Steps** | 1. Create audit schema and logged_actions table. 2. REVOKE UPDATE, DELETE on audit.logged_actions from app role. 3. Trigger that raises on update/delete. 4. Log from Express middleware (IP, user, action, old/new JSONB). |
| **Dependencies** | 4.3 |
| **Estimate** | 2–3 days |

---

### TASK 4.5 — Backup strategy (e.g. postgres-s3-backups)

| Field | Detail |
|-------|--------|
| **ID** | 4.5 |
| **Title** | Automated DB backups (pg_dump to S3/R2 or equivalent) |
| **Source** | TECHNICAL_AUDIT Layer 2, Blueprint |
| **Files** | Cron job or Railway template; backup script |
| **Steps** | 1. Schedule pg_dump (or SQLite backup if still on SQLite). 2. Upload to S3/R2; retention policy. 3. Document restore procedure. |
| **Dependencies** | 4.3 if PostgreSQL |
| **Estimate** | 4 hrs |
| **Status** | Done. SQLite: `server/scripts/backup-db.js` (read-only backup, timestamped files in `server/data/backups/`, `BACKUP_RETENTION_COUNT`); `npm run backup`. Restore and retention documented in FOUNDATION.md (Backup & restore). pg_dump/S3 can be added when on PostgreSQL. |

---

### TASK 4.6 — Manager role and capability matrix (TRUTH #165)

| Field | Detail |
|-------|--------|
| **ID** | 4.6 |
| **Title** | Manager role and capability-based permissions |
| **Source** | HR_APP_TRUTH_AND_REBUILD_GAP TRUTH #165 |
| **Files** | `server/scripts/init-db.js` (roles, capabilities table or JSON); `server/routes/api.js` (middleware or helper hasCapability); Handbook Policy App — settings, role assignment |
| **Steps** | 1. Add permission_level 'manager' (or roles table). 2. Define capabilities (e.g. view_hr_records, manage_onboarding, export_employee_file). 3. Manager starts with no capabilities; admin grants in settings. 4. Backend: replace isAdmin(employee) with hasCapability(employee, 'capability_name') where appropriate. |
| **Dependencies** | None |
| **Estimate** | 2–3 days |
| **Status** | Done. `employees.capabilities` (TEXT/JSON); `ALL_CAPABILITIES` and `hasCapability(employee, cap)` in api.js (org_admin has all, manager has only granted); routes gated by capability; employee create/update persist capabilities; `GET /api/capabilities`; Employees page capability checkboxes for Manager; Layout nav uses `hasCap(cap)` for visibility. |

---

### TASK 4.7 — Expo greenfield frontend (Blueprint)

| Field | Detail |
|-------|--------|
| **ID** | 4.7 |
| **Title** | New Expo (SDK 55) app; 28 screens as spec; reuse hooks/API/validation |
| **Source** | Blueprint |
| **Files** | New Expo project; src/domain (extracted hooks), src/api, src/app (Expo Router) |
| **Steps** | 1. Create Expo project; Expo Router v7; NativeWind. 2. Extract API client, hooks, validation from Handbook Policy App. 3. Rebuild 28 screens; dual auth (cookie for web, expo-secure-store for mobile). 4. EAS Build; OTA updates. |
| **Dependencies** | 4.1, 4.2 for auth |
| **Estimate** | 8–12 weeks |
| **Status** | In progress. **Done:** Expo project `PolicyVaultExpo` (SDK 55, Expo Router tabs); `src/api/client.ts` (dual auth, `api.account.forgotPassword`, `api.invoke`); `src/contexts/AuthContext.tsx`; Auth: Login, ForgotPassword, Setup; Tabs: Dashboard, Policies (admin or applicable list), Profile (sign out); root layout AuthProvider + redirect. **Remaining:** 22 screens (ResetPassword, ForgotEmail, RequestApprovalAgain, InviteAccept, ApproveOrg, Launch, SuperAdmin, PolicyEditor, PolicyView, Handbook, Employees, EmployeeProfile, HRRecords, Incidents, ActivityLog, AcknowledgementTracking, Onboarding, MyOnboarding, OrgSettings, ReAcknowledgmentManagement, MyWriteUps, AIHandbookGenerator); optional NativeWind; src/domain hooks; EAS Build + OTA. |

---

## Execution Checklist (Quick Reference)

Use this to tick off tasks as done. *Verified against codebase: Phases 1–3 and 4.1–4.6 implemented.*

**Phase 1**  
- [x] 1.1 Persist severity/discipline_level on HR create  
- [x] 1.2 Incident report: subject never sees report  
- [x] 1.3 Log super admin launch  

**Phase 2**  
- [x] 2.1 Progressive discipline types + visibility  
- [x] 2.2 Acknowledgment window config  
- [x] 2.3 State on organization  
- [x] 2.4 Activity log skip/search/event_type_prefix  
- [x] 2.5 Employee file export + re-hire doc  
- [x] 2.6 Policy targeting doc + optional always_include  
- [x] 2.7 Termination flow + access revoke  
- [x] 2.8 FOUNDATION.md + test accounts  

**Phase 3**  
- [x] 3.1 Claude API server-side + SSE  
- [x] 3.2 Generate specific policy  
- [x] 3.3 Scan handbook missing  
- [x] 3.4 Upload handbook extract  
- [x] 3.5 Guided handbook Phase 1  
- [x] 3.6 Draft audit log  
- [x] 3.7 Policy editor AI prompt box  
- [x] 3.8 Acknowledgment emails  
- [x] 3.9 Compliance checklist  
- [x] 3.10 Gap audit  
- [x] 3.11 ToS at signup  

**Phase 4** (when pursuing full rebuild)  
- [x] 4.1 httpOnly + CSRF  
- [x] 4.2 Refresh token rotation  
- [x] 4.3 PostgreSQL + Drizzle  
- [x] 4.4 Audit schema  
- [x] 4.5 Backups  
- [x] 4.6 Manager + capabilities  
- [ ] 4.7 Expo frontend (in progress: Login, ForgotPassword, Setup, Dashboard, Policies, Profile done; 22 screens remaining)  

---

*Document version: 1.0. Source: HR_APP_TRUTH_AND_REBUILD_GAP.md, TECHNICAL_AUDIT.md, PolicyVault Architecture Blueprint.*
