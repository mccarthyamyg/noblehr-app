import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'policyvault.db');

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

export function parseJson(val) {
  if (!val) return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    return null;
  }
}

export function stringifyJson(val) {
  return val == null ? null : JSON.stringify(val);
}
