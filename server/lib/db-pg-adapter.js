import pg from 'pg';
import { db as sqliteDb } from './db.js';

const { Pool } = pg;
const url = process.env.DATABASE_URL;

let pool = null;
if (url) {
  pool = new Pool({ connectionString: url });
}

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

class PreparedStatement {
  constructor(queryString, client) {
    this.queryString = queryString;
    this._client = client || null; // Transaction-scoped client override
    this.pgQuery = '';
    let count = 1;
    let inString = false;
    for (let i = 0; i < queryString.length; i++) {
        const char = queryString[i];
        if (char === "'") inString = !inString;
        if (char === '?' && !inString) {
            this.pgQuery += `$${count++}`;
        } else {
            this.pgQuery += char;
        }
    }
  }

  async get(...args) {
    if (!pool) return sqliteDb.prepare(this.queryString).get(...args);
    const target = this._client || pool;
    const result = await target.query(this.pgQuery, args);
    return result.rows[0] || undefined;
  }

  async all(...args) {
    if (!pool) return sqliteDb.prepare(this.queryString).all(...args);
    const target = this._client || pool;
    const result = await target.query(this.pgQuery, args);
    return result.rows;
  }

  async run(...args) {
    if (!pool) return sqliteDb.prepare(this.queryString).run(...args);
    const target = this._client || pool;
    const result = await target.query(this.pgQuery, args);
    return { changes: result.rowCount, lastInsertRowid: null };
  }
}

export const db = {
  prepare: (query) => new PreparedStatement(query),
  pragma: () => {}, 
  transaction: (fn) => {
    return async (...args) => {
      if (!pool) return sqliteDb.transaction(fn)(...args);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(...args);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    };
  }
};
