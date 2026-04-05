import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const now = new Date().toISOString();

// Fix: set email_verified_at for all Salty Spitoon employees
const saltyOrg = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();

if (saltyOrg) {
  const result = db.prepare("UPDATE employees SET email_verified_at = ? WHERE organization_id = ? AND (email_verified_at IS NULL OR email_verified_at = '')").run(now, saltyOrg.id);
  console.log(`Verified ${result.changes} Salty Spitoon employee(s)`);
  
  // Confirm
  const emps = db.prepare("SELECT full_name, user_email, email_verified_at FROM employees WHERE organization_id = ?").all(saltyOrg.id);
  emps.forEach(e => console.log(`  ${e.full_name} (${e.user_email}): verified_at=${e.email_verified_at}`));
} else {
  console.log('Salty Spitoon org not found!');
}

db.close();
