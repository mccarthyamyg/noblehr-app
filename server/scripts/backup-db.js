/**
 * PolicyVault — SQLite database backup (Phase 4.5)
 *
 * Creates a timestamped copy of policyvault.db in server/data/backups/,
 * then applies retention (keeps last N backups by default).
 * Uses a read-only connection so backup can run while the server is running.
 *
 * Usage:
 *   node server/scripts/backup-db.js
 *   npm run backup --prefix server
 *
 * Env:
 *   BACKUP_RETENTION_COUNT — keep this many backups (default 7)
 *   BACKUP_DIR — override backup directory (default server/data/backups)
 *
 * Restore: stop the app, replace server/data/policyvault.db with a backup file, restart.
 * For production: copy backup files to S3/R2 or another store (cron or separate job).
 */
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'policyvault.db');
const defaultBackupDir = join(dataDir, 'backups');
const retentionCount = Math.max(1, parseInt(process.env.BACKUP_RETENTION_COUNT || '7', 10));
const backupDir = process.env.BACKUP_DIR || defaultBackupDir;

async function run() {
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = join(backupDir, `policyvault-${timestamp}.db`);

  const db = new Database(dbPath, { readonly: true });
  try {
    await db.backup(filename);
    console.log('Backup written:', filename);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }

  // Retention: keep only the last BACKUP_RETENTION_COUNT files (by mtime)
  try {
    const files = readdirSync(backupDir)
      .filter((f) => f.startsWith('policyvault-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: join(backupDir, f),
        mtime: statSync(join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > retentionCount) {
      for (const f of files.slice(retentionCount)) {
        unlinkSync(f.path);
        console.log('Removed old backup:', f.name);
      }
    }
  } catch (err) {
    console.warn('Retention cleanup warning:', err.message);
  }
}

run();
