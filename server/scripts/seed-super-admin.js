/**
 * Seed super admin: mccarthy.amyg@gmail.com
 * Run: node scripts/seed-super-admin.js [password]
 * Or: SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js (no argv)
 * If no password provided, generates a random one and prints it.
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'policyvault.db');

const SUPER_ADMIN_EMAIL = 'mccarthy.amyg@gmail.com';
const SALT_ROUNDS = 10;

const db = new Database(dbPath);

// Ensure super_admins table exists
db.exec(`
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const password = process.argv[2] || process.env.SUPER_ADMIN_PASSWORD;
const finalPassword = password && password.length >= 8
  ? password
  : uuidv4().slice(0, 12);

const hash = bcrypt.hashSync(finalPassword, SALT_ROUNDS);
const id = uuidv4();

const existing = db.prepare('SELECT id FROM super_admins WHERE email = ?').get(SUPER_ADMIN_EMAIL);

if (existing) {
  db.prepare('UPDATE super_admins SET password_hash = ?, full_name = ? WHERE email = ?').run(
    hash, 'Super Administrator', SUPER_ADMIN_EMAIL
  );
  console.log('Super admin password updated for', SUPER_ADMIN_EMAIL);
} else {
  db.prepare('INSERT INTO super_admins (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
    id, SUPER_ADMIN_EMAIL, hash, 'Super Administrator'
  );
  console.log('Super admin created:', SUPER_ADMIN_EMAIL);
}

if (!password || password.length < 8) {
  console.log('\nGenerated password (save this):', finalPassword);
  console.log('To set your own: node scripts/seed-super-admin.js YourPassword123 or SUPER_ADMIN_PASSWORD=...');
}

db.close();
