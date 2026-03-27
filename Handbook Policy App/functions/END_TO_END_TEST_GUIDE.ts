# End-to-End Testing Guide

## Test Suite: Lifecycle Handlers

**Date:** 2026-02-27  
**Admin User Required:** Yes  
**Duration:** ~10 minutes

---

## TEST 1: Publish & Archive Flow

### Prerequisites
- Logged in as org admin
- Have access to PolicyEditor page

### Steps

**1.1 Create New Policy (Draft)**
- Go to Policies page
- Click "New Policy" button
- Enter title: `"Test Archive Policy - $(date)"`
- Enter description: `"This policy will be archived after publish"`
- Click Content tab
- Add sample content: `"- Rule 1\n- Rule 2\n- Rule 3"`
- Click "Save Now" button
- Verify: Policy appears in editor URL as `?id=xxx`

**1.2 Publish Policy (Draft → Active)**
- Click "Publish" button
- Fill in change summary: `"Initial version for testing"`
- Click "Create Version & Publish"
- Verify: Page redirects to Policies list
- Verify: Policy now shows as "Active" with green badge
- Verify: current_version = 1 (shown in policy list)

**1.3 Check Handbook**
- Go to Handbook page
- Look for policy by title
- Verify: Policy appears in handbook sections (should be under one of the categories you set)
- Note: Policy is now visible to all employees

**1.4 Archive Policy (Active → Archived)**
- Go back to Policies page
- Find the test policy
- Click Archive button (trash icon)
- Click OK on confirmation dialog
- Verify: Policy status changes to "Archived" (amber badge)
- Page stays on Policies list

**1.5 Verify Handbook is Clean**
- Go to Handbook page
- Search for test policy title
- Verify: Policy NO LONGER appears
- Verify: No orphaned category sections
- Verify: Other policies still visible

**1.6 Check PendingReAcknowledgments Cleared**
- Go to Re-acknowledgment Management page (admin only)
- Search for test policy
- Verify: No pending re-acks exist for archived policy
- (If policy wasn't applicable to anyone, this is N/A)

### Expected Result
✅ All steps pass = Publish → Archive flow is atomic and clean

### Failure Scenarios
| Issue | Cause |
|-------|-------|
| Policy not published | Check publishPolicy function return |
| Still in handbook after archive | managePolicyLifecycle didn't remove from Handbook |
| PendingReAcknowledgments still exist | Cascade delete failed |
| Handbook section orphaned | Policy array wasn't cleaned properly |

---

## TEST 2: Invalid HR Record Transitions

### Prerequisites
- Logged in as org admin
- Have access to HRRecords page

### Steps

**2.1 Create HR Record (Submitted)**
- Go to HR Records page
- Click "New Record" or similar
- Fill form:
  - Title: `"Test HR Record - $(date)"`
  - Record Type: "write_up"
  - Severity: "medium"
  - Description: "Testing state machine"
- Save/Submit
- Verify: Record shows status = "Submitted" (blue badge)
- Note the record ID for reference

**2.2 Valid Transition: Submitted → Under Review**
- Open the record details
- Find status selector
- Click to change status to "Under Review"
- Verify: Status changes successfully
- Verify: Record is still editable
- Verify: Edit button is enabled (not grayed out)

**2.3 Valid Transition: Under Review → Resolved**
- Keep record in "Under Review" state
- Click to change status to "Resolved"
- Verify: Status changes to "Resolved" (green badge)
- Verify: is_locked should now be true (backend)

**2.4 Invalid Transition: Resolved → Submitted (Should Fail)**
- Try to click status selector on resolved record
- Attempt to change back to "Submitted"
- Verify: Error message appears (should be 400 Bad Request)
- Verify: Status remains "Resolved"
- Check browser console for error details

**2.5 Locked Record Cannot Be Edited**
- With record in "Resolved" state
- Try to edit any field (description, etc.)
- Verify: Edit buttons are DISABLED or grayed out
- Verify: Cannot click to edit
- Verify: No mutations allowed

**2.6 Amendment Record Preserved**
- Open record's amendment log
- Verify: All prior edits (from Submitted & Under Review states) are logged
- Verify: Amendment log is read-only
- Verify: Each amendment shows: field, old value, new value, who changed it

### Expected Result
✅ All steps pass = State machine is enforced and terminal states are locked

### Failure Scenarios
| Issue | Cause |
|-------|-------|
| Can edit resolved record | Backend is_locked check failing |
| Can transition resolved → submitted | Invalid state validation missing |
| Amendment log is empty | logHRRecordEvent not being called |
| Edit buttons not disabled | Frontend not checking is_locked |

---

## TEST 3: Re-acknowledgment Cascade

### Prerequisites
- Logged in as org admin
- Have multiple employees
- Can publish policies

### Steps

**3.1 Create & Publish Policy v1**
- Create new policy with title `"Re-ack Test Policy"`
- Set "Apply to All Employees" = ON
- Publish it
- Verify: Creates PolicyVersion v1
- Verify: policy.status = "active"

**3.2 Check Employee Sees Policy (MyOnboarding)**
- Switch to employee view or check dashboard
- Employee should have pending acknowledgment for this policy
- Verify: Policy appears in "Pending Acknowledgments"

**3.3 Publish Policy v2 (Updated Content)**
- Go back to PolicyEditor
- Click edit on the policy
- Change content slightly
- Publish as v2 with change summary `"Added new rule"`
- Verify: Creates new PolicyVersion v2
- Verify: policy.current_version = 2

**3.4 Check Employee Now Has Re-ack (MyOnboarding)**
- Check employee dashboard
- Verify: Policy now shows "Re-acknowledgment Required" badge (orange)
- Verify: PendingReAcknowledgment was created for v2

**3.5 Archive the Policy**
- Go to Policies page
- Find the re-ack test policy
- Click Archive
- Verify: Status changes to "Archived"

**3.6 Verify Re-ack is Cleared**
- Switch to employee view
- Check MyOnboarding page
- Verify: Re-ack test policy NO LONGER appears
- Verify: No orphaned pending acknowledgments

**3.7 Check Re-ack Management (Admin View)**
- Go to Re-acknowledgment Management
- Search for re-ack test policy
- Verify: Zero pending re-acks for archived policy

### Expected Result
✅ All steps pass = Cascades are atomic, no orphaned data

### Failure Scenarios
| Issue | Cause |
|-------|-------|
| Employee doesn't see v2 re-ack | publishPolicy not creating PendingReAcknowledgments |
| Re-ack still there after archive | managePolicyLifecycle cascade failed |
| Policy still in MyOnboarding | Handbook filter not excluding archived |
| Re-ack Management shows orphans | Delete query ineffective |

---

## Quick Validation Checklist

After running all tests, verify:

- [ ] No 500 errors in console
- [ ] All state transitions logged in SystemEvents
- [ ] No database inconsistencies (run audit query)
- [ ] Handbook is clean (no archived policies visible)
- [ ] No orphaned PendingReAcknowledgment records
- [ ] Locked records truly immutable
- [ ] Amendment logs complete and accurate
- [ ] Admin-only functions blocked for non-admins

---

## Automated Test (Optional)

Run function tests:

```bash
test_backend_function('managePolicyLifecycle', {
  policy_id: 'test-policy-1',
  organization_id: 'test-org-1',
  new_status: 'archived'
})

test_backend_function('manageHRRecordLifecycle', {
  record_id: 'test-record-1',
  organization_id: 'test-org-1',
  new_status: 'resolved',
  record_type: 'HRRecord'
})
```

Expected responses:
- First call: 200 success (admin assumed in test context)
- Second call: 200 success

If 403, verify test is running with admin auth token.

---

## Sign-Off

Once all three tests pass:

- [ ] Test 1: Publish & Archive
- [ ] Test 2: Invalid Transitions & Locks
- [ ] Test 3: Re-ack Cascades

**System Status: ✅ PRODUCTION READY**

Approve for deployment.