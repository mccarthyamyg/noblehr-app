const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

const files = [
  'server/server.js',
  'server/scripts/seed-test-env.js',
  'server/scripts/seed-super-admin.js',
  'server/scripts/init-db.js',
  'server/scripts/backup-db.js',
  'server/routes/api.js',
  'server/package.json',
  'server/package-lock.json',
  'server/drizzle.config.js',
  'server/lib/db.js',
  'server/lib/email.js',
  'server/lib/auth.js',
  'server/lib/audit.js',
  'Handbook Policy App/package.json',
  'Handbook Policy App/package-lock.json',
  'Handbook Policy App/src/api/client.js',
  'Handbook Policy App/src/pages/ResetPassword.jsx'
];

const replacements = [
  { from: /PolicyVault Test Org/g, to: 'Noble HR Test Org' },
  { from: /PolicyVault server running/g, to: 'Noble HR server running' },
  { from: /PolicyVault HR Governance/g, to: 'Noble HR Governance' },
  { from: /PolicyVault Database Schema/g, to: 'Noble HR Database Schema' },
  { from: /PolicyVault( —| backend)/g, to: 'Noble HR$1' },
  { from: /PolicyVault/g, to: 'Noble HR' },
  { from: /policyvault\.db/g, to: 'noblehr.db' },
  { from: /policyvault\.local/g, to: 'noblehr.local' },
  { from: /policyvault\.test/g, to: 'noblehr.test' },
  { from: /policyvault\.app/g, to: 'noblehr.app' },
  { from: /policyvault_mobile/g, to: 'noblehr_mobile' },
  { from: /policyvault_web/g, to: 'noblehr_web' },
  { from: /policyvault_reset_token/g, to: 'noblehr_reset_token' },
  { from: /policyvault-dev-secret/g, to: 'noblehr-dev-secret' },
  { from: /policyvault-/g, to: 'noblehr-' },
  { from: /\"name\": \"policyvault-server\"/g, to: '"name": "noblehr-server"' },
  { from: /\"name\": \"policyvault\"/g, to: '"name": "noblehr"' },
  { from: /localhost:5432\/policyvault/g, to: 'localhost:5432/noblehr' },
];

let changedCount = 0;

files.forEach(f => {
  const p = path.join(projectRoot, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    let original = content;
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    if (content !== original) {
      fs.writeFileSync(p, content);
      console.log(`Updated ${f}`);
      changedCount++;
    }
  } else {
    console.log(`File not found: ${f}`);
  }
});

console.log(`${changedCount} files updated with text replacements.`);

// SQLite Data Updates
try {
  const Database = require(path.join(projectRoot, 'server/node_modules/better-sqlite3'));
  const oldDbPath = path.join(projectRoot, 'server/data/policyvault.db');
  const newDbPath = path.join(projectRoot, 'server/data/noblehr.db');

  if (fs.existsSync(oldDbPath)) {
    // Copy the database
    if (!fs.existsSync(newDbPath)) {
      fs.copyFileSync(oldDbPath, newDbPath);
      console.log('Database file copied to noblehr.db');
    }

    const db = new Database(newDbPath);
    
    const info1 = db.prepare("UPDATE organizations SET name = 'Noble HR Test Org' WHERE name LIKE '%PolicyVault%'").run();
    console.log(`Organizations updated: ${info1.changes}`);

    let userUpdates = 0;
    const users = db.prepare("SELECT id, email FROM users").all();
    for (const u of users) {
      if (u.email && u.email.includes('policyvault')) {
        const newEmail = u.email.replace('policyvault', 'noblehr');
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newEmail, u.id);
        userUpdates++;
      }
    }
    console.log(`Users updated: ${userUpdates}`);

    let empUpdates = 0;
    const employees = db.prepare("SELECT id, user_email FROM employees").all();
    for (const e of employees) {
      if (e.user_email && e.user_email.includes('policyvault')) {
        const newEmail = e.user_email.replace('policyvault', 'noblehr');
        db.prepare("UPDATE employees SET user_email = ? WHERE id = ?").run(newEmail, e.id);
        empUpdates++;
      }
    }
    console.log(`Employees updated: ${empUpdates}`);

    db.close();
    console.log('Database contents updated to Noble HR successfully.');
  }
} catch (err) {
  console.error("Error updating DB:", err);
}
