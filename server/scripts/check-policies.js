import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const saltyOrg = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();
const policies = db.prepare("SELECT id, title, status, created_at, updated_at FROM policies WHERE organization_id = ?").all(saltyOrg.id);

const lines = policies.map(p => JSON.stringify(p));
writeFileSync(join(__dirname, '..', 'policy_state.txt'), lines.join('\n'), 'utf8');
console.log('done -', policies.length, 'policies');
db.close();
