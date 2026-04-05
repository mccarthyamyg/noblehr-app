import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'noblehr.db');
const db = new Database(dbPath);

const SALT_ROUNDS = 10;
const passwordHash = bcrypt.hashSync('WalkthroughQA2026!', SALT_ROUNDS);
const now = new Date().toISOString();

console.log("Starting The Krusty Krab Seeding...");

// 1. Create Organization
const orgId = uuidv4();
db.prepare(`
  INSERT INTO organizations (id, name, industry, status, settings, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(orgId, 'The Krusty Krab', 'Restaurant / Fast Food', 'approved', JSON.stringify({
  roles: ['Manager', 'Cashier', 'Fry Cook'],
  departments: ['Front of House', 'Kitchen']
}), now);

// 2. Create Location
const locId = uuidv4();
db.prepare(`
  INSERT INTO locations (id, organization_id, name, address, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(locId, orgId, 'Bikini Bottom Branch', '124 Conch Street', now);

// Helper function to create users/employees
function createEmployee(email, name, role, dept, permLevel) {
  const userId = uuidv4();
  const empId = uuidv4();

  // Create User
  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, auth_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, passwordHash, name, 'email', now);

  // Create Employee Record
  db.prepare(`
    INSERT INTO employees (id, organization_id, user_email, full_name, role, department, location_id, permission_level, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(empId, orgId, email, name, role, dept, locId, permLevel, 'active', now);

  return empId;
}

// 3. Create Employees
const adminId = createEmployee('mrkrabs@krustykrab.local', 'Eugene Krabs', 'Manager', 'Front of House', 'admin');
const employeeId = createEmployee('spongebob@krustykrab.local', 'SpongeBob SquarePants', 'Fry Cook', 'Kitchen', 'employee');
const supervisorId = createEmployee('squidward@krustykrab.local', 'Squidward Tentacles', 'Cashier', 'Front of House', 'supervisor');

// 4. Create Policies
function createPolicy(title, contentStr, required) {
  const policyId = uuidv4();
  const pvId = uuidv4();

  db.prepare(`
    INSERT INTO policies (id, organization_id, title, description, status, current_version, acknowledgment_required, handbook_category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(policyId, orgId, title, 'Standard protocol', 'published', 1, required ? 1 : 0, 'General Rules', now);

  db.prepare(`
    INSERT INTO policy_versions (id, policy_id, version_number, content, is_locked, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pvId, policyId, 1, contentStr, 1, now);
  
  return { policyId, pvId };
}

const policy1 = createPolicy('Secret Formula Protection Act', '<p>The Krabby Patty secret formula must never be shared, especially with Plankton. Failure to comply will result in immediate termination.</p>', true);
const policy2 = createPolicy('Mandatory Hygiene Standard', '<p>All employees must wash their hands before operating the grill.</p>', true);

// 5. Create an Incident Report
db.prepare(`
  INSERT INTO incident_reports (id, organization_id, employee_id, title, description, status, incident_type, severity, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(uuidv4(), orgId, employeeId, 'Burnt Krabby Patty', 'I accidentally left a patty on the grill for 3 hours while jellyfishing.', 'submitted', 'Operations', 'High', now);

// 6. Create an Acknowledgment (Spongebob signed the Hygiene Standard)
db.prepare(`
  INSERT INTO acknowledgments (id, organization_id, policy_id, policy_version_id, policy_title, version_number, employee_id, employee_name, employee_email, acknowledged_at, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(uuidv4(), orgId, policy2.policyId, policy2.pvId, 'Mandatory Hygiene Standard', 1, employeeId, 'SpongeBob SquarePants', 'spongebob@krustykrab.local', now, 'MOCK_HASH_123');

console.log("✅ Successfully seeded The Krusty Krab!");
console.log("Admin Login: mrkrabs@krustykrab.local | Password: WalkthroughQA2026!");
console.log("Employee Login: spongebob@krustykrab.local | Password: WalkthroughQA2026!");

db.close();
