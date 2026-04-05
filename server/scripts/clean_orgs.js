import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'noblehr.db'));

// Do not enforce FK constraints so we can wipe
db.pragma('foreign_keys = OFF');

const orgs = db.prepare("SELECT id, name FROM organizations").all();
console.log("Found " + orgs.length + " orgs total.");

if (orgs.length > 0) {
  const mainOrg = orgs.find(o => o.name === 'Noble HR Test Org' || o.id === 1) || orgs[0];
  const keepId = mainOrg.id;
  
  console.log("Keeping Org:", mainOrg.name, "ID:", keepId);
  
  const tablesWithOrgId = [
    'locations', 'employees', 'policies', 'acknowledgments', 
    'pending_re_acknowledgments', 'handbooks', 'onboardings', 
    'hr_records', 'incident_reports', 'amendments', 'system_events', 
    'policy_targeting_overrides', 'invites', 'compliance_checklist_items'
  ];
  
  for (const table of tablesWithOrgId) {
    try {
      const stmt = db.prepare(`DELETE FROM ${table} WHERE organization_id != ?`);
      const info = stmt.run(keepId);
      console.log(`Cleared ${info.changes} from ${table}`);
    } catch (e) {
      console.log(`Skipped ${table} - mostly empty or structurally different`);
    }
  }
  
  // Now wipe the organizations
  const info = db.prepare("DELETE FROM organizations WHERE id != ?").run(keepId);
  console.log(`Deleted ${info.changes} organizations.`);
}

db.close();
