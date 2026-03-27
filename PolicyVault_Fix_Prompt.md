# POLICYVAULT — POST-AUDIT FIX PROMPT

**Source of truth for this app:** `SECTION_D_APP3_HR_POLICYVAULT.md` (HR truths + audit fixes) and `FOUNDATION_TRUTH_APP3_HR.md` (platform-wide + philosophy). See `TRUTH_INDEX.md`.

Paste the sections below into the PolicyVault Cursor chat when working through fixes — or use this file as the plan.

---

═══════════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════════

The root truth documents (FOUNDATION_TRUTH_APP3_HR.md and SECTION_D_APP3_HR_POLICYVAULT.md) are the source of truth. They contain every operational and architectural requirement for this app, the results of a formal 15-layer engineering audit (POST_OVERHAUL_AUDIT.md), and a prioritized list of fixes at the bottom of SECTION_D.

You are acting as a senior software engineer. Your job is to work through the fixes identified in the audit, in the priority order specified below. For each fix:

1. Read the relevant truth in the root truth documents to understand the requirement
2. Find the relevant code in the codebase
3. Implement the fix
4. Explain what you changed and why, referencing the exact files and lines modified

Do NOT change anything that is already working correctly per the audit. Do NOT refactor code that was not identified as needing a fix. Stay surgical — fix what's broken, leave what's working.

---

═══════════════════════════════════════════════════════════
CRITICAL FIXES — DO THESE FIRST
═══════════════════════════════════════════════════════════

## FIX 1 — REMOVE LOCALSTORAGE JWT ON WEB CLIENT (Truth #172)

The web client (Handbook Policy App/src/api/client.js) stores JWT in localStorage (policyvault_token) and refresh token in localStorage (policyvault_refresh_token). This is an XSS risk. The backend already supports httpOnly cookie auth.

**What needs to change:**
- Remove all localStorage usage for tokens from Handbook Policy App/src/api/client.js (getToken, setToken, getRefreshToken, setRefreshToken and all references)
- The web client must NOT send Authorization: Bearer header for authenticated requests
- Instead, rely on credentials: 'include' which sends the httpOnly pv_access_token cookie automatically
- On app load, instead of checking localStorage for a token, call /api/me with credentials: 'include' — if the cookie is valid, you get the user; if not, redirect to login
- For CSRF: on app load (or before first state-changing request), call GET /api/auth/csrf to get the CSRF token; store it in memory (NOT localStorage); send it as X-CSRF-Token header on all POST/PUT/DELETE/PATCH requests
- On logout, call POST /api/auth/logout which clears the cookie server-side
- For refresh: the /api/auth/refresh endpoint already sets a new cookie for web clients — the client just needs to call it when a request returns 401, then retry the failed request

Do NOT change anything about how the Expo app (PolicyVaultExpo) handles auth — it correctly uses expo-secure-store with Bearer tokens. This fix is for the web client only.

**After this fix:** there should be zero references to localStorage for tokens in the web client. The only auth mechanism for web should be the httpOnly cookie.

---

## FIX 2 — ENABLE CLAUDE WEB SEARCH (Truth #154)

In server/lib/claude.js, the Claude API calls do not include the web search tool. The Foundation Truth requires web research enabled for all policy generation calls so the AI researches current law and standards — not training data alone.

**What needs to change:**
- In every function that calls the Anthropic API for policy generation (streamPolicyGeneration, generatePolicyText, scanHandbookMissing, extractPoliciesFromHandbook, handbookRecommend, policySuggest), add the web search tool to the API call
- The tool definition is:
  ```json
  {
    "type": "web_search_20250305",
    "name": "web_search"
  }
  ```
- Add this to the tools array in the messages.create or stream call parameters
- For cost control, add max_uses: 5 to limit searches per request (Foundation Truth recommends domain allow lists for authoritative sources like dol.gov, eeoc.gov, osha.gov, state labor department sites — implement if the API supports it)
- Test that policy generation still works correctly with web search enabled

**After this fix:** every Claude API call for policy generation should include the web search tool.

---

═══════════════════════════════════════════════════════════
HIGH PRIORITY FIXES — DO THESE NEXT
═══════════════════════════════════════════════════════════

## FIX 3 — SOFT DELETE ON ADDITIONAL TABLES (Platform Truth #53)

The platform requires soft delete on all tables — nothing permanently destroyed. Currently only organizations and platform_locations have deleted_at.

**What needs to change:**
- Add deleted_at TEXT column to: employees, policies, hr_records, incident_reports, invites (via ALTER TABLE ADD COLUMN in server/scripts/init-db.js migration blocks)
- Update all DELETE operations for these tables to set deleted_at = datetime('now') instead of actual DELETE
- Update all SELECT queries for these tables to include WHERE deleted_at IS NULL (or equivalent) so deleted records are excluded from normal queries
- Admin should still be able to see deleted records when explicitly requested (e.g. terminated employee files)

Do NOT add deleted_at to immutable tables (policy_versions, acknowledgments, amendments, system_events) — these are append-only and must never be deleted or soft-deleted.

---

## FIX 4 — AUDIT LOG FIELDS EXPANSION (Platform Truth #109)

The system_events table is missing fields required by the platform truth. Every audit log record must have: entry_id, business_id (organization_id), location_id, user_id, action_type (event_type), entity_type, entity_id, old_value, new_value, timestamp, ip_address, device_id, app_source.

**What needs to change:**
- Add columns to system_events via migration in init-db.js: ip_address TEXT, device_id TEXT, app_source TEXT, old_value TEXT, new_value TEXT
- Update all places that INSERT into system_events to include these new fields where available
- ip_address: available from req.ip in Express middleware — pass it through to the audit insert
- app_source: set to 'policyvault_web' or 'policyvault_mobile' based on the request context (X-Client-Type header or cookie presence)
- device_id: optional, can be null for now — future mobile implementation can send a device identifier
- old_value/new_value: for entity updates, capture the before and after state as JSON text

---

## FIX 5 — MASSACHUSETTS COMPLIANCE ITEMS EXPANSION (Truth #163)

Only 6 MA restaurant requirement rows are seeded. The Foundation Truth documents 18 required state-specific policies for Massachusetts.

**What needs to change:**
- In server/scripts/init-db.js where compliance_checklist_items are seeded for MA restaurants, add the missing items from Truth #163:
  - Workers compensation (tied to liquor license renewal)
  - Sexual harassment prevention training (required ALL MA employers)
  - Tip policy statement (employer does not touch tips)
  - Workplace posting requirements (physical posters)
  - Food handler certifications
  - TIPS alcohol certification
  - At-will employment statement in handbook
  - Pay transparency (25+ employees)
  - PFML contributions
  - Earned sick time tracking
  - Minimum wage and tip makeup
  - I-9 verification
  - New hire reporting
  - Tax withholding
  - Unemployment insurance
- Mark payroll-handled items with a flag or note so the admin knows these are typically handled by their payroll provider
- Each item needs: requirement_key (unique), requirement_text (plain language), suggested_answer, state='MA', industry='restaurant'

---

═══════════════════════════════════════════════════════════
MEDIUM PRIORITY — VERIFICATION AND FIXES
═══════════════════════════════════════════════════════════

For each of the following, check the code and report what you find. Fix if needed.

**VERIFY 1 — TERMINATED EMPLOYEE ACCESS (Truth #164)**  
Check: When employees.status is set to 'terminated', does the auth flow prevent that user from logging in? Look at the login handler in server/routes/auth.js — does it check employee status? If not, add a check that returns 403 if the employee's status is 'terminated' or 'inactive'.

**VERIFY 2 — INCIDENT REPORT CONFIDENTIALITY (Truth #160)**  
Check: In the incident-reports and secure-incident-write routes in server/routes/api.js, can an employee who is the SUBJECT of an incident report see it? The rule is absolute: the subject never sees it, never gets notified. If the code allows the subject to view their own incident reports, fix it.

**VERIFY 3 — HR RECORD TYPES (Truth #159)**  
Check: Does hr_records.record_type accept all six values: internal_note, verbal_warning, written_warning, final_warning, immediate_termination, commendation? Is commendation implemented with admin visibility controls (can turn on/off, default on)?

**VERIFY 4 — ACKNOWLEDGMENT WINDOW TIERS (Truth #157)**  
Check: Are all three tiers implemented (platform default → business default → per-publish override)? Or is it just a single due_date field on pending_re_acknowledgments? Report what exists.

**VERIFY 5 — RE-HIRE FILE CARRYFORWARD (Truth #164)**  
Check: If an employee with status='terminated' is re-hired (status changed back to 'active'), do their previous acknowledgments, HR records, and incident reports remain linked? The rule is: no clean slate. Previous file carries forward.

**VERIFY 6 — EMAIL VERIFICATION (Truth #158)**  
Check: Is email verification enforced before an employee can log in for the first time? The Foundation Truth says email verification is the first link in the legal defensibility chain.

---

═══════════════════════════════════════════════════════════
COMPLETION
═══════════════════════════════════════════════════════════

After completing all fixes and verifications, provide a summary of:
1. Every file changed and what was changed
2. Every verification result (what you found and whether a fix was needed)
3. Any issues you encountered or concerns about the changes
4. Your updated assessment of the codebase health rating

Reference SECTION_D_APP3_HR_POLICYVAULT.md and FOUNDATION_TRUTH_APP3_HR.md for any questions about requirements. The root truth documents are the source of truth — if code contradicts a truth, the truth wins.
