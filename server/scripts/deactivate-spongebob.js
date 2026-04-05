import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const saltyOrg = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();
const spongebob = db.prepare("SELECT id, full_name, status FROM employees WHERE organization_id = ? AND full_name LIKE '%SpongeBob%'").get(saltyOrg.id);

if (spongebob) {
  console.log(`Before: ${spongebob.full_name} status=${spongebob.status}`);
  db.prepare("UPDATE employees SET status = 'inactive' WHERE id = ?").run(spongebob.id);
  
  // Log the termination event
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), saltyOrg.id, 'employee.terminated', 'Employee', spongebob.id, 
    'reggie@saltyspitoon.local', 'Reggie The Bouncer',
    `Terminated ${spongebob.full_name}. File preserved; re-hire carries forward same record.`, now
  );
  
  const after = db.prepare("SELECT full_name, status FROM employees WHERE id = ?").get(spongebob.id);
  console.log(`After: ${after.full_name} status=${after.status}`);
} else {
  console.log('SpongeBob not found!');
}

db.close();
