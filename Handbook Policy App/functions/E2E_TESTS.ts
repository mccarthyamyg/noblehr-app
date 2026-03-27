# E2E Test Execution Plan

**Date:** 2026-02-27  
**Scope:** Complete workflow validation across UI and backend

---

## Test Environment Setup

- **Org:** Use existing test organization or create fresh one
- **Admin User:** admin@testorg.com (permission_level: org_admin)
- **Employee Users:** emp1@testorg.com, emp2@testorg.com (permission_level: employee)
- **Date:** 2026-02-27

---

## TEST 1: Policy Publish & Acknowledgment Flow

### Pre-Test Checks
- [ ] All three users logged in (or ready to login)
- [ ] Clear all previous test data (optional)
- [ ] Browser dev tools open (to watch network requests)

### TEST 1.1: Admin Creates & Publishes Policy

**Steps (PolicyEditor):**
1. [ ] Login as admin@testorg.com
2. [ ] Navigate to `/PolicyEditor` (new policy)
3. [ ] Fill form:
   - Title: "E2E Test Policy v1"
   - Description: "Testing automatic acknowledgment flow"
   - Content: "This is a test policy for E2E validation"
   - Applies To: All Employees
   - Acknowledgment Required: ✓ Checked
4. [ ] Click [Save Draft]
   - Verify: Policy created, `status='draft'`, `current_version=0`
   - Check Network: POST to Policy entity
5. [ ] Wait 30s (idle autosave trigger)
   - Verify: Draft auto-saved (check updated_date in DB)
6. [ ] Click [Publish]
7. [ ] Open "Publish Policy" dialog
8. [ ] Enter change_summary: "Initial publication"
9. [ ] Click [Create Version & Publish]
   - Watch network: `POST /functions/publishPolicy`
   - Expected response: `{ success: true, version: 1 }`
   - Verify: Status badge changes to "Active" ✅

**Verification (Backend):**
```
Check entities:
Policy:
  - id = <policy_id>
  - status = 'active'
  - current_version = 1
  
PolicyVersion:
  - policy_id = <policy_id>
  - version_number = 1
  - is_locked = true ✅
  
Acknowledgment (should exist for each employee):
  - policy_id = <policy_id>
  - version_number = 1
  - acknowledged_at = null (not yet ack'd)
  
SystemEvent:
  - event_type = 'policy.published'
  - entity_id = <policy_id>
```

**Employee Verification (emp1@testorg.com):**
1. [ ] Navigate to `/Handbook`
   - Verify: "E2E Test Policy v1" appears in handbook
2. [ ] Navigate to `/Policies`
   - Verify: Policy shows "Pending Acknowledgment ⏱️" badge
3. [ ] Navigate to `/MyOnboarding`
   - Verify: Policy shows in pending list
4. [ ] Navigate to `/Dashboard`
   - Verify: Pending Acknowledgments card shows "1 pending"

---

### TEST 1.2: Employee Acknowledges Policy

**Steps (as emp1@testorg.com):**
1. [ ] Navigate to `/Handbook`
2. [ ] Find "E2E Test Policy v1"
3. [ ] Click [View Policy]
   - Verify: Modal opens, content displays
4. [ ] Click [Acknowledge]
   - Watch network: `POST /functions/createSecureAcknowledgment`
   - Expected response: `{ success: true }`
5. [ ] Modal closes
   - Verify: Badge changes to "Acknowledged ✅"

**Verification (Backend):**
```
Acknowledgment record:
  - employee_id = emp1
  - acknowledged_at = <timestamp> ✅
  - is_locked = true
  - content_hash = <sha256>
  
SystemEvent:
  - event_type = 'policy.acknowledged'
  - summary includes emp1's name
```

**UI Verification:**
- [ ] `/Handbook` - badge now shows ✅ Acknowledged
- [ ] `/Policies` - badge shows ✅ Acknowledged
- [ ] `/MyOnboarding` - policy removed from pending list
- [ ] `/Dashboard` - Pending count drops to "0"

**Other Employee Verification (emp2):**
- [ ] `/Handbook` - emp2 still sees "Pending ⏱️"
- [ ] `/Dashboard` - Still shows "1 pending" (only emp2)

---

### TEST 1.3: Admin Re-publishes (v2)

**Steps (as admin):**
1. [ ] Navigate back to `/PolicyEditor?id=<policy_id>`
2. [ ] Edit draft_content: Add "Updated: January 2026"
3. [ ] Click [Publish]
4. [ ] Change summary: "Added date clarification"
5. [ ] Click [Create Version & Publish]
   - Watch network: `POST /functions/publishPolicy`
   - Verify: Response shows `{ version: 2 }`
   - Status badge: Still "Active"

**Verification (Backend):**
```
Policy:
  - current_version = 2 ✅
  
PolicyVersion (v2):
  - version_number = 2
  - content includes "Updated: January 2026"
  - is_locked = true
  
PendingReAcknowledgment:
  - emp1 record created (already ack'd v1, must ack v2)
  - emp2 record created (hasn't ack'd anything)
```

**Employee Verification (emp1):**
- [ ] `/Handbook` - Badge changes to "Re-acknowledgment Required ⚠️"
- [ ] `/MyOnboarding` - Shows "Re-acknowledgment Required"
- [ ] `/Policies` - Shows warning badge

**Employee Verification (emp2):**
- [ ] `/Handbook` - Still shows "Pending ⏱️"
- [ ] `/MyOnboarding` - Still in pending list

---

## TEST 2: Policy Archive Cascade

### Pre-Test State
- After TEST 1, have:
  - Policy "E2E Test Policy v1" (status='active', v2 published)
  - emp1 acknowledged both v1 and v2
  - emp2 only has pending re-acks

### TEST 2.1: Admin Archives Policy

**Steps (as admin):**
1. [ ] Navigate to `/Policies`
2. [ ] Find "E2E Test Policy v1" (Active)
3. [ ] Click [Archive] button
   - Dialog appears: "This will remove the policy from all handbooks..."
4. [ ] Click [Confirm Archive]
   - Watch network: `POST /functions/managePolicyLifecycle`
   - Expected response: `{ success: true, cascades: {...} }`
   - Status badge changes to "Archived" ✅

**Verification (Backend):**
```
Policy:
  - status = 'archived' ✅
  
Handbook.policy_sections:
  - policy_id NOT in any section ✅
  
PendingReAcknowledgment:
  - COUNT = 0 (all deleted) ✅
  
Onboarding:
  - assigned_policy_ids no longer contains policy_id ✅
  
SystemEvent:
  - event_type = 'policy.archived'
  - metadata.cascades_executed = 4 ✅
```

**UI Verification (as admin):**
- [ ] `/Policies` - Policy still visible (admin view)
- [ ] Status badge: "Archived" (gray/disabled look)
- [ ] [Archive] button gone
- [ ] [Edit] button still works (for record-keeping)

**UI Verification (as emp1):**
- [ ] `/Handbook` - Policy GONE (not shown)
- [ ] `/Policies` - Policy GONE (not shown)
- [ ] `/MyOnboarding` - Policy GONE (not in pending list)
- [ ] `/Dashboard` - No mention of policy
- [ ] Pending count: "0"

**UI Verification (as emp2):**
- [ ] `/Handbook` - Policy GONE
- [ ] `/Policies` - Policy GONE
- [ ] `/MyOnboarding` - Policy GONE
- [ ] Progress updated (fewer assignments)

---

### TEST 2.2: Verify Immutability (Archive is Terminal)

**Steps (as admin):**
1. [ ] Try to edit archived policy in `/PolicyEditor?id=<policy_id>`
   - Verify: UI shows "This policy is archived"
   - Edit buttons disabled or hidden
2. [ ] Try to change status back to "active"
   - Try API call (curl/postman):
     ```
     PUT /entities/Policy/<policy_id>
     { "status": "active" }
     ```
   - Expected: 403 Forbidden or error
   - Verify: Policy remains archived

**Backend Check:**
```
Try direct update:
  UPDATE Policy SET status='active' WHERE id=<policy_id>
  
Verify:
  - No change occurred
  - is_locked enforcement prevents (if applicable)
```

---

## TEST 3: HR Record Lifecycle & Lock

### TEST 3.1: Admin Creates HR Record

**Steps (as admin):**
1. [ ] Navigate to `/HRRecords`
2. [ ] Click [New Record]
3. [ ] Fill form:
   - Employee: emp2@testorg.com
   - Record Type: Write-Up
   - Title: "E2E Test Write-Up"
   - Severity: Medium
   - Discipline Level: Verbal Warning
   - Description: "Testing HR record lifecycle"
   - Signature Required: ✓ Checked
4. [ ] Click [Create]
   - Verify: Record created, `status='submitted'`, `is_locked=false`

**Verification (Backend):**
```
HRRecord:
  - id = <record_id>
  - employee_id = emp2
  - status = 'submitted' ✅
  - is_locked = false ✅
  - amendments = [] (empty)
```

---

### TEST 3.2: Admin Edits (Amendments Tracked)

**Steps (as admin):**
1. [ ] In `/HRRecords`, find record
2. [ ] Click [Edit Description]
3. [ ] Change: "Testing HR record lifecycle" → "Testing HR record lifecycle and state transitions"
4. [ ] Click [Save]
   - Verify: Record updates
   - Network: `PUT /entities/HRRecord/<record_id>`

**Verification (Backend):**
```
HRRecord:
  - description = "...and state transitions" ✅
  - updated_date = <new timestamp>
  
Amendment:
  - record_id = <record_id>
  - field_changed = 'description'
  - old_value = "Testing HR record lifecycle"
  - new_value = "...and state transitions" ✅
  - amended_by_email = admin email
```

**UI Verification:**
- [ ] Amendment log appears at bottom: "Admin updated 'description'"
- [ ] Shows old/new values side-by-side

---

### TEST 3.3: Status Transition (Submitted → Under Review)

**Steps (as admin):**
1. [ ] Click status dropdown
2. [ ] Select "Under Review"
   - Confirm dialog appears
3. [ ] Click [Confirm]
   - Watch network: `POST /functions/manageHRRecordLifecycle`
   - Expected: `{ success: true }`
   - Status badge changes to orange "Under Review"

**Verification (Backend):**
```
HRRecord:
  - status = 'under_review' ✅
  - is_locked = false (still editable)
  
SystemEvent:
  - event_type = 'hr_record.status_changed'
  - metadata.status_from = 'submitted'
  - metadata.status_to = 'under_review'
```

**UI Verification:**
- [ ] Status badge: "Under Review" (orange)
- [ ] Edit buttons: Still enabled
- [ ] Dropdown shows: "Resolved", "Dismissed" (valid transitions)

---

### TEST 3.4: Status Transition (Under Review → Resolved, TERMINAL)

**Steps (as admin):**
1. [ ] Click status dropdown
2. [ ] Select "Resolved"
3. [ ] Click [Confirm]
   - Watch network: `POST /functions/manageHRRecordLifecycle`
   - Expected: `{ success: true }`
   - Status badge changes to green "Resolved"

**Verification (Backend):**
```
HRRecord:
  - status = 'resolved' ✅
  - is_locked = true ✅ (TERMINAL)
  
SystemEvent:
  - event_type = 'hr_record.status_changed'
  - metadata.status_to = 'resolved'
```

**UI Verification:**
- [ ] Status badge: "Resolved" (green)
- [ ] Edit buttons: DISABLED or hidden
- [ ] All fields: READONLY
- [ ] Shows: "This record is finalized and cannot be changed"
- [ ] Dropdown: GONE (no status changes allowed)

---

### TEST 3.5: Try to Edit Locked Record (Should Fail)

**Steps (as admin):**
1. [ ] Try to edit any field (description, severity, etc.)
   - UI should prevent (buttons disabled)
2. [ ] Try API call (curl/postman):
   ```
   PUT /entities/HRRecord/<record_id>
   { "description": "New value" }
   ```
   - Expected: 403 Forbidden
   - Response: "Record is locked. Cannot modify."

**Verification:**
- [ ] Backend rejects with 403 ✅
- [ ] Record remains unchanged
- [ ] No Amendment created

---

### TEST 3.6: Invalid State Transition (Should Fail)

**Steps (as admin):**
1. [ ] Try API call to go backward:
   ```
   POST /functions/manageHRRecordLifecycle
   { record_id, new_status: 'submitted' }
   ```
   - Expected: 400 Bad Request
   - Error: "Invalid transition: resolved → submitted"

**Verification:**
- [ ] Backend rejects ✅
- [ ] Record remains "resolved"
- [ ] No state change

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1.1 Create & Publish | [ ] | Policy → v1, Acks created |
| 1.2 Acknowledge | [ ] | emp1 acks, badge updates |
| 1.3 Re-publish (v2) | [ ] | v2 created, re-acks assigned |
| 2.1 Archive Cascade | [ ] | Policy archived, all cascades clear |
| 2.2 Archive Terminal | [ ] | Archive cannot be reversed |
| 3.1 Create HR Record | [ ] | Record created, editable |
| 3.2 Amendment Tracking | [ ] | Edit tracked, amendment logged |
| 3.3 Submitted → Review | [ ] | Status changes, record editable |
| 3.4 Review → Resolved | [ ] | Status locked, is_locked=true |
| 3.5 Edit Locked | [ ] | API rejects, 403 error |
| 3.6 Invalid Transition | [ ] | Invalid transition rejected |

**Overall Result: [ ] PASS / [ ] FAIL**

---

## Post-Test Cleanup

- [ ] Archive all test policies
- [ ] Delete test HR records (or mark as test)
- [ ] Clear amendment logs (optional)
- [ ] Document any failures