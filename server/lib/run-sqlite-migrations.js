/**
 * Ordered SQLite migrations (Phase 5). Files: server/scripts/migrations/sqlite/*.sql
 * Baseline schema remains owned by init-db.js; migrations apply incremental DDL only.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runSqliteMigrations(db) {
  const migrationsDir = join(__dirname, '..', 'scripts', 'migrations', 'sqlite');
  if (!existsSync(migrationsDir)) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(file);
    if (done) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8').trim();
    if (sql) db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
  }
}
