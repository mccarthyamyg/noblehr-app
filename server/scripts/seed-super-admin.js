/**
 * Seed super admin: mccarthy.amyg@gmail.com
 * Supports both SQLite and PostgreSQL (auto-detects via DATABASE_URL).
 * 
 * Run: node scripts/seed-super-admin.js [password]
 * Or: SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js
 * If no password provided, generates a random one and prints it.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPER_ADMIN_EMAIL = 'mccarthy.amyg@gmail.com';
const SALT_ROUNDS = 12;

const password = process.argv[2] || process.env.SUPER_ADMIN_PASSWORD;
const finalPassword = password && password.length >= 8
  ? password
  : uuidv4().slice(0, 12);

const hash = bcrypt.hashSync(finalPassword, SALT_ROUNDS);
const id = uuidv4();

async function seedPostgres() {
  const pg = await import('pg');
  const { Pool } = pg.default || pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    const { rows } = await pool.query('SELECT id FROM super_admins WHERE email = $1', [SUPER_ADMIN_EMAIL]);
    if (rows.length > 0) {
      await pool.query('UPDATE super_admins SET password_hash = $1, full_name = $2 WHERE email = $3',
        [hash, 'Super Administrator', SUPER_ADMIN_EMAIL]);
      console.log('Super admin password updated for', SUPER_ADMIN_EMAIL);
    } else {
      await pool.query('INSERT INTO super_admins (id, email, password_hash, full_name) VALUES ($1, $2, $3, $4)',
        [id, SUPER_ADMIN_EMAIL, hash, 'Super Administrator']);
      console.log('Super admin created:', SUPER_ADMIN_EMAIL);
    }
  } finally {
    await pool.end();
  }
}

async function seedSqlite() {
  const Database = (await import('better-sqlite3')).default;
  const dbPath = join(__dirname, '..', 'data', 'noblehr.db');
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const existing = db.prepare('SELECT id FROM super_admins WHERE email = ?').get(SUPER_ADMIN_EMAIL);
  if (existing) {
    db.prepare('UPDATE super_admins SET password_hash = ?, full_name = ? WHERE email = ?').run(
      hash, 'Super Administrator', SUPER_ADMIN_EMAIL);
    console.log('Super admin password updated for', SUPER_ADMIN_EMAIL);
  } else {
    db.prepare('INSERT INTO super_admins (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
      id, SUPER_ADMIN_EMAIL, hash, 'Super Administrator');
    console.log('Super admin created:', SUPER_ADMIN_EMAIL);
  }
  db.close();
}

// Main
try {
  if (process.env.DATABASE_URL) {
    await seedPostgres();
  } else {
    await seedSqlite();
  }
} catch (err) {
  console.error('Super admin seed failed:', err.message);
  process.exit(1);
}

if (!password || password.length < 8) {
  console.log('\nGenerated password (save this):', finalPassword);
  console.log('To set your own: SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js');
}
