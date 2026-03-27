import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'policyvault.db');
const db = new Database(dbPath);

const orgId = uuidv4();
const hash = bcrypt.hashSync('Password123!', 10);

// Seed distinct test organization 
db.prepare("INSERT INTO organizations (id, name, status, state, employee_count) VALUES (?, ?, 'active', 'NY', 50)").run(orgId, 'PolicyVault Test Org');

// Seed Org Admin
const adminId = uuidv4();
const adminUserId = uuidv4();
db.prepare("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)").run(adminUserId, 'admin@policyvault.local', hash, 'Admin User');
db.prepare("INSERT INTO employees (id, organization_id, user_email, full_name, permission_level, status, email_verified_at) VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))").run(adminId, orgId, 'admin@policyvault.local', 'Admin User', 'org_admin');

// Seed Normal Employee
const empId = uuidv4();
const empUserId = uuidv4();
db.prepare("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)").run(empUserId, 'employee@policyvault.local', hash, 'Normal Subject');
db.prepare("INSERT INTO employees (id, organization_id, user_email, full_name, permission_level, status, email_verified_at) VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))").run(empId, orgId, 'employee@policyvault.local', 'Normal Subject', 'employee');

console.log('Seeded Org Admin: admin@policyvault.local / Password123!');
console.log('Seeded Employee: employee@policyvault.local / Password123!');
db.close();
