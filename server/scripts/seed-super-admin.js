/**
 * Seed or update super admin (same DB as the running API: use db-pg-adapter).
 *
 * Run: node scripts/seed-super-admin.js [password]
 * Or: SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js
 * If no password provided, generates a random one and prints it.
 *
 * In production (NODE_ENV=production), SUPER_ADMIN_EMAIL is required.
 */
import { v4 as uuidv4 } from 'uuid';
import { upsertSuperAdminCredentials } from '../lib/super-admin-sync.js';

const isProd = process.env.NODE_ENV === 'production';
const emailFromEnv = process.env.SUPER_ADMIN_EMAIL?.trim();
const SUPER_ADMIN_EMAIL = emailFromEnv || (!isProd ? 'mccarthy.amyg@gmail.com' : null);

const password = process.argv[2] || process.env.SUPER_ADMIN_PASSWORD;
const finalPassword = password && password.length >= 8
  ? password
  : uuidv4().slice(0, 12);

async function main() {
  try {
    if (!SUPER_ADMIN_EMAIL) {
      console.error('Set SUPER_ADMIN_EMAIL (required in production). Example: SUPER_ADMIN_EMAIL=you@company.com SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js');
      process.exit(1);
    }
    await upsertSuperAdminCredentials(SUPER_ADMIN_EMAIL, finalPassword);
    console.log('Super admin ready:', SUPER_ADMIN_EMAIL);
  } catch (err) {
    console.error('Super admin seed failed:', err.message);
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.log('\nGenerated password (save this):', finalPassword);
    console.log('To set your own: SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node scripts/seed-super-admin.js');
  }
}

main();
