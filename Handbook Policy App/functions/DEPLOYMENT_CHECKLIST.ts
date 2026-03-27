# Production Deployment Checklist

**Date:** 2026-02-27  
**Release:** PolicyVault v1.0 (Lifecycle Management)  
**Status:** Ready for deployment

---

## Phase 1: Pre-Deployment Verification (72 hours before)

### Code Quality

- [ ] All TypeScript compiles without errors
- [ ] No console.error or warning logs in production build
- [ ] All @ts-ignore comments documented
- [ ] No console.log statements in production paths
- [ ] Linting passes: `eslint pages/ components/ functions/`

### Backend Functions

- [ ] All 10+ functions tested (see E2E_TESTS.md)
  - [ ] publishPolicy
  - [ ] managePolicyLifecycle
  - [ ] manageHRRecordLifecycle
  - [ ] createSecureAcknowledgment
  - [ ] getApplicablePolicies
  - [ ] getPoliciesForEmployee
  - [ ] getAdminContext
  - [ ] and others...

- [ ] Auth gates verified (admin-only enforced)
- [ ] Error handling: All functions return proper HTTP status codes
- [ ] Timeouts: No functions hang (>30s timeout)

### Database

- [ ] Schema migrations complete
  - [ ] PolicyVersion entity created with is_locked
  - [ ] Acknowledgment entity created with is_locked
  - [ ] PendingReAcknowledgment entity created
  - [ ] Amendment entity created
  - [ ] SystemEvent entity created
  - [ ] HRRecord.is_locked field added
  - [ ] All indexes created for foreign keys

- [ ] Data validation rules set
  - [ ] Policy.status: enum ['draft', 'active', 'archived']
  - [ ] HRRecord.status: enum ['submitted', 'under_review', 'resolved', 'dismissed']
  - [ ] PolicyVersion.is_locked: always true (immutable)
  - [ ] Acknowledgment.is_locked: always true (immutable)

- [ ] Backup created
  - [ ] Full backup of production DB
  - [ ] Backup verified restorable
  - [ ] Backup stored in secure location

---

## Phase 2: Staging Environment Validation (48 hours before)

### Smoke Tests

- [ ] Deploy to staging environment
- [ ] Run full E2E test suite (E2E_TESTS.md)
  - [ ] TEST 1: Policy publish → ack flow ✅
  - [ ] TEST 2: Archive cascade ✅
  - [ ] TEST 3: HR record lifecycle ✅

- [ ] Run edge case suite (EDGE_CASE_TESTING.md)
  - [ ] Cascade failure recovery ✅
  - [ ] Orphaned data detection ✅
  - [ ] Immutability violations ✅
  - [ ] State transition violations ✅
  - [ ] Concurrency tests ✅
  - [ ] Permission boundary tests ✅

### Performance

- [ ] Load test: 100 concurrent users
  - [ ] /Handbook loads in <2s
  - [ ] /Policies loads in <2s
  - [ ] /MyOnboarding loads in <2s
  - [ ] /HRRecords loads in <2s

- [ ] Archive cascade performance (1000 policy + 5000 employees)
  - [ ] Completes in <5s
  - [ ] No DB locks
  - [ ] No timeout errors

### Staging Data Cleanup

- [ ] Delete all test records
- [ ] Verify staging DB is clean
- [ ] No orphaned test data

---

## Phase 3: Production Deployment Window (Scheduled)

### Pre-Deployment (1 hour before)

- [ ] Notify all stakeholders
- [ ] Prepare rollback plan (see below)
- [ ] Ensure team available for 2 hours
- [ ] Check production system health
- [ ] Final DB backup

### Deployment Steps (In Order)

1. **Deploy Code**
   ```
   [ ] Merge to main branch
   [ ] Run production build
   [ ] Verify no errors
   [ ] Push to production servers
   [ ] Confirm all instances updated
   ```

2. **Database Migration**
   ```
   [ ] Run schema migrations
   [ ] Verify all tables exist
   [ ] Verify all columns exist
   [ ] Verify indexes created
   [ ] Verify no locks
   ```

3. **Verify Deployment**
   ```
   [ ] Access /Dashboard → loads
   [ ] Access /Policies → loads
   [ ] Access /Handbook → loads
   [ ] Backend functions responding
   [ ] SystemEvents being logged
   ```

4. **Feature Activation**
   ```
   [ ] Archive button visible in PolicyEditor
   [ ] Lifecycle functions callable
   [ ] HR record status transitions available
   [ ] Amendment log functional
   [ ] Re-ack management visible (admins)
   ```

### Post-Deployment (1 hour after)

- [ ] Monitor error logs (check for crashes)
- [ ] Check performance metrics
  - [ ] Page load times normal
  - [ ] DB query times normal
  - [ ] No 500 errors in server logs

- [ ] Run quick smoke test
  - [ ] Admin can publish policy
  - [ ] Employee can acknowledge
  - [ ] Admin can archive (cascade works)
  - [ ] HR records transition states

- [ ] Verify audit trail
  - [ ] SystemEvents being logged
  - [ ] Amendment records created
  - [ ] All operations tracked

---

## Phase 4: Post-Deployment (24-72 hours)

### Monitoring

- [ ] Daily error log review
- [ ] Check for 403 (permission) errors
- [ ] Monitor DB performance
- [ ] Check for orphaned data queries
  ```sql
  SELECT COUNT(*) FROM Acknowledgment a
  LEFT JOIN Policy p ON a.policy_id = p.id
  WHERE p.id IS NULL;  -- Should be 0
  ```

### User Validation

- [ ] Admin workflow test
  - [ ] Create policy
  - [ ] Publish policy
  - [ ] Employee acknowledges
  - [ ] Archive policy (cascades check)

- [ ] Employee workflow test
  - [ ] Employee sees pending policies
  - [ ] Employee acknowledges
  - [ ] Sees updated status
  - [ ] No archived policies visible

- [ ] HR admin workflow test
  - [ ] Create write-up
  - [ ] Edit and track amendments
  - [ ] Transition states
  - [ ] Lock record (resolve)

### Data Consistency Verification

- [ ] Run consistency checks (every 24h for 72h)
  ```sql
  -- No orphaned acks
  SELECT COUNT(*) FROM Acknowledgment a
  LEFT JOIN Policy p ON a.policy_id = p.id
  WHERE p.id IS NULL;
  
  -- No orphaned versions
  SELECT COUNT(*) FROM PolicyVersion pv
  LEFT JOIN Policy p ON pv.policy_id = p.id
  WHERE p.id IS NULL;
  
  -- No orphaned amendments
  SELECT COUNT(*) FROM Amendment a
  LEFT JOIN HRRecord h ON a.record_id = h.id AND a.record_type='HRRecord'
  WHERE a.record_type='HRRecord' AND h.id IS NULL;
  
  -- All archived policies removed from handbooks
  SELECT COUNT(*) FROM Handbook_PolicySections hps
  LEFT JOIN Policy p ON hps.policy_id = p.id
  WHERE p.status='archived' AND hps.policy_id IS NOT NULL;
  ```

### Lock Enforcement Verification

- [ ] Sample locked records exist
  ```sql
  SELECT COUNT(*) FROM PolicyVersion WHERE is_locked=true;
  SELECT COUNT(*) FROM Acknowledgment WHERE is_locked=true;
  SELECT COUNT(*) FROM HRRecord WHERE status IN ('resolved','dismissed') AND is_locked=true;
  ```

---

## Rollback Plan

### If Critical Issues Found (during 24-72h monitoring)

**Criteria for rollback:**
- Data corruption detected
- Cascades failing to complete (partial state)
- Performance degradation >50%
- 503 errors on core pages

**Rollback Steps:**
1. [ ] Stop accepting new requests (graceful shutdown)
2. [ ] Revert code to previous version
3. [ ] Restore database from backup
4. [ ] Verify system health
5. [ ] Notify stakeholders
6. [ ] Post-mortem analysis

**Rollback Verification:**
```
After rollback:
[ ] /Dashboard loads
[ ] /Policies loads
[ ] Archive button NOT visible (pre-rollback state)
[ ] No new SystemEvents since rollback time
[ ] DB integrity verified
```

---

## Sign-Off

### Required Approvals

- [ ] **Dev Lead**: Code and functions approved
  - Signed: _____________ Date: _______

- [ ] **QA Lead**: All tests passed (E2E + edge cases)
  - Signed: _____________ Date: _______

- [ ] **DBA**: Database migration and backups verified
  - Signed: _____________ Date: _______

- [ ] **Product**: Feature acceptance and requirements met
  - Signed: _____________ Date: _______

- [ ] **Security**: Permission boundaries enforced, data protection verified
  - Signed: _____________ Date: _______

---

## Known Limitations & Future Work

### Implemented in v1.0
✅ Policy publish → acknowledge → archive flow  
✅ HR record lifecycle with amendments  
✅ Immutable records (PolicyVersion, Acknowledgment)  
✅ Cascade operations (archive)  
✅ Permission enforcement (admin-only)  
✅ Audit trail (SystemEvents)  
✅ Amendment tracking (HR records)  

### NOT Included (v1.0)
❌ Policy restore from archived (soft-delete implemented, but restore UI not built)  
❌ Bulk policy operations (archive multiple at once)  
❌ Scheduled re-ack reminders (entity setup ready, automation not built)  
❌ Policy version comparison UI (API ready, UI not built)  
❌ Advanced audit search (stored, but search not implemented)  

### Future Enhancements
- [ ] Policy restore feature (admin can unarchive)
- [ ] Bulk archive operations
- [ ] Reminder automation (scheduled tasks)
- [ ] Version diff viewer (frontend)
- [ ] Advanced compliance reporting
- [ ] Policy analytics dashboard

---

## Support & Maintenance

### Monitoring Dashboard
Create alerts for:
- [ ] Error rate >1%
- [ ] 403 rate increase
- [ ] Function timeout rate
- [ ] DB slow query log
- [ ] Orphaned data detected

### Support Procedures
- [ ] On call: Available for 72h post-deployment
- [ ] Critical issues: 30 min response time
- [ ] Hotfix process: Document and commit to main
- [ ] Weekly health check (first 4 weeks)

### Documentation
- [ ] FULL_SYSTEM_FLOW.md created ✅
- [ ] E2E_TESTS.md created ✅
- [ ] EDGE_CASE_TESTING.md created ✅
- [ ] DEPLOYMENT_CHECKLIST.md created ✅ (this file)
- [ ] Admin guide (how to use features) → TBD
- [ ] Troubleshooting guide → TBD

---

## Final Checklist

**All items must be checked ✅ before deployment proceeds:**

- [ ] Code review completed
- [ ] All tests passed (E2E + edge cases)
- [ ] Database backups verified
- [ ] Staging deployment successful
- [ ] Performance validated
- [ ] Team trained on new features
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Sign-offs obtained
- [ ] Deployment window scheduled
- [ ] Stakeholders notified
- [ ] Go/No-go decision made: **GO**

---

**Deployment Approved By:** ________________  
**Date:** ________________  
**Deployment Start Time:** ________________  
**Deployment End Time:** ________________  
**Post-Deployment Validation:** ________________  

---

## Appendix: Common Commands

### Check System Health
```bash
# Backend functions status
curl https://api.app/health

# Database connection
psql -h prod-db.internal -U admin -d policydb -c "SELECT version();"

# Recent errors
tail -f /var/log/app/production.log | grep ERROR

# Count of each entity
psql -d policydb -c "
  SELECT 'Policy' as entity, COUNT(*) as count FROM Policy
  UNION ALL
  SELECT 'PolicyVersion', COUNT(*) FROM PolicyVersion
  UNION ALL
  SELECT 'Acknowledgment', COUNT(*) FROM Acknowledgment
  UNION ALL
  SELECT 'HRRecord', COUNT(*) FROM HRRecord
  UNION ALL
  SELECT 'SystemEvent', COUNT(*) FROM SystemEvent;"
```

### Verify Cascades
```bash
# After archiving policy, check cascades:

# 1. Policy status
psql -d policydb -c "
  SELECT id, status FROM Policy WHERE id='<policy_id>';"

# 2. Removed from handbooks
psql -d policydb -c "
  SELECT COUNT(*) FROM Handbook_PolicySections 
  WHERE policy_id='<policy_id>';"  # Should be 0

# 3. Pending re-acks deleted
psql -d policydb -c "
  SELECT COUNT(*) FROM PendingReAcknowledgment 
  WHERE policy_id='<policy_id>';"  # Should be 0

# 4. Onboarding records updated
psql -d policydb -c "
  SELECT COUNT(*) FROM Onboarding 
  WHERE assigned_policy_ids @> ARRAY['<policy_id>'];"  # Should be 0
```

### Rollback Database
```bash
# Restore from backup
pg_restore -h prod-db.internal -U admin -d policydb /backups/latest.sql.gz

# Verify
psql -d policydb -c "SELECT COUNT(*) FROM Policy;"
``