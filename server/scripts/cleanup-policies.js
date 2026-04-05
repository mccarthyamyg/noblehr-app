import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const saltyOrg = db.prepare("SELECT id FROM organizations WHERE name = 'The Salty Spitoon'").get();
const policies = db.prepare("SELECT id, title, status, created_at FROM policies WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at ASC").all(saltyOrg.id);

console.log('Found', policies.length, 'policies:');
policies.forEach(p => console.log(`  ${p.id} "${p.title}" status=${p.status} created=${p.created_at}`));

// Delete duplicate — keep the first one
if (policies.length > 1) {
  const now = new Date().toISOString();
  for (let i = 1; i < policies.length; i++) {
    db.prepare("UPDATE policies SET deleted_at = ? WHERE id = ?").run(now, policies[i].id);
    console.log(`Soft-deleted duplicate: ${policies[i].id}`);
  }
}

// Verify the remaining policy
const remaining = db.prepare("SELECT id, title, status, draft_content FROM policies WHERE organization_id = ? AND deleted_at IS NULL").all(saltyOrg.id);
console.log('\nRemaining policies:', remaining.length);
remaining.forEach(p => {
  console.log(`  ${p.id} "${p.title}" status=${p.status}`);
  console.log(`  Content length: ${(p.draft_content || '').length} chars`);
  console.log(`  Content preview: ${(p.draft_content || '').slice(0, 100)}`);
});

db.close();
