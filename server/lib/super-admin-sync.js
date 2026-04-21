/**
 * Upsert super admin using the same DB layer as auth (PostgreSQL or SQLite via db-pg-adapter).
 * Lookup is case-insensitive on email, matching POST /api/auth/login.
 */
import { db } from './db-pg-adapter.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

export async function upsertSuperAdminCredentials(emailRaw, plainPassword) {
  const emailLower = emailRaw?.trim().toLowerCase();
  if (!emailLower) throw new Error('Super admin email is required');
  const pw = String(plainPassword ?? '').trim();
  if (pw.length < 8) {
    throw new Error('Super admin password must be at least 8 characters');
  }

  const hash = bcrypt.hashSync(pw, SALT_ROUNDS);
  const existing = await db.prepare('SELECT id FROM super_admins WHERE LOWER(email) = ?').get(emailLower);

  if (existing) {
    await db.prepare(
      'UPDATE super_admins SET password_hash = ?, full_name = ?, email = ? WHERE id = ?',
    ).run(hash, 'Super Administrator', emailLower, existing.id);
  } else {
    await db.prepare(
      'INSERT INTO super_admins (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
    ).run(uuidv4(), emailLower, hash, 'Super Administrator');
  }
}
