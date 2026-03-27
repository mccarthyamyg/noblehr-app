# Edge Case Testing Plan

**Date:** 2026-02-27  
**Scope:** Break the system, find inconsistencies, verify error handling

---

## Category 1: Cascade Failure Recovery

### Test 1.1: Handbook Update Fails During Archive

**Setup:**
- Create policy with handbook assigned
- Manually corrupt Handbook record (optional: use DB to simulate partial state)

**Scenario:**
```
Admin clicks Archive:
  1. Policy status changes to 'archived' ✅
  2. Remove from Handbook FAILS (DB error)
  3. What happens?
     - Should ROLLBACK entire operation
     - Policy should revert to 'active'
     - Handbook unchanged
     - No SystemEvent created
```

**Test Method:**
1. Navigate to `/PolicyEditor` (active policy)
2. Click [Archive]
3. If backend can't rollback, observe:
   - [ ] Policy stuck in "archived" but still in Handbook
   - [ ] Inconsistent state (bad)
   - OR
   - [ ] Entire operation rolls back (good) ✅

**Expected Behavior:**
```
Response: { success: false, error: "Archive failed: ..." }
Database State:
  - Policy.status = 'active' (reverted) ✅
  - Handbook unchanged
  - No cascades executed
```

---

### Test 1.2: Onboarding Update Fails During Archive

**Setup:**
- Create policy assigned to multiple employees' onboarding
- Simulate Onboarding.update() failure

**Scenario:**
```
Admin archives policy:
  1. Policy status = 'archived' ✅
  2. Handbook updated ✅
  3. Onboarding.update FAILS
  4. Should rollback all previous steps
```

**Test Method:**
- If system uses transactions: Try to break Onboarding update
- Verify: Entire archive operation rolls back

**Expected Behavior:**
```
Database:
  - Policy.status = 'active' (reverted) ✅
  - Handbook restored ✅
  - No partial cascades ✅
```

---

## Category 2: Orphaned Data Detection

### Test 2.1: Policy in Handbook But Status=Archived

**Setup:**
- Manually (via API or DB) set Policy.status='archived' but DON'T remove from Handbook

**Scenario:**
```
Admin navigates Handbook:
  - Should policy appear? ❌ NO
  - Filter should catch status and hide it
```

**Test Method:**
1. Create policy, publish, add to handbook
2. Via API/DB: `UPDATE Policy SET status='archived'`
3. Navigate to `/Handbook`
4. Verify: Policy NOT shown (filtered out)

**Expected Behavior:**
- [ ] Handbook shows only active policies ✅
- [ ] Filter catches archived at render time

---

### Test 2.2: Acknowledgment Exists But Policy=Archived

**Setup:**
- Create and publish policy, employee acks
- Archive policy

**Scenario:**
```
Check Acknowledgment record:
  - Still exists ✅ (immutable, preserved)
  - Employee cannot ack again
  - Policy not shown to employee
```

**Test Method:**
1. Create policy, employee acks it
2. Admin archives
3. Navigate to `/AcknowledgementTracking` (admin view)
4. Verify: Ack record still shown (for audit)
5. Navigate to `/Policies` (employee view)
6. Verify: Policy NOT shown

**Expected Behavior:**
- [ ] Ack preserved for audit trail ✅
- [ ] But archived policy hidden from employee view ✅
- [ ] Ack cannot be deleted (is_locked=true)

---

### Test 2.3: PendingReAcknowledgment After Archive

**Setup:**
- Policy v1 published, emp1 acks
- Policy v2 published, PendingReAcknowledgment created for emp1
- Archive policy

**Scenario:**
```
Check state:
  - PendingReAcknowledgment should be DELETED ✅
  - emp1 no longer has pending re-ack
  - No orphaned records
```

**Test Method:**
1. Setup per above
2. Check DB: `SELECT * FROM PendingReAcknowledgment WHERE policy_id=<id>`
3. Admin archives
4. Check DB again
5. Verify: Record deleted (COUNT=0)

**Expected Behavior:**
- [ ] PendingReAcknowledgment deleted ✅
- [ ] No orphaned pending re-acks ✅

---

## Category 3: Immutability Violations

### Test 3.1: Try to Update PolicyVersion

**Setup:**
- Create and publish policy (PolicyVersion created with is_locked=true)

**Scenario:**
```
Try to update PolicyVersion directly:
  PUT /entities/PolicyVersion/<id>
  { "content": "malicious content" }
  
Expected: 403 Forbidden
```

**Test Method:**
1. Get a PolicyVersion ID from a published policy
2. Via curl/postman:
   ```
   PUT http://app/entities/PolicyVersion/<id>
   { "content": "Hacked!" }
   ```
3. Expected: 403 Forbidden or error

**Expected Behavior:**
- [ ] Backend rejects ✅
- [ ] Version remains unchanged
- [ ] is_locked enforcement works ✅

---

### Test 3.2: Try to Update Acknowledgment

**Setup:**
- Employee acknowledges policy (Acknowledgment.is_locked=true)

**Scenario:**
```
Try to change acknowledged_at:
  PUT /entities/Acknowledgment/<id>
  { "acknowledged_at": "2026-01-01T00:00:00Z" }
  
Expected: 403 Forbidden (cannot tamper with)
```

**Test Method:**
1. Get Acknowledgment ID
2. Try update via API
3. Expected: Error

**Expected Behavior:**
- [ ] Cannot modify ✅
- [ ] Tamper protection works ✅

---

### Test 3.3: Try to Update Locked HR Record

**Setup:**
- Create HR record, resolve it (is_locked=true)

**Scenario:**
```
Try to edit any field:
  PUT /entities/HRRecord/<id>
  { "description": "..." }
  
Expected: 403 Forbidden
```

**Test Method:**
1. Create and resolve HR record
2. Try to update via API
3. Expected: 403 error

**Expected Behavior:**
- [ ] Backend rejects ✅
- [ ] No Amendment created
- [ ] Record unchanged ✅

---

## Category 4: State Transition Violations

### Test 4.1: Invalid HR Record Transition

**Setup:**
- Create HR record in "resolved" state

**Scenario:**
```
Try to go backward:
  new_status = 'submitted'
  
Expected: 400 Bad Request
```

**Test Method:**
1. Resolve HR record
2. Try API call:
   ```
   POST /functions/manageHRRecordLifecycle
   { record_id, new_status: 'submitted' }
   ```
3. Expected: Error

**Expected Behavior:**
- [ ] Backend rejects ✅
- [ ] Error message: "Invalid transition: resolved → submitted"
- [ ] Record remains "resolved" ✅

---

### Test 4.2: Skip State (Submitted → Resolved, Skip Review)

**Setup:**
- HR record in "submitted" state

**Scenario:**
```
Try to jump to resolved without review:
  new_status = 'resolved'
  (skip 'under_review')
  
Expected: Allowed or validation?
```

**Test Method:**
1. Create HR record (status='submitted')
2. Try to go directly to 'resolved'
3. Check if allowed or prevented

**Expected Behavior:**
- [ ] Should be allowed (direct transition exists) ✅
  OR
- [ ] Should be prevented (forced workflow)
- **Verify which design is implemented**

---

### Test 4.3: Duplicate State Transition

**Setup:**
- HR record in "under_review" state

**Scenario:**
```
Try to set status='under_review' (same state):
  new_status = 'under_review'
  
Expected: Error or no-op?
```

**Test Method:**
1. Move record to "under_review"
2. Click dropdown, select "Under Review" again
3. Expected: Error or no change

**Expected Behavior:**
- [ ] Backend catches (idempotent) ✅
- [ ] Or allows (no harm in same state)
- **Verify behavior**

---

## Category 5: Concurrency & Race Conditions

### Test 5.1: Two Admins Archive Same Policy

**Setup:**
- Two admin sessions with same policy open

**Scenario:**
```
Admin 1 clicks Archive → calls managePolicyLifecycle()
Admin 2 clicks Archive (0.1s later) → calls managePolicyLifecycle()

One should fail (policy already archived or locked)
```

**Test Method:**
1. Open `/PolicyEditor` in two browser tabs
2. Tab 1: Click [Archive]
3. Tab 2: Click [Archive] (very quickly)
4. Expected: One succeeds, other fails

**Expected Behavior:**
- [ ] First archive succeeds ✅
- [ ] Second archive fails with 400 or 409 ✅
  "Policy already archived"

---

### Test 5.2: Acknowledge While Policy Being Archived

**Setup:**
- Employee clicking "Acknowledge"
- Admin clicking "Archive" at same time

**Scenario:**
```
Timing: Employee Ack request starts, Admin Archive starts ~same time

Race condition possibilities:
  - Ack succeeds, Archive cascades delete PendingReAcknowledgment
  - Archive succeeds, Ack tries to update Acknowledgment
  - Both succeed (need investigation)
```

**Test Method:**
1. Open `/Handbook` (employee)
2. Open `/PolicyEditor` (admin)
3. Employee hovers over [Acknowledge], Admin clicks [Archive]
4. Employee clicks [Acknowledge] exactly when Admin submits Archive
5. Expected: One operation fails gracefully

**Expected Behavior:**
- [ ] No data corruption ✅
- [ ] One fails with clear error ✅
- [ ] OR both succeed (system handles)

---

### Test 5.3: Edit HR Record While Status Changes

**Setup:**
- Admin A editing HR record
- Admin B changing status

**Scenario:**
```
Admin A: PUT HRRecord.description = "..."
Admin B: POST managePolicyLifecycle(status='resolved', is_locked=true)

What happens to A's edit?
```

**Test Method:**
1. Two admin sessions editing same record
2. Session A: Changes description
3. Session B: Changes status to "resolved"
4. Session A: Submits change
5. Expected: A's edit fails (record now locked)

**Expected Behavior:**
- [ ] Backend rejects A's edit ✅
  "Record is locked"
- [ ] Record remains as B set it ✅

---

## Category 6: Data Consistency Checks

### Test 6.1: Query For Orphaned Acknowledgments

**Setup:**
- After multiple publish/archive cycles

**Scenario:**
```
Run consistency check query:
  SELECT a.* FROM Acknowledgment a
  LEFT JOIN Policy p ON a.policy_id = p.id
  WHERE p.id IS NULL  ← Orphaned acks

Expected: COUNT = 0
```

**Test Method:**
1. Create 3 policies, ack them
2. Archive all 3
3. Run query (via DB tool or backend consistency function)
4. Expected: 0 orphans

**Expected Behavior:**
- [ ] No orphaned Acknowledgments ✅
- [ ] All acks have valid policy_ids

---

### Test 6.2: Query For PolicyVersions Without Parent

**Setup:**
- After testing

**Scenario:**
```
Run query:
  SELECT pv.* FROM PolicyVersion pv
  LEFT JOIN Policy p ON pv.policy_id = p.id
  WHERE p.id IS NULL

Expected: COUNT = 0
```

**Test Method:**
1. Run DB query
2. Expected: 0 orphans

**Expected Behavior:**
- [ ] All versions have parent policies ✅

---

### Test 6.3: Verify is_locked Enforcement

**Setup:**
- Multiple locked records

**Scenario:**
```
Run query:
  SELECT * FROM (PolicyVersion, Acknowledgment, HRRecord)
  WHERE is_locked = true
  
Try to update each:
  UPDATE ... SET field='...'
  WHERE id = <locked_record>
  
Expected: ALL FAIL
```

**Test Method:**
1. Get IDs of locked records (PolicyVersion, Ack, etc.)
2. For each, try API update
3. Expected: ALL rejected with 403/error

**Expected Behavior:**
- [ ] is_locked enforcement consistent ✅
- [ ] No record can be updated if locked ✅

---

## Category 7: Permission Boundary Tests

### Test 7.1: Non-Admin Tries to Archive Policy

**Setup:**
- Login as emp1@testorg.com (employee, not admin)

**Scenario:**
```
Try API call:
  POST /functions/managePolicyLifecycle
  { policy_id, new_status: 'archived' }
  
Expected: 403 Forbidden
```

**Test Method:**
1. Login as employee
2. Via curl/postman:
   ```
   POST /functions/managePolicyLifecycle
   Authorization: Bearer <employee_token>
   { policy_id: '...', new_status: 'archived' }
   ```
3. Expected: 403 error

**Expected Behavior:**
- [ ] Backend checks admin role ✅
- [ ] Employee rejected ✅
- [ ] Error: "Forbidden: Admin access required"

---

### Test 7.2: Non-Admin Tries to Manage HR Record

**Setup:**
- Employee tries to change HR record status

**Scenario:**
```
Try API call:
  POST /functions/manageHRRecordLifecycle
  { record_id, new_status: 'resolved' }
  
Expected: 403 Forbidden
```

**Test Method:**
1. Login as employee
2. Try function call
3. Expected: 403 error

**Expected Behavior:**
- [ ] Employee rejected ✅
- [ ] Error message clear ✅

---

### Test 7.3: Employee Can View Own Ack, Not Others'

**Setup:**
- emp1 and emp2 both ack a policy

**Scenario:**
```
emp1 tries to view emp2's Acknowledgment:
  GET /entities/Acknowledgment/<emp2_ack_id>
  
Expected: 403 Forbidden (or filtered out)
```

**Test Method:**
1. Query for both acks
2. emp1 tries to read emp2's ack ID
3. Expected: Forbidden or filtered

**Expected Behavior:**
- [ ] Backend enforces created_by filter ✅
- [ ] emp1 cannot see emp2's ack ✅

---

## Category 8: Unusual Workflows

### Test 8.1: Archive, Then Try to Re-publish

**Setup:**
- Policy published, then archived

**Scenario:**
```
Admin tries to re-publish archived policy:
  Click [Publish] button
  
Expected: Error or prevention?
```

**Test Method:**
1. Create, publish, archive policy
2. Navigate to `/PolicyEditor?id=<policy_id>`
3. Try to click [Publish]
4. Expected: Button disabled or error

**Expected Behavior:**
- [ ] UI prevents (button disabled) ✅
  OR
- [ ] API rejects ✅
  Error: "Cannot publish archived policy"

---

### Test 8.2: Delete Policy (If Available)

**Setup:**
- Have a policy with published versions and acks

**Scenario:**
```
Try to delete policy:
  Can it be deleted?
  
Expected: Should NOT be allowed (immutable records)
```

**Test Method:**
1. Try to delete via UI (if button exists)
2. Try to delete via API:
   ```
   DELETE /entities/Policy/<id>
   ```
3. Expected: Error

**Expected Behavior:**
- [ ] Deletion prevented ✅
- [ ] Error: "Cannot delete policy (immutable records exist)"
  OR
- [ ] Soft-delete only (archive) ✅

---

## Test Results

| Test | Result | Notes |
|------|--------|-------|
| 1.1 Cascade Failure | [ ] | Rollback works? |
| 1.2 Onboarding Failure | [ ] | Rollback cascades? |
| 2.1 Orphaned Policy | [ ] | Filtered correctly? |
| 2.2 Ack After Archive | [ ] | Ack preserved, hidden? |
| 2.3 PendingReAck Cleanup | [ ] | Records deleted? |
| 3.1 Update PolicyVersion | [ ] | 403 error? |
| 3.2 Update Acknowledgment | [ ] | 403 error? |
| 3.3 Edit Locked HR | [ ] | 403 error? |
| 4.1 Invalid Transition | [ ] | Rejected? |
| 4.2 Skip State | [ ] | Allowed/Prevented? |
| 4.3 Duplicate Transition | [ ] | Handled? |
| 5.1 Concurrent Archive | [ ] | Second fails? |
| 5.2 Ack vs Archive Race | [ ] | No corruption? |
| 5.3 Edit vs Lock Race | [ ] | Edit rejected? |
| 6.1 Orphaned Acks | [ ] | COUNT=0? |
| 6.2 Orphaned Versions | [ ] | COUNT=0? |
| 6.3 is_locked Enforcement | [ ] | All fail to update? |
| 7.1 Non-Admin Archive | [ ] | 403 error? |
| 7.2 Non-Admin HR | [ ] | 403 error? |
| 7.3 Cross-Emp Ack | [ ] | Filtered? |
| 8.1 Republish Archived | [ ] | Prevented? |
| 8.2 Delete Policy | [ ] | Rejected? |

**Overall Result: [ ] ALL PASS**