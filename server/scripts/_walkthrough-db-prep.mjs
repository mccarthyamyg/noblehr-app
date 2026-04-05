/**
 * One-off: ensure walkthrough org has industry for AI Handbook step (optional).
 * Run from server/: node scripts/_walkthrough-db-prep.mjs
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));
const r = db
  .prepare("UPDATE organizations SET industry = ? WHERE name = ? AND (industry IS NULL OR industry = '')")
  .run('restaurant', 'Noble HR Test Org');
console.log('organizations updated:', r.changes);
db.close();
