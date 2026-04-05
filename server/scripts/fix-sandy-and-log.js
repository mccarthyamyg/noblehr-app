import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

function hashPassword(pw) {
  return createHash('sha256').update(pw).digest('hex');
}

const saltyOrg = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();

// Check Sandy's user record
const sandyEmp = db.prepare("SELECT * FROM employees WHERE organization_id = ? AND full_name LIKE '%Sandy%'").get(saltyOrg.id);
console.log('Sandy employee:', sandyEmp?.user_email, 'status:', sandyEmp?.status);

// Check if Sandy has a user record
const sandyUser = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(sandyEmp?.user_email);
console.log('Sandy user found:', !!sandyUser, sandyUser?.email);
console.log('Sandy password_hash:', sandyUser?.password_hash?.slice(0, 20));

// Fix Sandy's password
const correctHash = hashPassword('WalkthroughQA2026!');
console.log('Expected hash:', correctHash.slice(0, 20));
console.log('Match:', sandyUser?.password_hash === correctHash);

if (sandyUser && sandyUser.password_hash !== correctHash) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(correctHash, sandyUser.id);
  console.log('Fixed Sandy password');
}

// Also check SpongeBob
const sbEmp = db.prepare("SELECT * FROM employees WHERE organization_id = ? AND full_name LIKE '%SpongeBob%'").get(saltyOrg.id);
const sbUser = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(sbEmp?.user_email);
console.log('\nSpongeBob user found:', !!sbUser, sbUser?.email);
if (sbUser && sbUser.password_hash !== correctHash) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(correctHash, sbUser.id);
  console.log('Fixed SpongeBob password');
}

// Check activity log events
const events = db.prepare("SELECT id, organization_id, event_type, summary FROM system_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 10").all(saltyOrg.id);
console.log('\nActivity log events for Salty Spitoon org:', events.length);
events.forEach(e => console.log(`  ${e.event_type}: ${e.summary?.slice(0, 60)}`));

// Check if there are events with a DIFFERENT org_id (or null)
const allEvents = db.prepare("SELECT organization_id, event_type, summary FROM system_events ORDER BY created_at DESC LIMIT 20").all();
console.log('\nAll recent system events:');
allEvents.forEach(e => console.log(`  org=${e.organization_id?.slice(0,8)} type=${e.event_type}: ${e.summary?.slice(0,60)}`));

db.close();
