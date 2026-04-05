import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

// Ensure column exists
try { db.prepare('ALTER TABLE users ADD COLUMN email_verified_at TEXT').run(); } catch(e) {}

// Fix all mghr users
const r = db.prepare("UPDATE users SET email_verified_at = '2026-01-01T00:00:00Z' WHERE email LIKE '%@mghr.local'").run();
console.log('Fixed', r.changes, 'MGHR users');
db.close();
