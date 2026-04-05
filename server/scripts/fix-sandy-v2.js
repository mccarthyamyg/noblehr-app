import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

function hashPassword(pw) {
  return createHash('sha256').update(pw).digest('hex');
}

const lines = [];
const log = (msg) => { lines.push(msg); console.log(msg); };

const org = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();
log('Org ID: ' + org.id);

const sandy = db.prepare("SELECT user_email FROM employees WHERE organization_id = ? AND full_name LIKE '%Sandy%'").get(org.id);
log('Sandy email: ' + sandy?.user_email);

const sandyUser = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(sandy?.user_email);
log('Sandy user exists: ' + !!sandyUser);

const correctHash = hashPassword('WalkthroughQA2026!');
if (sandyUser) {
  log('Current hash matches: ' + (sandyUser.password_hash === correctHash));
  if (sandyUser.password_hash !== correctHash) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(correctHash, sandyUser.id);
    log('FIXED Sandy password');
  }
}

const events = db.prepare("SELECT organization_id, event_type, summary FROM system_events ORDER BY created_at DESC LIMIT 5").all();
log('Recent events: ' + events.length);
events.forEach(e => {
  log('  org=' + (e.organization_id || 'null').slice(0, 8) + ' type=' + e.event_type + ' sum=' + (e.summary || '').slice(0, 60));
});

log('Salty Spitoon events total: ' + db.prepare("SELECT COUNT(*) as c FROM system_events WHERE organization_id = ?").get(org.id).c);
log('Events with deleted_at IS NULL: ' + db.prepare("SELECT COUNT(*) as c FROM system_events WHERE organization_id = ? AND deleted_at IS NULL").get(org.id).c);

writeFileSync(join(__dirname, '..', 'fix_results.txt'), lines.join('\n'), 'utf8');
db.close();
