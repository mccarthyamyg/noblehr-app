import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

const saltyOrg = db.prepare("SELECT * FROM organizations WHERE name = 'The Salty Spitoon'").get();
const policy = db.prepare("SELECT * FROM policies WHERE organization_id = ? AND deleted_at IS NULL").get(saltyOrg.id);

if (!policy) { console.log('No policy found!'); process.exit(1); }

// Set a proper draft content if it's short
const draftContent = policy.draft_content && policy.draft_content.length > 50 
  ? policy.draft_content 
  : `# No Weenies Allowed

## Purpose
This policy establishes the standards of toughness required for all employees of The Salty Spitoon. Only individuals who demonstrate sufficient toughness and resilience are permitted to work at this establishment.

## Scope
This policy applies to all employees, contractors, and volunteers of The Salty Spitoon, regardless of position or seniority.

## Policy Statement
1. **Toughness Requirement**: All employees must be able to eat a bowl of nails for breakfast — without any milk.
2. **No Crying**: Crying on the premises is strictly prohibited during business hours.
3. **Muscle Flexing**: Employees are encouraged to flex at least once per shift to maintain team morale.
4. **Weenie Detection**: Any employee caught being a weenie will be subject to immediate coaching.
5. **Tough Guy Log**: All acts of toughness must be recorded in the daily Tough Guy Log for compliance purposes.

## Consequences
Violations of this policy may result in progressive discipline up to and including reassignment to Weenie Hut Jr's.

## Acknowledgment
All employees must acknowledge receipt and understanding of this policy within 7 days of hire or policy update.`;

// Update draft content first
db.prepare("UPDATE policies SET draft_content = ?, acknowledgment_required = 1, applies_to = ? WHERE id = ?").run(
  draftContent, JSON.stringify({ all_employees: true }), policy.id
);

// Publish: create version 1
const versionId = uuidv4();
const newVersion = 1;
const now = new Date().toISOString();

db.prepare("INSERT INTO policy_versions (id, policy_id, version_number, content, is_locked, effective_date) VALUES (?, ?, ?, ?, 1, ?)").run(
  versionId, policy.id, newVersion, draftContent, now.split('T')[0]
);

db.prepare("UPDATE policies SET status = 'active', current_version = ?, updated_at = ? WHERE id = ?").run(newVersion, now, policy.id);

// Log the publish event
db.prepare(`INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  uuidv4(), saltyOrg.id, 'policy.published', 'Policy', policy.id,
  'reggie@saltyspitoon.local', 'Reggie The Bouncer',
  `Published "No Weenies Allowed" v1`, now
);

console.log(`Published policy "${policy.title}" as v${newVersion}`);
console.log(`Policy ID: ${policy.id}`);
console.log(`Version ID: ${versionId}`);
console.log(`Content length: ${draftContent.length} chars`);

// Verify
const updated = db.prepare("SELECT id, title, status, current_version FROM policies WHERE id = ?").get(policy.id);
console.log(`\nVerification: "${updated.title}" status=${updated.status} version=${updated.current_version}`);

db.close();
