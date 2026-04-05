import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'noblehr.db');
const db = new Database(dbPath);

const info = db.prepare("UPDATE organizations SET status = 'active' WHERE name = 'The Krusty Krab'").run();
console.log("Organizations set to active:", info.changes);
db.close();
