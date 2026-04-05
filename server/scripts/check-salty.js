import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const lines = [];

const saltyOrg = db.prepare("SELECT id, name, status FROM organizations WHERE name = 'The Salty Spitoon'").get();
lines.push('ORG: ' + JSON.stringify(saltyOrg));

if (saltyOrg) {
  const emps = db.prepare('SELECT full_name, user_email, role, permission_level, status FROM employees WHERE organization_id = ?').all(saltyOrg.id);
  lines.push('EMPLOYEES (' + emps.length + '):');
  emps.forEach(e => lines.push('  ' + JSON.stringify(e)));
  
  const policies = db.prepare('SELECT title, status FROM policies WHERE organization_id = ?').all(saltyOrg.id);
  lines.push('POLICIES (' + policies.length + '):');
  if (policies.length === 0) lines.push('  (none)');
  policies.forEach(p => lines.push('  ' + JSON.stringify(p)));
}

db.close();
writeFileSync(join(__dirname, '..', 'salty_state.txt'), lines.join('\n'), 'utf8');
console.log('Written to salty_state.txt');
