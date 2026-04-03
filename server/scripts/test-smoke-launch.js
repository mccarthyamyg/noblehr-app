/**
 * Smoke test: Launch Test Instance flow — super admin gets launch token,
 * then we call /me, policies-for-employee, handbook-data as the launched context.
 * Verifies Dashboard, Handbook, and Policies would load in the browser.
 * Run: node scripts/test-smoke-launch.js
 * Requires server on port 3001.
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
  console.log('\n=== Smoke: Launch Test Instance → Dashboard / Handbook / Policies ===\n');

  const saPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!saPassword || saPassword.length < 8) {
    console.error('Set SUPER_ADMIN_PASSWORD in the environment (8+ characters).');
    console.error('Example: SUPER_ADMIN_PASSWORD=YourPass123! node scripts/test-smoke-launch.js');
    process.exit(1);
  }
  const saEmail = process.env.SUPER_ADMIN_EMAIL || 'mccarthy.amyg@gmail.com';

  // 1. Super admin login
  console.log('1. Super admin login...');
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: saEmail, password: saPassword }),
  });
  ok('Super admin login', login.ok && login.data?.token);
  const saToken = login.data?.token;
  if (!saToken) {
    console.log('  Cannot continue without token');
    process.exit(1);
  }

  // 2. Ensure test org
  console.log('\n2. Ensure test org...');
  const ensure = await request('/super-admin/ensure-test-org', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({}),
  });
  ok('Ensure test org', ensure.ok);
  const orgId = ensure.data?.data?.organization_id || ensure.data?.organization_id;
  ok('Test org id', !!orgId);
  if (!orgId) {
    console.log('  No org id:', JSON.stringify(ensure.data));
    process.exit(1);
  }

  // 3. Launch token (impersonate test org)
  console.log('\n3. Launch token...');
  const launch = await request('/super-admin/launch-token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({ organization_id: orgId }),
  });
  ok('Launch token', launch.ok);
  const launchToken = launch.data?.data?.token;
  ok('Token returned', !!launchToken);
  if (!launchToken) {
    console.log('  No launch token');
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${launchToken}` };

  // 4. /me (launched context)
  console.log('\n4. GET /me (launched context)...');
  const me = await request('/me', { headers: auth });
  ok('/me returns 200', me.ok);
  ok('/me has org', !!me.data?.org);
  ok('/me has employee', !!me.data?.employee);
  ok('Impersonation flag', me.data?.superAdminImpersonating === true);

  // 5. policies-for-employee (Policies page / Dashboard)
  console.log('\n5. POST /policies-for-employee (Policies/Dashboard)...');
  const policies = await request('/policies-for-employee', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ organization_id: orgId }),
  });
  ok('policies-for-employee 200', policies.ok);
  ok('policies array', Array.isArray(policies.data?.data?.policies ?? policies.data?.policies));

  // 6. handbook-data list (Handbook page)
  console.log('\n6. POST /handbook-data list_handbooks...');
  const handbooks = await request('/handbook-data', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ action: 'list_handbooks', organization_id: orgId }),
  });
  ok('handbook-data 200', handbooks.ok);
  const list = handbooks.data?.data?.handbooks ?? handbooks.data?.handbooks;
  ok('handbooks array', Array.isArray(list));

  // 7. my-acknowledgments (Dashboard)
  console.log('\n7. POST /my-acknowledgments (Dashboard)...');
  const acks = await request('/my-acknowledgments', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ organization_id: orgId }),
  });
  ok('my-acknowledgments 200', acks.ok);

  console.log('\n=== Smoke Results ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Smoke error:', e);
  process.exit(1);
});
