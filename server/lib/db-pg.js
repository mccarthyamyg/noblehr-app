/**
 * Optional PostgreSQL + Drizzle client. Used when DATABASE_URL is set.
 * Existing routes still use server/lib/db.js (SQLite). To migrate a route to Drizzle,
 * check `getDrizzlePg()` and use it when non-null; otherwise keep using db from db.js.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';

const { Pool } = pg;

let _pool = null;
let _drizzle = null;

/**
 * @returns {import('drizzle-orm/node-postgres').NodePgDatabase | null} Drizzle client or null if DATABASE_URL not set
 */
export function getDrizzlePg() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_drizzle) {
    _pool = new Pool({ connectionString: url });
    _drizzle = drizzle(_pool, { schema });
  }
  return _drizzle;
}

/** Close the pg pool (e.g. on server shutdown). No-op if never connected. */
export async function closeDrizzlePg() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _drizzle = null;
  }
}
