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

console.log("Seeding The Salty Spitoon in PENDING Status...");

// 1. Create Organization (PENDING APPROVAL)
const orgId = uuidv4();
db.prepare(`
  INSERT INTO organizations (id, name, industry, status, settings, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(orgId, 'The Salty Spitoon', 'Bar and Tavern', 'pending_approval', JSON.stringify({
  roles: ['Bouncer', 'Bartender', 'Server'],
  departments: ['Front Door', 'Bar']
}), now);

// 2. Create Location
const locId = uuidv4();
db.prepare(`
  INSERT INTO locations (id, organization_id, name, address, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(locId, orgId, 'Main Entrance', '100 Tough Guy Lane', now);

function createEmployee(email, name, role, dept, permLevel) {
  const userId = uuidv4();
  const empId = uuidv4();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, auth_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, passwordHash, name, 'email', now);

  db.prepare(`
    INSERT INTO employees (id, organization_id, user_email, full_name, role, department, location_id, permission_level, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(empId, orgId, email, name, role, dept, locId, permLevel, 'active', now);

  return empId;
}

// 3. Create Admin Employee (The Bouncer / Owner)
createEmployee('reggie@saltyspitoon.local', 'Reggie The Bouncer', 'Bouncer', 'Front Door', 'org_admin');

console.log("✅ The Salty Spitoon seeded in pending_approval state.");
db.close();
