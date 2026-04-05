import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const lines = [];

// Get schema of users table
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
lines.push('SCHEMA: ' + schema.sql);

// Get a sample user
const sample = db.prepare("SELECT * FROM users WHERE email = 'reggie@saltyspitoon.local'").get();
lines.push('COLUMNS: ' + Object.keys(sample).join(', '));
lines.push('SAMPLE: ' + JSON.stringify(sample, null, 2));

db.close();
writeFileSync(join(__dirname, '..', 'schema_out.txt'), lines.join('\n'), 'utf8');
console.log('done');
