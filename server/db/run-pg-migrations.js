/**
 * PostgreSQL migration runner for Noble HR.
 * Run migrations in order from server/db/pg-migrations/*.sql
 * 
 * Usage:
 *   - Automatic: set AUTO_MIGRATE=true in env, runs on server startup
 *   - Manual:    node server/db/run-pg-migrations.js
 * 
 * Tracks applied migrations in a _pg_migrations table.
 */
import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'pg-migrations');

const { Pool } = pg;

/**
 * Run all pending PostgreSQL migrations.
 * @param {string} [databaseUrl] - Override DATABASE_URL for manual runs
 */
export async function runPgMigrations(databaseUrl) {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    console.log('[pg-migrate] No DATABASE_URL set — skipping PostgreSQL migrations.');
    return;
  }

  if (!existsSync(MIGRATIONS_DIR)) {
    console.log('[pg-migrate] No pg-migrations directory found — skipping.');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }  // Railway internal networking
      : false,
  });

  try {
    // Create tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _pg_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of already-applied migrations
    const applied = new Set(
      (await pool.query('SELECT version FROM _pg_migrations')).rows.map(r => r.version)
    );

    // Get all .sql files sorted
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      console.log(`[pg-migrate] Applying: ${file}`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').trim();

      if (sql) {
        await pool.query(sql);
      }

      await pool.query('INSERT INTO _pg_migrations (version) VALUES ($1)', [file]);
      count++;
      console.log(`[pg-migrate] ✓ Applied: ${file}`);
    }

    if (count === 0) {
      console.log('[pg-migrate] All migrations already applied.');
    } else {
      console.log(`[pg-migrate] ${count} migration(s) applied successfully.`);
    }
  } catch (err) {
    console.error('[pg-migrate] Migration failed:', err.message);
    throw err; // Let caller decide whether to crash
  } finally {
    await pool.end();
  }
}

// If run directly: node server/db/run-pg-migrations.js [DATABASE_URL]
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) {
  const url = process.argv[2] || process.env.DATABASE_URL;
  if (!url) {
    console.error('Usage: node server/db/run-pg-migrations.js <DATABASE_URL>');
    process.exit(1);
  }
  runPgMigrations(url)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
