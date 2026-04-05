/**
 * Noble HR — Comprehensive Stress Test Seed
 * Organization: Bikini Bottom Medical Center (BBMC)
 * 15 employees, 8 policies with real content, 3 locations, 
 * months of activity, HR records, incidents, acknowledgments
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'noblehr.db');
const db = new Database(dbPath);

const passwordHash = bcrypt.hashSync('WalkthroughQA2026!', 10);

// ─── Time Helpers ──────────────────────────────────────────
function iso(monthsAgo, day = 15, hour = 9) {
  const d = new Date('2026-04-05T12:00:00Z');
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(day);
  d.setHours(hour, Math.floor(Math.random() * 59), Math.floor(Math.random() * 59));
  return d.toISOString();
}
function contentHash(html) {
  return createHash('sha256').update(html).digest('hex').slice(0, 16);
}

console.log("═══════════════════════════════════════════════");
console.log("  STRESS TEST SEED: Bikini Bottom Medical Center");
console.log("═══════════════════════════════════════════════");

// ─── 1. ORGANIZATION ──────────────────────────────────────
const orgId = uuidv4();
db.prepare(`
  INSERT INTO organizations (id, name, industry, status, state, employee_count, settings, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(orgId, 'Bikini Bottom Medical Center', 'Healthcare', 'active', 'TX',
  15,
  JSON.stringify({
    roles: ['Physician', 'Nurse', 'Surgeon', 'Lab Technician', 'Receptionist', 'Janitor', 'Administrator', 'Paramedic'],
    departments: ['Emergency Room', 'Surgery', 'Laboratory', 'Admin', 'Facilities', 'Paramedic Services']
  }),
  iso(6, 1, 8) // Founded 6 months ago
);
console.log(`✅ Organization created: Bikini Bottom Medical Center (TX, Healthcare)`);

// ─── 2. LOCATIONS ─────────────────────────────────────────
const locations = [
  { name: 'Main Hospital', address: '1 Coral Ave, Bikini Bottom, TX 73001' },
  { name: 'Emergency Annex', address: '2 Kelp Highway, Bikini Bottom, TX 73001' },
  { name: 'Research Lab Wing', address: '1 Coral Ave, Suite 300, Bikini Bottom, TX 73001' },
];
const locIds = locations.map(l => {
  const id = uuidv4();
  db.prepare('INSERT INTO locations (id, organization_id, name, address, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, orgId, l.name, l.address, iso(6, 1, 9));
  return id;
});
console.log(`✅ ${locations.length} locations created`);

// ─── 3. EMPLOYEES ─────────────────────────────────────────
const employees = [
  // Admin / Leadership (2)
  { email: 'drmarlin@bbmc.local', name: 'Dr. Marlin Reef', role: 'Chief of Medicine', dept: 'Admin', perm: 'org_admin', loc: 0, hireDate: iso(6, 1), tags: '["leadership","executive"]' },
  { email: 'nursebass@bbmc.local', name: 'Nurse Barbara Bass', role: 'Head Nurse', dept: 'Emergency Room', perm: 'admin', loc: 1, hireDate: iso(6, 5), tags: '["leadership","nursing"]' },

  // Supervisors (2)
  { email: 'drfin@bbmc.local', name: 'Dr. Finn Gillworth', role: 'Surgeon', dept: 'Surgery', perm: 'supervisor', loc: 0, hireDate: iso(5, 10), tags: '["surgery","senior"]' },
  { email: 'drcoral@bbmc.local', name: 'Dr. Coral Angelfish', role: 'Lab Director', dept: 'Laboratory', perm: 'supervisor', loc: 2, hireDate: iso(5, 12), tags: '["laboratory","research"]' },

  // Standard Employees (11)
  { email: 'nemo@bbmc.local', name: 'Nemo Clownfish', role: 'Paramedic', dept: 'Paramedic Services', perm: 'employee', loc: 1, hireDate: iso(5, 1), tags: '["paramedic","field"]' },
  { email: 'dory@bbmc.local', name: 'Dory Tang', role: 'Receptionist', dept: 'Admin', perm: 'employee', loc: 0, hireDate: iso(4, 20), tags: '["admin","front-desk"]' },
  { email: 'pearl@bbmc.local', name: 'Pearl Whale', role: 'Nurse', dept: 'Emergency Room', perm: 'employee', loc: 1, hireDate: iso(4, 15), tags: '["nursing","ER"]' },
  { email: 'gill@bbmc.local', name: 'Gill Moorish', role: 'Surgeon', dept: 'Surgery', perm: 'employee', loc: 0, hireDate: iso(4, 1), tags: '["surgery"]' },
  { email: 'bloat@bbmc.local', name: 'Bloat Puffer', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 2, hireDate: iso(3, 10), tags: '["laboratory"]' },
  { email: 'peach@bbmc.local', name: 'Peach Starfish', role: 'Nurse', dept: 'Emergency Room', perm: 'employee', loc: 1, hireDate: iso(3, 1), tags: '["nursing","ER"]' },
  { email: 'bubbles@bbmc.local', name: 'Bubbles Seahorse', role: 'Paramedic', dept: 'Paramedic Services', perm: 'employee', loc: 1, hireDate: iso(2, 15), tags: '["paramedic","field"]' },
  { email: 'jacques@bbmc.local', name: 'Jacques Shrimp', role: 'Janitor', dept: 'Facilities', perm: 'employee', loc: 0, hireDate: iso(2, 1), tags: '["facilities","maintenance"]' },
  { email: 'gurgle@bbmc.local', name: 'Gurgle Gramma', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 2, hireDate: iso(1, 20), tags: '["laboratory"]' },
  { email: 'sheldon@bbmc.local', name: 'Sheldon Seahorse', role: 'Receptionist', dept: 'Admin', perm: 'employee', loc: 0, hireDate: iso(1, 5), tags: '["admin","front-desk"]' },
  // Terminated employee
  { email: 'anchor@bbmc.local', name: 'Anchor Shark', role: 'Janitor', dept: 'Facilities', perm: 'employee', loc: 0, hireDate: iso(5, 1), tags: '["facilities"]', status: 'inactive' },
  { email: 'nursebass@bbmc.local', name: 'Nurse Barbara Bass', role: 'Head Nurse', dept: 'Emergency Room', perm: 'admin', loc: 1, hireDate: iso(6, 5), tags: 'leadership,nursing' },

  // Supervisors (2)
  { email: 'drfin@bbmc.local', name: 'Dr. Finn Gillworth', role: 'Surgeon', dept: 'Surgery', perm: 'supervisor', loc: 0, hireDate: iso(5, 10), tags: 'surgery,senior' },
  { email: 'drcoral@bbmc.local', name: 'Dr. Coral Angelfish', role: 'Lab Director', dept: 'Laboratory', perm: 'supervisor', loc: 2, hireDate: iso(5, 12), tags: 'laboratory,research' },

  // Standard Employees (11)
  { email: 'nemo@bbmc.local', name: 'Nemo Clownfish', role: 'Paramedic', dept: 'Paramedic Services', perm: 'employee', loc: 1, hireDate: iso(5, 1), tags: 'paramedic,field' },
  { email: 'dory@bbmc.local', name: 'Dory Tang', role: 'Receptionist', dept: 'Admin', perm: 'employee', loc: 0, hireDate: iso(4, 20), tags: 'admin,front-desk' },
  { email: 'pearl@bbmc.local', name: 'Pearl Whale', role: 'Nurse', dept: 'Emergency Room', perm: 'employee', loc: 1, hireDate: iso(4, 15), tags: 'nursing,ER' },
  { email: 'gill@bbmc.local', name: 'Gill Moorish', role: 'Surgeon', dept: 'Surgery', perm: 'employee', loc: 0, hireDate: iso(4, 1), tags: 'surgery' },
  { email: 'bloat@bbmc.local', name: 'Bloat Puffer', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 2, hireDate: iso(3, 10), tags: 'laboratory' },
  { email: 'peach@bbmc.local', name: 'Peach Starfish', role: 'Nurse', dept: 'Emergency Room', perm: 'employee', loc: 1, hireDate: iso(3, 1), tags: 'nursing,ER' },
  { email: 'bubbles@bbmc.local', name: 'Bubbles Seahorse', role: 'Paramedic', dept: 'Paramedic Services', perm: 'employee', loc: 1, hireDate: iso(2, 15), tags: 'paramedic,field' },
  { email: 'jacques@bbmc.local', name: 'Jacques Shrimp', role: 'Janitor', dept: 'Facilities', perm: 'employee', loc: 0, hireDate: iso(2, 1), tags: 'facilities,maintenance' },
  { email: 'gurgle@bbmc.local', name: 'Gurgle Gramma', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 2, hireDate: iso(1, 20), tags: 'laboratory' },
  { email: 'sheldon@bbmc.local', name: 'Sheldon Seahorse', role: 'Receptionist', dept: 'Admin', perm: 'employee', loc: 0, hireDate: iso(1, 5), tags: 'admin,front-desk' },
  // Terminated employee
  { email: 'anchor@bbmc.local', name: 'Anchor Shark', role: 'Janitor', dept: 'Facilities', perm: 'employee', loc: 0, hireDate: iso(5, 1), tags: 'facilities', status: 'inactive' },
];

const empMap = {};
for (const e of employees) {
  const userId = uuidv4();
  const empId = uuidv4();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, auth_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, e.email, passwordHash, e.name, 'email', e.hireDate);

  db.prepare(`
    INSERT INTO employees (id, organization_id, user_email, full_name, role, department, location_id, permission_level, status, hire_date, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(empId, orgId, e.email, e.name, e.role, e.dept, locIds[e.loc], e.perm, e.status || 'active', e.hireDate, e.tags || '', e.hireDate);

  empMap[e.email] = { id: empId, name: e.name, email: e.email, role: e.role, locId: locIds[e.loc] };
}
console.log(`✅ ${employees.length} employees created (1 terminated)`);

// ─── 4. POLICIES (8 with rich HTML content) ───────────────
const policies = [
  {
    title: 'HIPAA Patient Privacy & Confidentiality',
    desc: 'Governs handling of Protected Health Information (PHI) under federal HIPAA regulations.',
    category: 'Compliance',
    content: `<h2>HIPAA Compliance Policy</h2>
<p><strong>Effective Date:</strong> October 1, 2025</p>
<h3>1. Purpose</h3>
<p>This policy establishes the standards for protecting patient Protected Health Information (PHI) in compliance with the Health Insurance Portability and Accountability Act of 1996 (HIPAA).</p>
<h3>2. Scope</h3>
<p>This policy applies to <strong>all employees, contractors, volunteers, and any individual</strong> with access to patient data or medical records at Bikini Bottom Medical Center.</p>
<h3>3. Key Requirements</h3>
<ul>
<li><strong>Minimum Necessary Rule:</strong> Access only the minimum PHI required to perform your job duties.</li>
<li><strong>Workstation Security:</strong> Lock screens when leaving workstations. Never leave patient charts unattended.</li>
<li><strong>Verbal Disclosures:</strong> Use private areas when discussing patient information. Lower your voice in shared spaces.</li>
<li><strong>Electronic PHI (ePHI):</strong> Never send patient data via personal email, text message, or unapproved apps.</li>
<li><strong>Disposal:</strong> Shred paper records. Use approved software for electronic deletion.</li>
</ul>
<h3>4. Breach Notification</h3>
<p>Any suspected or confirmed breach of PHI must be reported to the Privacy Officer within <strong>24 hours</strong>. Failure to report is a separate violation.</p>
<h3>5. Penalties</h3>
<p>Violations may result in disciplinary action up to and including termination, and may carry federal fines ranging from $100 to $50,000 per violation.</p>`,
    createdAt: iso(5, 20),
  },
  {
    title: 'Workplace Safety & Hazard Communication',
    desc: 'OSHA-compliant safety procedures for handling biological hazards, chemicals, and emergency equipment.',
    category: 'Safety',
    content: `<h2>Workplace Safety & Hazard Communication (HazCom)</h2>
<p><strong>Effective Date:</strong> November 1, 2025</p>
<h3>1. Purpose</h3>
<p>To ensure a safe working environment and compliance with OSHA Hazard Communication Standard (29 CFR 1910.1200).</p>
<h3>2. Biohazard Handling</h3>
<ul>
<li>All blood and bodily fluid spills must be cleaned using approved biohazard cleanup kits.</li>
<li>Sharps (needles, scalpels) must be disposed of in puncture-resistant containers immediately after use.</li>
<li>Personal Protective Equipment (PPE) including gloves, face shields, and gowns must be worn when handling specimens.</li>
</ul>
<h3>3. Chemical Safety</h3>
<ul>
<li>Safety Data Sheets (SDS) are maintained in the supply room and digitally on the hospital intranet.</li>
<li>Never mix cleaning chemicals. Label all secondary containers.</li>
<li>Report chemical spills to Facilities immediately at ext. 4400.</li>
</ul>
<h3>4. Fire Safety</h3>
<p>Know the location of fire exits, extinguishers, and evacuation assembly points. Fire drills are conducted quarterly.</p>
<h3>5. Reporting</h3>
<p>All injuries, near-misses, and safety concerns must be reported within <strong>4 hours</strong> using the Incident Report system.</p>`,
    createdAt: iso(5, 15),
  },
  {
    title: 'Anti-Harassment & Non-Discrimination',
    desc: 'Zero-tolerance policy for harassment, discrimination, and retaliation in the workplace.',
    category: 'HR',
    content: `<h2>Anti-Harassment & Non-Discrimination Policy</h2>
<p><strong>Effective Date:</strong> October 15, 2025</p>
<h3>1. Policy Statement</h3>
<p>Bikini Bottom Medical Center is committed to providing a work environment free from harassment, discrimination, and retaliation. This policy prohibits unlawful harassment based on race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any other characteristic protected by law.</p>
<h3>2. Definitions</h3>
<p><strong>Harassment</strong> includes unwelcome conduct that is based on a protected characteristic and creates an intimidating, hostile, or offensive working environment. This includes but is not limited to:</p>
<ul>
<li>Verbal: slurs, jokes, epithets, threats</li>
<li>Physical: unwelcome touching, blocking movement</li>
<li>Visual: offensive images, emails, social media posts</li>
<li>Sexual: unwelcome advances, requests for favors, sexually explicit content</li>
</ul>
<h3>3. Reporting Procedure</h3>
<p>Employees who experience or witness harassment should report to their supervisor, HR, or use the anonymous hotline at <strong>1-800-BBMC-SAFE</strong>.</p>
<h3>4. Investigation & Resolution</h3>
<p>All complaints will be investigated promptly, thoroughly, and impartially. Confidentiality will be maintained to the extent possible.</p>
<h3>5. Retaliation Prohibited</h3>
<p>Retaliation against any employee who reports harassment or participates in an investigation is strictly prohibited and will result in disciplinary action.</p>`,
    createdAt: iso(5, 18),
  },
  {
    title: 'Attendance & Scheduling',
    desc: 'Guidelines for shift scheduling, call-offs, tardiness, and PTO in a 24/7 medical facility.',
    category: 'Operations',
    content: `<h2>Attendance & Scheduling Policy</h2>
<p><strong>Effective Date:</strong> November 15, 2025</p>
<h3>1. Scheduling</h3>
<p>Work schedules are posted two weeks in advance. Shift swaps must be approved by your department supervisor at least 48 hours before the shift.</p>
<h3>2. Call-Off Procedure</h3>
<ul>
<li>Notify your supervisor at least <strong>2 hours before</strong> your scheduled shift.</li>
<li>Text messages and voicemails are not acceptable — you must speak directly with a supervisor or charge nurse.</li>
<li>Provide documentation (doctor's note) for absences of 3+ consecutive days.</li>
</ul>
<h3>3. Tardiness</h3>
<p>Employees are expected to be at their station, ready to work, at the start of their shift. Arriving more than 7 minutes late counts as a tardy occurrence.</p>
<table>
<tr><th>Occurrences (rolling 90 days)</th><th>Action</th></tr>
<tr><td>3</td><td>Verbal warning</td></tr>
<tr><td>5</td><td>Written warning</td></tr>
<tr><td>7</td><td>Final written warning</td></tr>
<tr><td>9+</td><td>Termination</td></tr>
</table>
<h3>4. No-Call / No-Show</h3>
<p>Failure to call off and failure to report for a shift is a <strong>no-call/no-show</strong>. Two no-call/no-shows within a 12-month period are grounds for immediate termination.</p>
<h3>5. Paid Time Off (PTO)</h3>
<p>PTO accrues based on tenure. Requests must be submitted at least 14 days in advance for planned absences. Blackout dates apply during high-census periods.</p>`,
    createdAt: iso(4, 25),
  },
  {
    title: 'Infection Control & PPE Protocol',
    desc: 'Standard and transmission-based precautions for clinical staff.',
    category: 'Clinical',
    content: `<h2>Infection Control & PPE Protocol</h2>
<p><strong>Effective Date:</strong> December 1, 2025</p>
<h3>1. Standard Precautions</h3>
<p>Standard precautions apply to <strong>all patient interactions</strong> regardless of diagnosis. This includes:</p>
<ul>
<li>Hand hygiene before and after every patient contact</li>
<li>Gloves for all contact with blood, body fluids, mucous membranes, and non-intact skin</li>
<li>Face mask and eye protection for procedures likely to generate splashes</li>
<li>Gown for procedures likely to generate splashes of blood or body fluids</li>
</ul>
<h3>2. Transmission-Based Precautions</h3>
<ul>
<li><strong>Contact:</strong> Gown + gloves; dedicated equipment</li>
<li><strong>Droplet:</strong> Surgical mask within 6 feet</li>
<li><strong>Airborne:</strong> N95 respirator; negative-pressure room</li>
</ul>
<h3>3. Hand Hygiene Compliance</h3>
<p>Target compliance rate: <strong>95%</strong>. Monthly audits are conducted. Non-compliance triggers remedial training.</p>
<h3>4. Needlestick & Exposure Protocol</h3>
<ol>
<li>Wash the wound immediately with soap and water</li>
<li>Report to your supervisor within 15 minutes</li>
<li>Proceed to Employee Health for evaluation</li>
<li>Complete an Incident Report within 4 hours</li>
</ol>`,
    createdAt: iso(4, 1),
  },
  {
    title: 'Code of Conduct & Professional Ethics',
    desc: 'Standards of professional behavior, conflict of interest, and gift policies.',
    category: 'General',
    content: `<h2>Code of Conduct & Professional Ethics</h2>
<p><strong>Effective Date:</strong> October 1, 2025</p>
<h3>1. Professional Standards</h3>
<p>All employees are expected to conduct themselves with integrity, respect, and professionalism. This includes interactions with patients, families, visitors, and colleagues.</p>
<h3>2. Dress Code</h3>
<ul>
<li><strong>Clinical Staff:</strong> Approved scrubs, closed-toe shoes, ID badge visible at all times</li>
<li><strong>Administrative Staff:</strong> Business casual; no jeans, flip-flops, or tank tops</li>
<li><strong>Facilities:</strong> Department-issued uniform with steel-toe boots</li>
</ul>
<h3>3. Social Media</h3>
<p>Employees may not post patient information, workplace photos showing identifiable patients, or content that could damage BBMC's reputation. Personal social media use is prohibited during work hours.</p>
<h3>4. Conflict of Interest</h3>
<p>Employees must disclose any financial interests, outside employment, or personal relationships that could create a conflict of interest. Gifts from vendors exceeding $25 in value must be reported to compliance.</p>
<h3>5. Substance-Free Workplace</h3>
<p>BBMC maintains a drug-free workplace. Random drug screening may be conducted. Employees under the influence of drugs or alcohol on duty are subject to immediate suspension and investigation.</p>`,
    createdAt: iso(5, 20),
  },
  {
    title: 'Emergency Preparedness & Disaster Response',
    desc: 'Protocols for natural disasters, active threats, and mass casualty events.',
    category: 'Safety',
    content: `<h2>Emergency Preparedness & Disaster Response Plan</h2>
<p><strong>Effective Date:</strong> January 1, 2026</p>
<h3>1. Code Designations</h3>
<table>
<tr><th>Code</th><th>Emergency</th><th>Action</th></tr>
<tr><td>Code Red</td><td>Fire</td><td>RACE: Rescue, Alarm, Contain, Extinguish</td></tr>
<tr><td>Code Blue</td><td>Cardiac Arrest</td><td>Activate crash cart, begin CPR, call code team</td></tr>
<tr><td>Code Silver</td><td>Active Threat</td><td>Run, Hide, Fight — lock down area, call 911</td></tr>
<tr><td>Code Yellow</td><td>Bomb Threat</td><td>Do not touch suspicious items, evacuate, call security</td></tr>
<tr><td>Code Orange</td><td>Hazmat Spill</td><td>Evacuate area, call Facilities, await HazMat team</td></tr>
<tr><td>Code Gray</td><td>Severe Weather</td><td>Move patients to interior rooms, away from windows</td></tr>
</table>
<h3>2. Mass Casualty Incident (MCI)</h3>
<p>In an MCI, the Incident Commander activates the Hospital Incident Command System (HICS). All staff report to their designated staging areas. Personal leave is suspended during an MCI declaration.</p>
<h3>3. Evacuation</h3>
<p>Primary evacuation routes are marked with green EXIT signs. Secondary routes are posted on each floor map. Patients requiring transport get priority. Ambulatory patients are directed by floor wardens.</p>
<h3>4. Annual Drills</h3>
<p>Each department must complete at least 2 emergency drills per year. Participation is mandatory and documented.</p>`,
    createdAt: iso(3, 5),
  },
  {
    title: 'Employee Technology & Data Security',
    desc: 'Acceptable use of hospital IT systems, password policies, and cybersecurity requirements.',
    category: 'IT / Security',
    content: `<h2>Employee Technology & Data Security Policy</h2>
<p><strong>Effective Date:</strong> February 1, 2026</p>
<h3>1. Access Control</h3>
<ul>
<li>Each employee receives a unique login. Sharing credentials is a terminable offense.</li>
<li>Passwords must be at least 12 characters with uppercase, lowercase, numbers, and symbols.</li>
<li>Passwords expire every 90 days. Previous 12 passwords cannot be reused.</li>
<li>Multi-factor authentication (MFA) is required for EHR (Electronic Health Record) access.</li>
</ul>
<h3>2. Acceptable Use</h3>
<p>Hospital computers, networks, and email are provided for business use. Limited personal use is permitted during breaks. The following are prohibited:</p>
<ul>
<li>Installing unauthorized software</li>
<li>Accessing inappropriate or illegal content</li>
<li>Using personal USB drives on hospital computers</li>
<li>Connecting personal devices to the clinical network</li>
</ul>
<h3>3. Email & Phishing</h3>
<p>Never click links in suspicious emails. Report phishing attempts to IT Security at <strong>security@bbmc.local</strong>. BBMC will never ask for your password via email.</p>
<h3>4. Mobile Devices</h3>
<p>Personal phones must be on silent in patient areas. Photography is strictly prohibited in clinical areas. Hospital-issued devices must have remote wipe enabled.</p>
<h3>5. Incident Reporting</h3>
<p>Report any suspected security incident (lost device, unauthorized access, malware) to IT Security within <strong>1 hour</strong>.</p>`,
    createdAt: iso(2, 5),
  },
];

const policyMap = {};
for (const p of policies) {
  const policyId = uuidv4();
  const pvId = uuidv4();

  db.prepare(`
    INSERT INTO policies (id, organization_id, title, description, status, current_version, draft_content, acknowledgment_required, handbook_category, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(policyId, orgId, p.title, p.desc, 'active', 1, p.content, 1, p.category, p.createdAt, p.createdAt);

  db.prepare(`
    INSERT INTO policy_versions (id, policy_id, version_number, content, is_locked, change_summary, effective_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pvId, policyId, 1, p.content, 1, 'Initial publication', p.createdAt, p.createdAt);

  policyMap[p.title] = { id: policyId, versionId: pvId, content: p.content, createdAt: p.createdAt };

  // System event for publishing
  db.prepare(`
    INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), orgId, 'policy.published', 'policy', policyId, 'drmarlin@bbmc.local', 'Dr. Marlin Reef',
    `Published "${p.title}" v1`, p.createdAt);
}
console.log(`✅ ${policies.length} policies created with full HTML content`);

// ─── 5. HANDBOOK ──────────────────────────────────────────
const handbookId = uuidv4();
db.prepare(`
  INSERT INTO handbooks (id, organization_id, name, description, status, policy_sections, source, created_by_email, created_by_name, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(handbookId, orgId, 'BBMC Employee Handbook 2026', 'Comprehensive employee handbook for Bikini Bottom Medical Center', 'published',
  JSON.stringify(Object.values(policyMap).map(p => p.id)),
  'manual', 'drmarlin@bbmc.local', 'Dr. Marlin Reef', iso(4, 1));
console.log(`✅ Handbook created with ${policies.length} policy sections`);

// ─── 6. ACKNOWLEDGMENTS (realistic mix) ───────────────────
// Most employees acknowledged most policies. Some are pending.
const ackResults = { created: 0, skipped: 0 };
const allEmployeeEmails = employees.filter(e => e.status !== 'inactive').map(e => e.email);

for (const [title, p] of Object.entries(policyMap)) {
  for (const email of allEmployeeEmails) {
    const emp = empMap[email];
    if (!emp) continue;

    // Skip acknowledgment randomly (15% chance) to simulate pending
    if (Math.random() < 0.15) {
      ackResults.skipped++;
      continue;
    }

    // Acknowledged 1-14 days after policy creation
    const pDate = new Date(p.createdAt);
    pDate.setDate(pDate.getDate() + 1 + Math.floor(Math.random() * 14));
    const ackDate = pDate.toISOString();

    db.prepare(`
      INSERT INTO acknowledgments (id, organization_id, policy_id, policy_version_id, policy_title, version_number, employee_id, employee_name, employee_email, employee_role_at_time, employee_location_at_time, acknowledged_at, content_hash, is_locked, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(uuidv4(), orgId, p.id, p.versionId, title, 1, emp.id, emp.name, emp.email, emp.role, emp.locId, ackDate,
      contentHash(p.content), '10.0.0.' + Math.floor(Math.random() * 254 + 1),
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NobleHR/1.0', ackDate);
    ackResults.created++;
  }
}
console.log(`✅ ${ackResults.created} acknowledgments created (${ackResults.skipped} pending)`);

// ─── 7. HR RECORDS (write-ups & commendations) ───────────
const hrRecords = [
  { empEmail: 'dory@bbmc.local', type: 'write_up', title: 'Repeated Tardiness', desc: 'Dory has been late to her shift 4 times in the past 30 days. She reports difficulty remembering her schedule. Verbal warning issued.', severity: 'Low', level: 1, when: iso(3, 20) },
  { empEmail: 'bloat@bbmc.local', type: 'write_up', title: 'Lab Sample Mislabeled', desc: 'Patient blood sample was mislabeled, requiring a redraw and delaying diagnostic results by 6 hours. Written warning issued per Lab Protocol 7.2.', severity: 'High', level: 2, when: iso(2, 10) },
  { empEmail: 'nemo@bbmc.local', type: 'commendation', title: 'Outstanding Patient Rescue', desc: 'Nemo demonstrated exceptional composure and skill during a multi-vehicle accident response on February 8. He triaged 4 patients and maintained communication with dispatch flawlessly. Recommended for Employee of the Quarter.', severity: 'Low', level: 0, when: iso(2, 12) },
  { empEmail: 'pearl@bbmc.local', type: 'write_up', title: 'HIPAA Near-Miss', desc: 'Pearl left a patient chart open on an unattended workstation in the ER waiting area. No breach occurred, but this constitutes a policy violation. Verbal counseling provided.', severity: 'Medium', level: 1, when: iso(1, 25) },
  { empEmail: 'jacques@bbmc.local', type: 'commendation', title: 'Facility Inspection Excellence', desc: 'Jacques received a perfect score on the quarterly facility cleanliness inspection. His attention to the surgical prep rooms was specifically noted by the state inspector.', severity: 'Low', level: 0, when: iso(1, 15) },
  { empEmail: 'anchor@bbmc.local', type: 'write_up', title: 'No-Call No-Show — Final Warning', desc: 'This is Anchor\'s second no-call/no-show in 90 days. Per the Attendance Policy, this constitutes grounds for termination. Employee has been notified.', severity: 'Critical', level: 3, when: iso(1, 5) },
  { empEmail: 'dory@bbmc.local', type: 'write_up', title: 'Scheduling Confusion — 2nd Occurrence', desc: 'Dory reported to the wrong department for her shift, citing confusion about the new schedule rotation. Written warning issued; supervisor meeting scheduled.', severity: 'Medium', level: 2, when: iso(0, 28) },
];

for (const hr of hrRecords) {
  const emp = empMap[hr.empEmail];
  if (!emp) continue;
  db.prepare(`
    INSERT INTO hr_records (id, organization_id, employee_id, record_type, title, description, status, severity, discipline_level, created_by_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), orgId, emp.id, hr.type, hr.title, hr.desc, 'submitted', hr.severity, hr.level, 'drmarlin@bbmc.local', hr.when, hr.when);
}
console.log(`✅ ${hrRecords.length} HR records created (write-ups + commendations)`);

// ─── 8. INCIDENT REPORTS ──────────────────────────────────
const incidents = [
  { empEmail: 'gill@bbmc.local', title: 'Needlestick Injury During Surgery', desc: 'During a laparoscopic procedure, Dr. Gill sustained a needlestick to the left index finger from a contaminated suture needle. Wound was washed immediately. Employee Health notified within 10 minutes. Blood draw for baseline labs completed.', type: 'Injury', severity: 'High', date: iso(3, 5, 14), status: 'under_review' },
  { empEmail: 'peach@bbmc.local', title: 'Patient Fall in ER Bay 3', desc: 'Elderly patient attempted to stand from stretcher without assistance and fell to the floor. No visible injuries; patient stated they felt dizzy. Code team assessed patient; CT scan ordered. Fall prevention protocol re-emphasized.', type: 'Patient Safety', severity: 'Medium', date: iso(2, 20, 22), status: 'resolved' },
  { empEmail: 'bloat@bbmc.local', title: 'Chemical Spill in Lab B', desc: 'Approximately 200ml of formalin was spilled during specimen transfer. Area was evacuated per HazCom protocol. Facilities team responded within 8 minutes. No employee exposure confirmed. SDS reviewed.', type: 'Environmental', severity: 'High', date: iso(1, 10, 11), status: 'under_review' },
  { empEmail: 'bubbles@bbmc.local', title: 'Ambulance Near-Miss Traffic Incident', desc: 'While responding Code 3 to a cardiac call, Ambulance 2 was nearly struck by a civilian vehicle running a red light at the intersection of Coral Ave and Kelp Blvd. No contact made. Dashcam footage preserved. Driver information obtained from witnesses.', type: 'Vehicle', severity: 'High', date: iso(0, 15, 8), status: 'submitted' },
  { empEmail: 'nemo@bbmc.local', title: 'Verbal Altercation with Patient Family', desc: 'Patient\'s family member became verbally aggressive toward Nemo during a transport, using threatening language about response time. Security was called even though Nemo de-escalated appropriately. No physical contact occurred. Witness: Bubbles Seahorse.', type: 'Workplace Violence', severity: 'Medium', date: iso(0, 5, 16), status: 'submitted' },
];

for (const inc of incidents) {
  const emp = empMap[inc.empEmail];
  if (!emp) continue;
  db.prepare(`
    INSERT INTO incident_reports (id, organization_id, employee_id, title, description, status, incident_type, severity, incident_date, location_id, witnesses, created_by_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), orgId, emp.id, inc.title, inc.desc, inc.status, inc.type, inc.severity, inc.date, emp.locId,
    inc.type === 'Workplace Violence' ? 'Bubbles Seahorse' : null,
    emp.email, inc.date, inc.date);
}
console.log(`✅ ${incidents.length} incident reports created`);

// ─── 9. SYSTEM EVENTS (rich history) ─────────────────────
const sysEvents = [
  { type: 'org.created', summary: 'Bikini Bottom Medical Center registered and approved', when: iso(6, 1, 8) },
  { type: 'employee.hired', summary: 'Dr. Marlin Reef joined as Chief of Medicine', when: iso(6, 1, 9) },
  { type: 'employee.hired', summary: 'Nurse Barbara Bass joined as Head Nurse', when: iso(6, 5, 9) },
  { type: 'employee.hired', summary: 'Dr. Finn Gillworth joined as Surgeon', when: iso(5, 10, 9) },
  { type: 'employee.hired', summary: 'Dr. Coral Angelfish joined as Lab Director', when: iso(5, 12, 9) },
  { type: 'employee.hired', summary: 'Nemo Clownfish joined as Paramedic', when: iso(5, 1, 9) },
  { type: 'employee.hired', summary: 'Anchor Shark joined as Janitor', when: iso(5, 1, 10) },
  { type: 'employee.hired', summary: 'Dory Tang joined as Receptionist', when: iso(4, 20, 9) },
  { type: 'employee.hired', summary: 'Pearl Whale joined as Nurse', when: iso(4, 15, 9) },
  { type: 'employee.hired', summary: 'Gill Moorish joined as Surgeon', when: iso(4, 1, 9) },
  { type: 'employee.hired', summary: 'Bloat Puffer joined as Lab Technician', when: iso(3, 10, 9) },
  { type: 'employee.hired', summary: 'Peach Starfish joined as Nurse', when: iso(3, 1, 9) },
  { type: 'incident.created', summary: 'Incident: Needlestick Injury During Surgery (Dr. Gill)', when: iso(3, 5, 14) },
  { type: 'employee.hired', summary: 'Bubbles Seahorse joined as Paramedic', when: iso(2, 15, 9) },
  { type: 'hr.write_up', summary: 'Write-up issued to Dory Tang — Repeated Tardiness', when: iso(3, 20) },
  { type: 'hr.write_up', summary: 'Write-up issued to Bloat Puffer — Lab Sample Mislabeled', when: iso(2, 10) },
  { type: 'hr.commendation', summary: 'Commendation awarded to Nemo Clownfish — Outstanding Patient Rescue', when: iso(2, 12) },
  { type: 'incident.created', summary: 'Incident: Patient Fall in ER Bay 3 (Peach Starfish)', when: iso(2, 20, 22) },
  { type: 'incident.resolved', summary: 'Incident resolved: Patient Fall in ER Bay 3', when: iso(2, 22, 10) },
  { type: 'employee.hired', summary: 'Jacques Shrimp joined as Janitor', when: iso(2, 1, 9) },
  { type: 'hr.commendation', summary: 'Commendation awarded to Jacques Shrimp — Facility Inspection Excellence', when: iso(1, 15) },
  { type: 'employee.hired', summary: 'Gurgle Gramma joined as Lab Technician', when: iso(1, 20, 9) },
  { type: 'hr.write_up', summary: 'HIPAA Near-Miss — verbal counseling for Pearl Whale', when: iso(1, 25) },
  { type: 'incident.created', summary: 'Incident: Chemical Spill in Lab B (Bloat Puffer)', when: iso(1, 10, 11) },
  { type: 'hr.write_up', summary: 'Final Warning issued to Anchor Shark — No-Call No-Show', when: iso(1, 5) },
  { type: 'employee.terminated', summary: 'Terminated Anchor Shark (Janitor). File preserved; re-hire eligible after 6 months.', when: iso(0, 25) },
  { type: 'employee.hired', summary: 'Sheldon Seahorse joined as Receptionist', when: iso(1, 5, 9) },
  { type: 'hr.write_up', summary: 'Write-up issued to Dory Tang — Scheduling Confusion (2nd occurrence)', when: iso(0, 28) },
  { type: 'incident.created', summary: 'Incident: Ambulance Near-Miss Traffic Incident (Bubbles Seahorse)', when: iso(0, 15, 8) },
  { type: 'incident.created', summary: 'Incident: Verbal Altercation with Patient Family (Nemo Clownfish)', when: iso(0, 5, 16) },
];

for (const ev of sysEvents) {
  db.prepare(`
    INSERT INTO system_events (id, organization_id, event_type, actor_email, actor_name, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), orgId, ev.type, 'drmarlin@bbmc.local', 'Dr. Marlin Reef', ev.summary, ev.when);
}
console.log(`✅ ${sysEvents.length} system events created spanning 6 months`);

// ─── 10. ONBOARDING RECORDS ──────────────────────────────
// Create onboarding for the 3 newest employees
const newestHires = ['gurgle@bbmc.local', 'sheldon@bbmc.local', 'bubbles@bbmc.local'];
const policyIds = Object.values(policyMap).map(p => p.id);

for (const email of newestHires) {
  const emp = empMap[email];
  if (!emp) continue;
  const completedIds = policyIds.slice(0, Math.floor(Math.random() * policyIds.length));
  
  db.prepare(`
    INSERT INTO onboardings (id, organization_id, employee_id, employee_name, employee_email, assigned_policy_ids, completed_policy_ids, due_date, start_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), orgId, emp.id, emp.name, emp.email,
    JSON.stringify(policyIds), JSON.stringify(completedIds),
    iso(-1, 1), iso(1, 5),
    completedIds.length === policyIds.length ? 'completed' : 'in_progress',
    iso(1, 5));
}
console.log(`✅ ${newestHires.length} onboarding records created`);

// ─── DONE ─────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("  STRESS TEST SEED COMPLETE");
console.log("═══════════════════════════════════════════════");
console.log(`\n  Organization: Bikini Bottom Medical Center`);
console.log(`  State: TX | Industry: Healthcare`);
console.log(`  Employees: ${employees.length} (1 terminated)`);
console.log(`  Policies: ${policies.length} with full HTML content`);
console.log(`  Locations: ${locations.length}`);
console.log(`  Acknowledgments: ${ackResults.created} (${ackResults.skipped} pending)`);
console.log(`  HR Records: ${hrRecords.length}`);
console.log(`  Incidents: ${incidents.length}`);
console.log(`  System Events: ${sysEvents.length + policies.length} (including policy publishes)`);
console.log(`  Onboarding Records: ${newestHires.length}`);
console.log(`\n  Admin:    drmarlin@bbmc.local / WalkthroughQA2026!`);
console.log(`  Nurse:    nursebass@bbmc.local / WalkthroughQA2026!`);
console.log(`  Employee: nemo@bbmc.local / WalkthroughQA2026!`);
console.log(`  Employee: dory@bbmc.local / WalkthroughQA2026!`);
console.log("");

db.close();
