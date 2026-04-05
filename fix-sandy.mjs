import Database from 'better-sqlite3';
import { createHash } from 'crypto';

const db = new Database('./server/data/noblehr.db');

function hashPassword(pw) {
  return createHash('sha256').update(pw).digest('hex');
}

const org = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();
console.log('Org ID:', org.id);

// Fix Sandy's password
const sandy = db.prepare("SELECT user_email FROM employees WHERE organization_id = ? AND full_name LIKE '%Sandy%'").get(org.id);
console.log('Sandy email:', sandy?.user_email);

const sandyUser = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(sandy?.user_email);
console.log('Sandy user exists:', !!sandyUser);

const correctHash = hashPassword('WalkthroughQA2026!');
if (sandyUser) {
  console.log('Current hash matches:', sandyUser.password_hash === correctHash);
  if (sandyUser.password_hash !== correctHash) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(correctHash, sandyUser.id);
    console.log('FIXED Sandy password');
  }
}

// Check events  
const events = db.prepare("SELECT organization_id, event_type, summary FROM system_events ORDER BY created_at DESC LIMIT 5").all();
console.log('\nRecent events:', events.length);
events.forEach(e => {
  const orgSlice = e.organization_id ? e.organization_id.slice(0, 8) : 'null';
  console.log(`  org=${orgSlice} type=${e.event_type}`);
});

// Check if Activity Log frontend queries by org_id
console.log('\nSalty Spitoon events:', db.prepare("SELECT COUNT(*) as c FROM system_events WHERE organization_id = ?").get(org.id).c);
console.log('Events with deleted_at IS NULL:', db.prepare("SELECT COUNT(*) as c FROM system_events WHERE organization_id = ? AND deleted_at IS NULL").get(org.id).c);

db.close();
