/**
 * E2E test: signup, approval, super admin dashboard, invites
 * Run: node scripts/test-e2e.js
 * Requires server running on port 3001
 */
const API = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const { headers: optHeaders, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile', ...optHeaders },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}${detail ? `: ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

async function run() {
  console.log('\n=== E2E Test: Signup, Approval, Super Admin ===\n');

  const testEmail = `test-org-${Date.now()}@test.example.com`;
  const testPass = 'TestPass123!';
  const orgName = `Test Org ${Date.now()}`;

  // 1. Register new org (location signup)
  console.log('1. Register new organization...');
  let reg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPass,
      full_name: 'Test Admin',
      org_name: orgName,
      industry: 'Restaurant',
      locations: [{ name: 'Main Location', address: '123 Test St' }],
      accept_tos: true,
    }),
  });
  ok('Register returns success', reg.ok && reg.data?.success);
  ok('Register indicates pending approval', reg.data?.pendingApproval === true);

  // 2. Try login as org admin - should fail (pending approval)
  console.log('\n2. Login as org admin (should fail - pending approval)...');
  const loginPending = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPass }),
  });
  ok('Login blocked for pending org', !loginPending.ok && loginPending.status === 403);
  ok('Error message mentions approval', loginPending.data?.error?.toLowerCase().includes('approval'));

  // 3. Login as super admin
  console.log('\n3. Login as super admin...');
  const saEmail = process.env.SUPER_ADMIN_EMAIL || 'mccarthy.amyg@gmail.com';
  const saPassword = process.env.SUPER_ADMIN_PASSWORD || 'PolicyVault2025!';
  const saLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: saEmail, password: saPassword }),
  });
  ok('Super admin login succeeds', saLogin.ok && saLogin.data?.token);
  ok('Super admin flag set', saLogin.data?.superAdmin === true);
  const saToken = saLogin.data?.token;
  if (!saToken) {
    console.log('  Cannot continue without super admin token');
    return;
  }

  // 4. Super admin: pending orgs
  console.log('\n4. Super admin: fetch pending orgs...');
  const pending = await request('/super-admin/pending-orgs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({}),
  });
  ok('Pending orgs API succeeds', pending.ok);
  const pendingList = pending.data?.data || [];
  ok('Pending list contains new org', pendingList.some(o => o.name === orgName));
  const orgToApprove = pendingList.find(o => o.name === orgName);
  if (!orgToApprove) {
    console.log('  Org not found in pending list - check register');
    return;
  }
  if (!orgToApprove.id) {
    console.log('  Org missing id:', JSON.stringify(orgToApprove));
    return;
  }

  // 5. Approve org
  console.log('\n5. Super admin: approve org...');
  const approveBody = { organization_id: orgToApprove.id };
  const approvePayload = JSON.stringify(approveBody);
  let approve = await request('/super-admin/approve-org', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: approvePayload,
  });
  ok('Approve API succeeds', approve.ok);

  // 6. Login as org admin - should succeed now
  console.log('\n6. Login as org admin (after approval)...');
  const loginApproved = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPass }),
  });
  ok('Org admin login succeeds', loginApproved.ok && loginApproved.data?.token);
  ok('Org context returned', loginApproved.data?.org && loginApproved.data?.employee);
  const orgToken = loginApproved.data?.token;

  // 7. Super admin: orgs with locations
  console.log('\n7. Super admin: orgs with locations...');
  const orgsWithLocs = await request('/super-admin/orgs-with-locations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({}),
  });
  ok('Orgs with locations API succeeds', orgsWithLocs.ok);
  const approvedList = orgsWithLocs.data?.data || [];
  ok('Approved list contains org', approvedList.some(o => o.name === orgName));
  const approvedOrg = approvedList.find(o => o.name === orgName);
  ok('Org has locations', approvedOrg?.locations?.length > 0);
  ok('Org has admin info', approvedOrg?.admin_email && approvedOrg?.admin_name);

  // 8. Super admin: launch token (skip if no approved org)
  console.log('\n8. Super admin: launch token...');
  if (!approvedOrg) {
    console.log('    Skipping - no approved org found');
  } else {
  const launch = await request('/super-admin/launch-token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({ organization_id: approvedOrg.id }),
  });
  ok('Launch token API succeeds', launch.ok);
  ok('Launch link returned', launch.data?.data?.launch_link?.includes('/Launch?token='));
  }

  // 9. Org admin: /me
  console.log('\n9. Org admin: /me...');
  if (orgToken) {
    const me = await request('/me', {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    ok('Org admin /me succeeds', me.ok);
    ok('Org returned', me.data?.org?.id === orgToApprove.id);
  } else {
    ok('Org admin /me succeeds', false);
    ok('Org returned', false);
  }

  // 10. Org admin: create invite (admin can invite after approval)
  console.log('\n10. Org admin: create invite...');
  if (orgToken) {
  const invite = await request('/invites/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({
      email: `invitee-${Date.now()}@test.example.com`,
      full_name: 'Invitee Test',
      role: 'Employee',
      department: 'Operations',
    }),
  });
  ok('Invite create succeeds', invite.ok);
  } else {
    ok('Invite create succeeds', false);
  }

  // 11. Org admin: account features (change password, update profile)
  console.log('\n11. Org admin: account features...');
  if (orgToken) {
    const updateProfile = await request('/account/update-profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgToken}` },
      body: JSON.stringify({ full_name: 'Test Admin Updated', phone_number: '555-123-4567' }),
    });
    ok('Update profile succeeds', updateProfile.ok);
    // Change password back so we don't lock out - use the same password
    const changePw = await request('/account/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${orgToken}` },
      body: JSON.stringify({ current_password: testPass, new_password: testPass }),
    });
    ok('Change password succeeds', changePw.ok);
  } else {
    ok('Update profile succeeds', false);
    ok('Change password succeeds', false);
  }

  // 12. Ensure test org
  console.log('\n12. Super admin: ensure test org...');
  const testOrg = await request('/super-admin/ensure-test-org', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({}),
  });
  ok('Ensure test org succeeds', testOrg.ok);
  ok('Test org id returned', testOrg.data?.data?.organization_id);

  // 13. Forgot password (public - no auth)
  console.log('\n13. Forgot password...');
  const forgotPw = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail }),
  });
  ok('Forgot password returns success', forgotPw.ok);

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
