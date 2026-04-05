/**
 * Noble HR — LEVEL 2 STRESS TEST SEED
 * Organization: Metro General Hospital & Research Institute (MGHR)
 * 35 employees, 15 policies, 5 locations, 18 months of history
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
const passwordHash = bcrypt.hashSync('StressTest2026!', 10);

function iso(monthsAgo, day = 15, hour = 9) {
  const d = new Date('2026-04-05T12:00:00Z');
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(Math.min(day, 28));
  d.setHours(hour, Math.floor(Math.random() * 59), Math.floor(Math.random() * 59));
  return d.toISOString();
}
function contentHash(html) {
  return createHash('sha256').update(html).digest('hex').slice(0, 16);
}

console.log("═══════════════════════════════════════════════════════");
console.log("  LEVEL 2 STRESS TEST: Metro General Hospital & Research");
console.log("═══════════════════════════════════════════════════════");

// ─── 1. ORGANIZATION ──────────────────────────────────────
const orgId = uuidv4();
db.prepare(`INSERT INTO organizations (id, name, industry, status, state, employee_count, settings, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(orgId, 'Metro General Hospital & Research Institute', 'Healthcare', 'active', 'CA', 35,
  JSON.stringify({
    roles: ['Physician','Surgeon','Nurse','Nurse Practitioner','Physician Assistant','Lab Technician','Radiologist','Pharmacist','Physical Therapist','Respiratory Therapist','Social Worker','Receptionist','Medical Records Clerk','IT Administrator','Security Officer','Janitor','Dietary Aide','Transport Tech','Administrator','CFO'],
    departments: ['Emergency Medicine','Surgery','Internal Medicine','Cardiology','Oncology','Pediatrics','Laboratory','Radiology','Pharmacy','Physical Therapy','Respiratory','Administration','IT','Facilities','Security','Dietary']
  }), iso(18, 1, 8));
console.log(`✅ Organization created`);

// ─── 2. LOCATIONS ─────────────────────────────────────────
const locations = [
  { name: 'Main Campus Tower A', address: '1200 Sunset Blvd, Los Angeles, CA 90026' },
  { name: 'Main Campus Tower B', address: '1200 Sunset Blvd, Tower B, Los Angeles, CA 90026' },
  { name: 'Emergency Department', address: '1201 Sunset Blvd, Los Angeles, CA 90026' },
  { name: 'Research Pavilion', address: '1205 Sunset Blvd, Los Angeles, CA 90026' },
  { name: 'Outpatient Clinic', address: '800 Vermont Ave, Los Angeles, CA 90029' },
];
const locIds = locations.map(l => {
  const id = uuidv4();
  db.prepare('INSERT INTO locations (id, organization_id, name, address, created_at) VALUES (?, ?, ?, ?, ?)').run(id, orgId, l.name, l.address, iso(18, 1, 9));
  return id;
});
console.log(`✅ ${locations.length} locations`);

// ─── 3. EMPLOYEES (35) ───────────────────────────────────
const employees = [
  // Leadership (3)
  { email: 'director@mghr.local', name: 'Dr. Victoria Sterling', role: 'Medical Director', dept: 'Administration', perm: 'org_admin', loc: 0, hire: iso(18, 1), tags: '["leadership","executive","c-suite"]' },
  { email: 'cfo@mghr.local', name: 'Marcus Chen', role: 'CFO', dept: 'Administration', perm: 'admin', loc: 0, hire: iso(18, 3), tags: '["leadership","finance","executive"]' },
  { email: 'cno@mghr.local', name: 'Dr. Angela Reeves', role: 'Chief Nursing Officer', dept: 'Administration', perm: 'admin', loc: 0, hire: iso(17, 10), tags: '["leadership","nursing","executive"]' },

  // Department Heads / Supervisors (7)
  { email: 'er.chief@mghr.local', name: 'Dr. James Hawthorne', role: 'ER Chief', dept: 'Emergency Medicine', perm: 'supervisor', loc: 2, hire: iso(17, 5), tags: '["emergency","senior","physician"]' },
  { email: 'surg.chief@mghr.local', name: 'Dr. Priya Patel', role: 'Chief of Surgery', dept: 'Surgery', perm: 'supervisor', loc: 1, hire: iso(16, 15), tags: '["surgery","senior","physician"]' },
  { email: 'cardio.chief@mghr.local', name: 'Dr. Robert Kim', role: 'Cardiology Director', dept: 'Cardiology', perm: 'supervisor', loc: 0, hire: iso(16, 1), tags: '["cardiology","senior","physician"]' },
  { email: 'lab.dir@mghr.local', name: 'Dr. Yuki Tanaka', role: 'Lab Director', dept: 'Laboratory', perm: 'supervisor', loc: 3, hire: iso(15, 20), tags: '["laboratory","research","senior"]' },
  { email: 'pharm.dir@mghr.local', name: 'Dr. Sarah Mitchell', role: 'Pharmacy Director', dept: 'Pharmacy', perm: 'supervisor', loc: 0, hire: iso(15, 10), tags: '["pharmacy","senior"]' },
  { email: 'it.mgr@mghr.local', name: 'David Park', role: 'IT Manager', dept: 'IT', perm: 'supervisor', loc: 0, hire: iso(14, 5), tags: '["it","security","infrastructure"]' },
  { email: 'facilities@mghr.local', name: 'Carlos Mendoza', role: 'Facilities Manager', dept: 'Facilities', perm: 'supervisor', loc: 0, hire: iso(14, 1), tags: '["facilities","maintenance","senior"]' },

  // Physicians (5)
  { email: 'dr.wong@mghr.local', name: 'Dr. Lisa Wong', role: 'Internist', dept: 'Internal Medicine', perm: 'employee', loc: 0, hire: iso(13, 15), tags: '["physician","internal-medicine"]' },
  { email: 'dr.garcia@mghr.local', name: 'Dr. Elena Garcia', role: 'Oncologist', dept: 'Oncology', perm: 'employee', loc: 3, hire: iso(12, 10), tags: '["physician","oncology","research"]' },
  { email: 'dr.okafor@mghr.local', name: 'Dr. Chidi Okafor', role: 'Pediatrician', dept: 'Pediatrics', perm: 'employee', loc: 4, hire: iso(11, 5), tags: '["physician","pediatrics"]' },
  { email: 'dr.singh@mghr.local', name: 'Dr. Arjun Singh', role: 'Surgeon', dept: 'Surgery', perm: 'employee', loc: 1, hire: iso(10, 20), tags: '["physician","surgery"]' },
  { email: 'dr.foster@mghr.local', name: 'Dr. Rachel Foster', role: 'ER Physician', dept: 'Emergency Medicine', perm: 'employee', loc: 2, hire: iso(9, 15), tags: '["physician","emergency"]' },

  // Nurses (6)
  { email: 'rn.johnson@mghr.local', name: 'Maria Johnson', role: 'RN - Emergency', dept: 'Emergency Medicine', perm: 'employee', loc: 2, hire: iso(13, 1), tags: '["nursing","ER"]' },
  { email: 'rn.taylor@mghr.local', name: 'Brandon Taylor', role: 'RN - Surgery', dept: 'Surgery', perm: 'employee', loc: 1, hire: iso(12, 5), tags: '["nursing","surgery","OR"]' },
  { email: 'np.williams@mghr.local', name: 'Jennifer Williams', role: 'Nurse Practitioner', dept: 'Internal Medicine', perm: 'employee', loc: 4, hire: iso(11, 1), tags: '["nursing","NP","primary-care"]' },
  { email: 'rn.davis@mghr.local', name: 'Keisha Davis', role: 'RN - Cardiology', dept: 'Cardiology', perm: 'employee', loc: 0, hire: iso(8, 10), tags: '["nursing","cardiology","telemetry"]' },
  { email: 'rn.lee@mghr.local', name: 'Amanda Lee', role: 'RN - Pediatrics', dept: 'Pediatrics', perm: 'employee', loc: 4, hire: iso(7, 1), tags: '["nursing","pediatrics"]' },
  { email: 'rn.thompson@mghr.local', name: 'Derek Thompson', role: 'RN - Oncology', dept: 'Oncology', perm: 'employee', loc: 3, hire: iso(5, 15), tags: '["nursing","oncology"]' },

  // Allied Health (5)
  { email: 'pt.martinez@mghr.local', name: 'Sofia Martinez', role: 'Physical Therapist', dept: 'Physical Therapy', perm: 'employee', loc: 4, hire: iso(10, 1), tags: '["therapy","rehabilitation"]' },
  { email: 'rt.brown@mghr.local', name: 'Kevin Brown', role: 'Respiratory Therapist', dept: 'Respiratory', perm: 'employee', loc: 0, hire: iso(9, 5), tags: '["respiratory","critical-care"]' },
  { email: 'lab.tech1@mghr.local', name: 'Hannah Fischer', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 3, hire: iso(8, 1), tags: '["laboratory","pathology"]' },
  { email: 'rad.tech@mghr.local', name: 'Tyler Robinson', role: 'Radiologic Technologist', dept: 'Radiology', perm: 'employee', loc: 1, hire: iso(6, 20), tags: '["radiology","imaging"]' },
  { email: 'pharm.tech@mghr.local', name: 'Aisha Patel', role: 'Pharmacy Technician', dept: 'Pharmacy', perm: 'employee', loc: 0, hire: iso(4, 10), tags: '["pharmacy"]' },

  // Support Staff (6)
  { email: 'reception1@mghr.local', name: 'Emily Rodriguez', role: 'Receptionist', dept: 'Administration', perm: 'employee', loc: 0, hire: iso(12, 1), tags: '["admin","front-desk"]' },
  { email: 'records@mghr.local', name: 'Thomas Wright', role: 'Medical Records Clerk', dept: 'Administration', perm: 'employee', loc: 0, hire: iso(10, 15), tags: '["admin","records","HIM"]' },
  { email: 'social@mghr.local', name: 'Diane Foster', role: 'Social Worker', dept: 'Administration', perm: 'employee', loc: 4, hire: iso(9, 1), tags: '["social-work","case-management"]' },
  { email: 'security1@mghr.local', name: 'Michael Brooks', role: 'Security Officer', dept: 'Security', perm: 'employee', loc: 2, hire: iso(7, 15), tags: '["security"]' },
  { email: 'dietary@mghr.local', name: 'Rosa Gutierrez', role: 'Dietary Aide', dept: 'Dietary', perm: 'employee', loc: 0, hire: iso(3, 1), tags: '["dietary","nutrition"]' },
  { email: 'transport@mghr.local', name: 'Jason Clarke', role: 'Transport Tech', dept: 'Facilities', perm: 'employee', loc: 0, hire: iso(2, 10), tags: '["transport","logistics"]' },

  // Terminated / Inactive (3)
  { email: 'term.nurse@mghr.local', name: 'Vanessa Cole', role: 'RN - Emergency', dept: 'Emergency Medicine', perm: 'employee', loc: 2, hire: iso(14, 1), tags: '["nursing","ER"]', status: 'inactive' },
  { email: 'term.tech@mghr.local', name: 'Ryan Moss', role: 'Lab Technician', dept: 'Laboratory', perm: 'employee', loc: 3, hire: iso(12, 1), tags: '["laboratory"]', status: 'inactive' },
  { email: 'term.guard@mghr.local', name: 'Frank Russo', role: 'Security Officer', dept: 'Security', perm: 'employee', loc: 2, hire: iso(10, 1), tags: '["security"]', status: 'inactive' },
];

// Fix email_verified_at for all users
const empMap = {};
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, full_name, auth_provider, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
const insertEmp = db.prepare(`INSERT INTO employees (id, organization_id, user_email, full_name, role, department, location_id, permission_level, status, hire_date, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertTx = db.transaction(() => {
  for (const e of employees) {
    const userId = uuidv4();
    const empId = uuidv4();
    insertUser.run(userId, e.email, passwordHash, e.name, 'email', e.hire);
    insertEmp.run(empId, orgId, e.email, e.name, e.role, e.dept, locIds[e.loc], e.perm, e.status || 'active', e.hire, e.tags, e.hire);
    empMap[e.email] = { id: empId, name: e.name, email: e.email, role: e.role, locId: locIds[e.loc] };
  }
});
insertTx();

// Set email_verified_at so logins work
try {
  db.prepare(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`).run();
} catch (_) { /* column may already exist */ }
for (const e of employees) {
  db.prepare(`UPDATE users SET email_verified_at = ? WHERE email = ? AND email_verified_at IS NULL`).run(e.hire, e.email);
}
console.log(`✅ ${employees.length} employees (3 terminated)`);

// ─── 4. POLICIES (15) ─────────────────────────────────────
const policies = [
  { title: 'HIPAA Privacy & Security', desc: 'Federal HIPAA compliance for PHI handling, ePHI security, and breach notification procedures.', cat: 'Compliance',
    content: `<h2>HIPAA Privacy & Security Policy</h2><p><strong>Effective:</strong> Oct 1, 2024</p><h3>1. Purpose</h3><p>To protect Protected Health Information (PHI) per the Health Insurance Portability and Accountability Act.</p><h3>2. Minimum Necessary</h3><p>Access only the minimum PHI required. Lock workstations when unattended. Never leave charts visible.</p><h3>3. ePHI Security</h3><ul><li>Never send PHI via personal email or text</li><li>Use encrypted hospital email for all patient communications</li><li>Report suspected breaches within 24 hours to the Privacy Officer</li></ul><h3>4. Penalties</h3><p>Violations: disciplinary action up to termination. Federal fines: $100–$50,000 per violation.</p>`, when: iso(17, 20) },
  { title: 'Workplace Safety & OSHA Compliance', desc: 'OSHA standards for hazard communication, PPE, bloodborne pathogens, and workplace ergonomics.', cat: 'Safety',
    content: `<h2>Workplace Safety & OSHA Compliance</h2><p><strong>Effective:</strong> Oct 15, 2024</p><h3>1. Hazard Communication</h3><p>All staff must know SDS locations. Label secondary containers. Report spills to Facilities (ext 4400).</p><h3>2. Bloodborne Pathogens</h3><ul><li>Universal precautions for all blood/body fluid contact</li><li>Sharps in puncture-resistant containers immediately</li><li>Needlestick: wash, report, Employee Health within 15 min</li></ul><h3>3. Ergonomics</h3><p>Use proper lifting techniques. Request ergonomic assessments for workstations causing discomfort.</p><h3>4. Reporting</h3><p>All injuries and near-misses reported within 4 hours via Incident Report system.</p>`, when: iso(17, 15) },
  { title: 'Anti-Harassment & Non-Discrimination', desc: 'Zero-tolerance policy for harassment, discrimination, and retaliation based on any protected characteristic.', cat: 'HR',
    content: `<h2>Anti-Harassment & Non-Discrimination</h2><p><strong>Effective:</strong> Oct 1, 2024</p><h3>1. Policy</h3><p>MGHR prohibits harassment based on race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any protected characteristic.</p><h3>2. Types</h3><ul><li>Verbal: slurs, jokes, threats</li><li>Physical: unwelcome touching, blocking</li><li>Visual: offensive images, emails</li><li>Sexual: unwelcome advances, quid pro quo</li></ul><h3>3. Reporting</h3><p>Report to supervisor, HR, or anonymous hotline 1-800-MGHR-SAFE. All complaints investigated within 5 business days.</p><h3>4. Retaliation</h3><p>Retaliation is strictly prohibited and is a separate terminable offense.</p>`, when: iso(17, 18) },
  { title: 'Attendance & Scheduling', desc: 'Shift scheduling, call-off procedures, tardiness tracking, and PTO policies for 24/7 operations.', cat: 'Operations',
    content: `<h2>Attendance & Scheduling</h2><p><strong>Effective:</strong> Nov 1, 2024</p><h3>1. Scheduling</h3><p>Posted 2 weeks in advance. Shift swaps require supervisor approval 48 hours prior.</p><h3>2. Call-Off</h3><ul><li>Notify supervisor 2+ hours before shift</li><li>Must speak directly — voicemail/text not accepted</li><li>Doctor's note for 3+ consecutive days</li></ul><h3>3. Tardiness</h3><table><tr><th>Occurrences (90 days)</th><th>Action</th></tr><tr><td>3</td><td>Verbal warning</td></tr><tr><td>5</td><td>Written warning</td></tr><tr><td>7</td><td>Final warning</td></tr><tr><td>9+</td><td>Termination</td></tr></table><h3>4. No-Call/No-Show</h3><p>Two NCNS in 12 months = grounds for immediate termination.</p>`, when: iso(16, 25) },
  { title: 'Infection Control & PPE Protocol', desc: 'Standard and transmission-based precautions, hand hygiene standards, and exposure protocols.', cat: 'Clinical',
    content: `<h2>Infection Control & PPE</h2><p><strong>Effective:</strong> Nov 15, 2024</p><h3>1. Standard Precautions</h3><ul><li>Hand hygiene before/after every patient contact</li><li>Gloves for blood, body fluids, mucous membranes</li><li>Face mask + eye protection for splash-prone procedures</li></ul><h3>2. Transmission-Based</h3><ul><li><strong>Contact:</strong> Gown + gloves, dedicated equipment</li><li><strong>Droplet:</strong> Surgical mask within 6 feet</li><li><strong>Airborne:</strong> N95, negative-pressure room</li></ul><h3>3. Hand Hygiene Target: 95%</h3><p>Monthly audits. Non-compliance triggers remedial training.</p>`, when: iso(16, 1) },
  { title: 'Code of Conduct & Professional Ethics', desc: 'Standards of professional behavior, dress code, conflict of interest, and substance-free workplace.', cat: 'General',
    content: `<h2>Code of Conduct</h2><p><strong>Effective:</strong> Oct 1, 2024</p><h3>1. Professional Standards</h3><p>Integrity, respect, and professionalism in all interactions.</p><h3>2. Dress Code</h3><ul><li><strong>Clinical:</strong> Approved scrubs, closed-toe shoes, ID badge visible</li><li><strong>Admin:</strong> Business casual; no jeans/flip-flops</li><li><strong>Facilities/Security:</strong> Department-issued uniform</li></ul><h3>3. Social Media</h3><p>No patient info, no identifiable workplace photos, no damaging content.</p><h3>4. Substance-Free</h3><p>Drug-free workplace. Random screening permitted. Under-the-influence = immediate suspension.</p>`, when: iso(17, 20) },
  { title: 'Emergency Preparedness & Disaster Response', desc: 'Hospital emergency codes, mass casualty incident protocols, and evacuation procedures.', cat: 'Safety',
    content: `<h2>Emergency Preparedness</h2><p><strong>Effective:</strong> Dec 1, 2024</p><h3>1. Emergency Codes</h3><table><tr><th>Code</th><th>Emergency</th><th>Action</th></tr><tr><td>Red</td><td>Fire</td><td>RACE protocol</td></tr><tr><td>Blue</td><td>Cardiac Arrest</td><td>Crash cart + CPR</td></tr><tr><td>Silver</td><td>Active Threat</td><td>Run/Hide/Fight</td></tr><tr><td>Orange</td><td>HazMat</td><td>Evacuate + HazMat team</td></tr><tr><td>Gray</td><td>Severe Weather</td><td>Interior shelter</td></tr></table><h3>2. MCI</h3><p>HICS activation. All staff report to staging areas. Leave suspended.</p><h3>3. Drills</h3><p>2 per department per year. Mandatory participation.</p>`, when: iso(14, 5) },
  { title: 'IT Security & Acceptable Use', desc: 'Password policies, MFA requirements, acceptable use of hospital technology, and incident reporting.', cat: 'IT / Security',
    content: `<h2>IT Security & Acceptable Use</h2><p><strong>Effective:</strong> Jan 1, 2025</p><h3>1. Access Control</h3><ul><li>Unique login per employee — sharing = terminable offense</li><li>Passwords: 12+ chars, mixed case/numbers/symbols, 90-day rotation</li><li>MFA required for EHR access</li></ul><h3>2. Prohibited</h3><ul><li>Unauthorized software installation</li><li>Personal USB drives on hospital devices</li><li>Personal devices on clinical network</li></ul><h3>3. Phishing</h3><p>Never click suspicious links. Report to security@mghr.local. MGHR never asks for passwords via email.</p>`, when: iso(12, 5) },
  { title: 'FMLA & Leave of Absence', desc: 'Family and Medical Leave Act compliance, eligibility, documentation, and return-to-work procedures.', cat: 'HR',
    content: `<h2>FMLA & Leave of Absence</h2><p><strong>Effective:</strong> Jan 15, 2025</p><h3>1. Eligibility</h3><p>Employees with 12+ months tenure and 1,250+ hours worked. Up to 12 weeks unpaid leave per 12-month period.</p><h3>2. Qualifying Reasons</h3><ul><li>Birth/adoption/foster placement of a child</li><li>Serious health condition of employee</li><li>Care of spouse, child, or parent with serious condition</li><li>Military family leave (qualifying exigency or caregiver)</li></ul><h3>3. Process</h3><p>30 days advance notice for foreseeable leave. Certification from healthcare provider within 15 days.</p><h3>4. Return to Work</h3><p>Fitness-for-duty certification required for medical leave. Same or equivalent position guaranteed.</p>`, when: iso(11, 15) },
  { title: 'ADA Reasonable Accommodation', desc: 'Americans with Disabilities Act compliance, interactive process, and accommodation procedures.', cat: 'HR',
    content: `<h2>ADA Reasonable Accommodation</h2><p><strong>Effective:</strong> Feb 1, 2025</p><h3>1. Policy</h3><p>MGHR provides reasonable accommodations to qualified individuals with disabilities unless it causes undue hardship.</p><h3>2. Interactive Process</h3><ol><li>Employee requests accommodation (written or verbal)</li><li>HR initiates interactive dialogue within 5 business days</li><li>Medical documentation may be requested</li><li>Accommodation determined collaboratively</li></ol><h3>3. Examples</h3><ul><li>Modified work schedule</li><li>Ergonomic equipment</li><li>Job restructuring</li><li>Reassignment to vacant position</li></ul><h3>4. Confidentiality</h3><p>Medical information kept in separate confidential files. Need-to-know basis for supervisors.</p>`, when: iso(10, 1) },
  { title: 'Drug-Free Workplace', desc: 'Substance abuse prevention, testing protocols, Employee Assistance Program, and consequences.', cat: 'Safety',
    content: `<h2>Drug-Free Workplace Policy</h2><p><strong>Effective:</strong> Mar 1, 2025</p><h3>1. Prohibited</h3><p>Use, possession, distribution, or being under the influence of illegal drugs or alcohol on MGHR premises or during work hours.</p><h3>2. Testing</h3><ul><li><strong>Pre-employment:</strong> All candidates</li><li><strong>Reasonable suspicion:</strong> Observable impairment, documented by supervisor</li><li><strong>Post-accident:</strong> Any workplace injury requiring medical treatment</li><li><strong>Random:</strong> Safety-sensitive positions monthly</li></ul><h3>3. EAP</h3><p>Confidential assistance available 24/7. 1-800-MGHR-EAP. Self-referral before a positive test may qualify for treatment instead of termination.</p><h3>4. Consequences</h3><p>First offense: 30-day suspension + mandatory EAP. Second offense: termination.</p>`, when: iso(9, 1) },
  { title: 'Whistleblower Protection', desc: 'Protections for reporting fraud, waste, abuse, safety violations, and compliance concerns.', cat: 'Compliance',
    content: `<h2>Whistleblower Protection Policy</h2><p><strong>Effective:</strong> Apr 1, 2025</p><h3>1. Purpose</h3><p>To encourage and protect employees who report suspected fraud, waste, abuse, or violations of law, regulation, or hospital policy.</p><h3>2. Protected Activity</h3><ul><li>Reporting suspected fraud or financial irregularities</li><li>Reporting safety violations or patient care concerns</li><li>Reporting regulatory non-compliance</li><li>Cooperating with investigations</li></ul><h3>3. Reporting Channels</h3><ul><li>Direct supervisor or department head</li><li>Compliance Officer: compliance@mghr.local</li><li>Anonymous hotline: 1-800-MGHR-ETHICS</li></ul><h3>4. Non-Retaliation</h3><p>Retaliation = immediate disciplinary action up to termination. Complainants may also report to OSHA or the OIG.</p>`, when: iso(8, 1) },
  { title: 'Patient Rights & Informed Consent', desc: 'Patient Bill of Rights, informed consent procedures, advance directives, and cultural competency.', cat: 'Clinical',
    content: `<h2>Patient Rights & Informed Consent</h2><p><strong>Effective:</strong> May 1, 2025</p><h3>1. Patient Rights</h3><ul><li>Right to respectful care regardless of background</li><li>Right to privacy and confidentiality</li><li>Right to participate in care decisions</li><li>Right to refuse treatment</li><li>Right to access medical records</li></ul><h3>2. Informed Consent</h3><p>Before any procedure: explain risks, benefits, alternatives in patient's preferred language. Document consent with signature and witness.</p><h3>3. Advance Directives</h3><p>Ask about advance directives on admission. Document in EHR. Honor patient wishes.</p><h3>4. Language Access</h3><p>Interpreter services available 24/7. Never use family members as interpreters for medical decisions.</p>`, when: iso(7, 1) },
  { title: 'Workplace Violence Prevention', desc: 'Zero-tolerance violence policy, de-escalation training, panic button procedures, and incident response.', cat: 'Safety',
    content: `<h2>Workplace Violence Prevention</h2><p><strong>Effective:</strong> Jun 1, 2025</p><h3>1. Zero Tolerance</h3><p>MGHR has zero tolerance for threats, intimidation, or physical violence by patients, visitors, or staff.</p><h3>2. De-escalation</h3><p>All patient-facing staff complete annual de-escalation training. Use calm voice, open body language, offer choices.</p><h3>3. Panic Buttons</h3><p>Located at every nursing station, registration desk, and waiting area. Press = Security responds within 90 seconds.</p><h3>4. Reporting</h3><p>All incidents reported immediately. Security assesses threat level. Police called for criminal acts.</p><h3>5. Staff Support</h3><p>Affected employees offered EAP, shift reassignment, and incident debriefing within 24 hours.</p>`, when: iso(5, 1) },
  { title: 'Telehealth & Remote Work', desc: 'Standards for virtual patient visits, remote documentation, data security for off-site work.', cat: 'IT / Security',
    content: `<h2>Telehealth & Remote Work Policy</h2><p><strong>Effective:</strong> Aug 1, 2025</p><h3>1. Telehealth Standards</h3><ul><li>Use only MGHR-approved telehealth platform</li><li>Verify patient identity before each session</li><li>Document visits in EHR same as in-person</li><li>Ensure private, professional background</li></ul><h3>2. Remote Work</h3><p>Eligible positions determined by department. VPN required for all remote access. No public WiFi for patient data.</p><h3>3. Equipment</h3><p>Hospital-issued devices only. Personal devices prohibited for PHI access.</p><h3>4. Availability</h3><p>Remote workers maintain same response times as on-site. Camera-on for all virtual meetings.</p>`, when: iso(3, 1) },
];

const policyMap = {};
const insertPolicy = db.prepare(`INSERT INTO policies (id, organization_id, title, description, status, current_version, draft_content, acknowledgment_required, handbook_category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertPV = db.prepare(`INSERT INTO policy_versions (id, policy_id, version_number, content, is_locked, change_summary, effective_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const insertEvent = db.prepare(`INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, actor_name, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const policyTx = db.transaction(() => {
  for (const p of policies) {
    const pid = uuidv4(), pvid = uuidv4();
    insertPolicy.run(pid, orgId, p.title, p.desc, 'active', 1, p.content, 1, p.cat, p.when, p.when);
    insertPV.run(pvid, pid, 1, p.content, 1, 'Initial publication', p.when, p.when);
    policyMap[p.title] = { id: pid, versionId: pvid, content: p.content, createdAt: p.when };
    insertEvent.run(uuidv4(), orgId, 'policy.published', 'policy', pid, 'director@mghr.local', 'Dr. Victoria Sterling', `Published "${p.title}" v1`, p.when);
  }
});
policyTx();
console.log(`✅ ${policies.length} policies with full HTML content`);

// ─── 5. HANDBOOK ──────────────────────────────────────────
const hbId = uuidv4();
db.prepare(`INSERT INTO handbooks (id, organization_id, name, description, status, policy_sections, source, created_by_email, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(hbId, orgId, 'MGHR Employee Handbook 2025-2026', 'Comprehensive employee handbook', 'published', JSON.stringify(Object.values(policyMap).map(p => p.id)), 'manual', 'director@mghr.local', 'Dr. Victoria Sterling', iso(14, 1));
console.log(`✅ Handbook published`);

// ─── 6. ACKNOWLEDGMENTS (~400) ────────────────────────────
let ackCount = 0, ackSkipped = 0;
const activeEmps = employees.filter(e => e.status !== 'inactive').map(e => e.email);
const insertAck = db.prepare(`INSERT INTO acknowledgments (id, organization_id, policy_id, policy_version_id, policy_title, version_number, employee_id, employee_name, employee_email, employee_role_at_time, employee_location_at_time, acknowledged_at, content_hash, is_locked, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`);

const ackTx = db.transaction(() => {
  for (const [title, p] of Object.entries(policyMap)) {
    for (const email of activeEmps) {
      const emp = empMap[email]; if (!emp) continue;
      if (Math.random() < 0.12) { ackSkipped++; continue; }
      const pd = new Date(p.createdAt);
      pd.setDate(pd.getDate() + 1 + Math.floor(Math.random() * 21));
      const ackDate = pd.toISOString();
      insertAck.run(uuidv4(), orgId, p.id, p.versionId, title, 1, emp.id, emp.name, emp.email, emp.role, emp.locId, ackDate, contentHash(p.content), '10.0.0.' + Math.floor(Math.random() * 254 + 1), 'Mozilla/5.0 NobleHR/2.0', ackDate);
      ackCount++;
    }
  }
});
ackTx();
console.log(`✅ ${ackCount} acknowledgments (${ackSkipped} pending)`);

// ─── 7. HR RECORDS (15) ──────────────────────────────────
const hrRecords = [
  { emp: 'rn.johnson@mghr.local', type: 'write_up', title: 'Unauthorized OT', desc: 'Worked 4 hours overtime without supervisor approval on 3 separate occasions. Verbal warning.', sev: 'Low', lv: 1, when: iso(14, 10) },
  { emp: 'records@mghr.local', type: 'write_up', title: 'HIPAA Violation - Records Access', desc: 'Accessed medical records of a personal acquaintance without treatment, payment, or operations justification. Written warning issued; additional HIPAA training assigned.', sev: 'High', lv: 2, when: iso(12, 5) },
  { emp: 'dr.foster@mghr.local', type: 'commendation', title: 'Life-Saving ER Response', desc: 'Dr. Foster\'s rapid diagnosis of a tension pneumothorax in a trauma patient directly saved the patient\'s life. Recognized at the quarterly medical staff meeting.', sev: 'Low', lv: 0, when: iso(11, 20) },
  { emp: 'rn.taylor@mghr.local', type: 'commendation', title: 'Patient Experience Excellence', desc: 'Received 12 consecutive perfect patient satisfaction scores. Family members specifically named Brandon in thank-you letters to administration.', sev: 'Low', lv: 0, when: iso(10, 15) },
  { emp: 'term.nurse@mghr.local', type: 'write_up', title: 'Medication Error', desc: 'Administered incorrect dosage of heparin. Patient was monitored and suffered no adverse effects. Written warning with mandatory medication safety refresher.', sev: 'Critical', lv: 2, when: iso(9, 10) },
  { emp: 'term.nurse@mghr.local', type: 'write_up', title: 'Second Medication Error', desc: 'Second medication error within 6 months. Incorrect IV rate on vasopressor. Caught by charge nurse before patient harm. Performance Improvement Plan initiated.', sev: 'Critical', lv: 3, when: iso(7, 5) },
  { emp: 'rn.davis@mghr.local', type: 'commendation', title: 'Code Blue Response', desc: 'Keisha identified subtle rhythm changes on telemetry and initiated rapid response 2 minutes before the patient coded. Her early intervention was credited with the patient\'s survival.', sev: 'Low', lv: 0, when: iso(6, 1) },
  { emp: 'term.tech@mghr.local', type: 'write_up', title: 'Repeated Tardiness', desc: 'Ryan has been late 6 times in 60 days despite verbal counseling. Written warning per Attendance Policy.', sev: 'Medium', lv: 2, when: iso(8, 15) },
  { emp: 'term.tech@mghr.local', type: 'write_up', title: 'No-Call No-Show', desc: 'Failed to report for Saturday shift and did not call in. This is the second NCNS. Per policy, grounds for termination.', sev: 'Critical', lv: 3, when: iso(6, 20) },
  { emp: 'security1@mghr.local', type: 'write_up', title: 'Excessive Force Complaint', desc: 'Patient family member alleged excessive force during ER restraint. Investigation found Michael used appropriate techniques but failed to activate body camera. Written warning for camera policy violation.', sev: 'High', lv: 2, when: iso(5, 10) },
  { emp: 'term.guard@mghr.local', type: 'write_up', title: 'Sleeping On Duty', desc: 'Found asleep in the security control room during overnight shift at 0300. Cameras were unmonitored for an estimated 45 minutes. Final written warning.', sev: 'Critical', lv: 3, when: iso(4, 5) },
  { emp: 'dietary@mghr.local', type: 'commendation', title: 'Dietary Innovation Award', desc: 'Rosa developed a new allergy-safe menu system that reduced dietary-related incidents by 40%. Implemented hospital-wide.', sev: 'Low', lv: 0, when: iso(2, 15) },
  { emp: 'pharm.tech@mghr.local', type: 'write_up', title: 'Controlled Substance Count Discrepancy', desc: 'Discrepancy of 2 tablets in hydrocodone count. Investigation ongoing. Employee cooperating fully. Precautionary reassignment from narcotics rotation.', sev: 'Critical', lv: 2, when: iso(1, 10) },
  { emp: 'reception1@mghr.local', type: 'write_up', title: 'Patient Complaint - Rudeness', desc: 'Two separate patients filed complaints about dismissive behavior at check-in. Verbal counseling provided; customer service refresher assigned.', sev: 'Low', lv: 1, when: iso(1, 5) },
  { emp: 'pt.martinez@mghr.local', type: 'commendation', title: 'Exceptional Patient Outcomes', desc: 'Sofia\'s post-surgical rehabilitation patients show 30% faster recovery times compared to department average. Methodology being studied for department-wide adoption.', sev: 'Low', lv: 0, when: iso(0, 20) },
];

const insertHR = db.prepare(`INSERT INTO hr_records (id, organization_id, employee_id, record_type, title, description, status, severity, discipline_level, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const hrTx = db.transaction(() => {
  for (const hr of hrRecords) {
    const emp = empMap[hr.emp]; if (!emp) continue;
    insertHR.run(uuidv4(), orgId, emp.id, hr.type, hr.title, hr.desc, 'submitted', hr.sev, hr.lv, 'director@mghr.local', hr.when, hr.when);
  }
});
hrTx();
console.log(`✅ ${hrRecords.length} HR records`);

// ─── 8. INCIDENTS (12) ───────────────────────────────────
const incidents = [
  { emp: 'rn.johnson@mghr.local', title: 'Needlestick in ER Trauma Bay', desc: 'Sustained needlestick while starting IV on agitated trauma patient. Gloves were worn. Wound washed immediately. Employee Health notified. Baseline labs drawn.', type: 'Injury', sev: 'High', when: iso(15, 8, 22), status: 'resolved' },
  { emp: 'lab.tech1@mghr.local', title: 'Chemical Spill - Reagent Lab', desc: '500ml of xylene spilled during specimen processing. Lab evacuated per HazCom. Facilities responded in 6 minutes. No exposures confirmed. SDS reviewed.', type: 'Environmental', sev: 'High', when: iso(13, 12, 10), status: 'resolved' },
  { emp: 'rn.taylor@mghr.local', title: 'Patient Fall Post-Surgery', desc: 'Patient attempted to ambulate without assistance 4 hours post-anesthesia. Fall from bed height. No fractures on X-ray. Bed alarm was not activated.', type: 'Patient Safety', sev: 'Medium', when: iso(11, 5, 3), status: 'resolved' },
  { emp: 'term.nurse@mghr.local', title: 'Medication Error - Wrong Dose', desc: 'Heparin administered at 10x ordered rate due to pump programming error. Caught within 15 minutes by charge nurse. Patient monitored, no adverse outcome.', type: 'Patient Safety', sev: 'Critical', when: iso(9, 10, 14), status: 'resolved' },
  { emp: 'security1@mghr.local', title: 'Combative Patient - ER', desc: 'Intoxicated patient became physically combative, striking two nurses and a security officer. Restraints applied per protocol. Police report filed. Injuries: minor bruising.', type: 'Workplace Violence', sev: 'High', when: iso(8, 20, 1), status: 'resolved' },
  { emp: 'facilities@mghr.local', title: 'Elevator Malfunction - Tower A', desc: 'Elevator 3 stopped between floors 2 and 3 with 4 occupants including 1 wheelchair patient. Fire department responded. All occupants safe. Elevator taken out of service.', type: 'Equipment', sev: 'High', when: iso(7, 15, 11), status: 'resolved' },
  { emp: 'transport@mghr.local', title: 'Patient Transport Injury', desc: 'Wheelchair patient\'s foot caught on door frame during transport to radiology. Minor laceration to left ankle. First aid applied. Transport pathway inspected.', type: 'Patient Safety', sev: 'Low', when: iso(5, 8, 9), status: 'resolved' },
  { emp: 'dr.singh@mghr.local', title: 'Surgical Count Discrepancy', desc: 'Post-surgical sponge count discrepancy. X-ray confirmed no retained items. Root cause: documentation error. Count sheet updated. No patient harm.', type: 'Patient Safety', sev: 'High', when: iso(4, 12, 16), status: 'under_review' },
  { emp: 'pharm.tech@mghr.local', title: 'Controlled Substance Discrepancy', desc: 'End-of-shift count showed 2 hydrocodone tablets missing from automated dispensing cabinet. Video review in progress. Area secured pending investigation.', type: 'Compliance', sev: 'Critical', when: iso(1, 10, 7), status: 'under_review' },
  { emp: 'rn.lee@mghr.local', title: 'Pediatric Fall - Playroom', desc: 'A 4-year-old patient fell from play structure in pediatric activity room. Bumped head, no loss of consciousness. Neuro checks initiated per protocol. Parents notified.', type: 'Patient Safety', sev: 'Medium', when: iso(1, 25, 14), status: 'submitted' },
  { emp: 'dr.foster@mghr.local', title: 'Verbal Threat from Patient Family', desc: 'Family member threatened Dr. Foster after learning about DNR status. Security escort provided. Behavioral contract initiated. No physical contact.', type: 'Workplace Violence', sev: 'Medium', when: iso(0, 18, 19), status: 'submitted' },
  { emp: 'rad.tech@mghr.local', title: 'Radiation Overexposure Alert', desc: 'Tyler\'s dosimeter badge reading exceeded monthly threshold. Review of procedures found door interlock bypassed during portable exam. Re-training completed. No symptoms.', type: 'Safety', sev: 'High', when: iso(0, 5, 8), status: 'submitted' },
];

const insertInc = db.prepare(`INSERT INTO incident_reports (id, organization_id, employee_id, title, description, status, incident_type, severity, incident_date, location_id, witnesses, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const incTx = db.transaction(() => {
  for (const inc of incidents) {
    const emp = empMap[inc.emp]; if (!emp) continue;
    insertInc.run(uuidv4(), orgId, emp.id, inc.title, inc.desc, inc.status, inc.type, inc.sev, inc.when, emp.locId, null, emp.email, inc.when, inc.when);
  }
});
incTx();
console.log(`✅ ${incidents.length} incidents`);

// ─── 9. SYSTEM EVENTS (80+) ─────────────────────────────
const sysEvents = [];
// Org creation
sysEvents.push({ type: 'org.created', summary: 'Metro General Hospital & Research Institute registered', when: iso(18, 1, 8) });
// All hires
for (const e of employees) {
  sysEvents.push({ type: e.status === 'inactive' ? 'employee.hired' : 'employee.hired', summary: `${e.name} joined as ${e.role}`, when: e.hire });
}
// Terminations
sysEvents.push({ type: 'employee.terminated', summary: 'Terminated Vanessa Cole (RN) — repeated medication errors, PIP failed', when: iso(6, 1) });
sysEvents.push({ type: 'employee.terminated', summary: 'Terminated Ryan Moss (Lab Tech) — attendance violations, 2nd NCNS', when: iso(5, 25) });
sysEvents.push({ type: 'employee.terminated', summary: 'Terminated Frank Russo (Security) — sleeping on duty after final warning', when: iso(3, 10) });
// HR events
for (const hr of hrRecords) {
  const emp = empMap[hr.emp];
  if (!emp) continue;
  const evType = hr.type === 'commendation' ? 'hr.commendation' : 'hr.write_up';
  sysEvents.push({ type: evType, summary: `${hr.type === 'commendation' ? 'Commendation' : 'Write-up'}: ${hr.title} — ${emp.name}`, when: hr.when });
}
// Incident events
for (const inc of incidents) {
  sysEvents.push({ type: 'incident.created', summary: `Incident: ${inc.title}`, when: inc.when });
}
// Extra operational events
sysEvents.push({ type: 'org.settings_updated', summary: 'Updated organization settings — added Telehealth department', when: iso(3, 5) });
sysEvents.push({ type: 'org.settings_updated', summary: 'Employee count updated to 35', when: iso(2, 1) });
sysEvents.push({ type: 'policy.updated', summary: 'Updated HIPAA Privacy & Security to v2 — added telehealth provisions', when: iso(2, 15) });
sysEvents.push({ type: 'policy.updated', summary: 'Updated IT Security — added remote work VPN requirements', when: iso(1, 20) });

// Sort by date
sysEvents.sort((a, b) => new Date(a.when) - new Date(b.when));

const evTx = db.transaction(() => {
  for (const ev of sysEvents) {
    insertEvent.run(uuidv4(), orgId, ev.type, null, null, 'director@mghr.local', 'Dr. Victoria Sterling', ev.summary, ev.when);
  }
});
evTx();
console.log(`✅ ${sysEvents.length} system events spanning 18 months`);

// ─── 10. ONBOARDING ──────────────────────────────────────
const newHires = ['dietary@mghr.local', 'transport@mghr.local', 'pharm.tech@mghr.local', 'rn.thompson@mghr.local', 'rad.tech@mghr.local'];
const pIds = Object.values(policyMap).map(p => p.id);
const insertOB = db.prepare(`INSERT INTO onboardings (id, organization_id, employee_id, employee_name, employee_email, assigned_policy_ids, completed_policy_ids, due_date, start_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const obTx = db.transaction(() => {
  for (const email of newHires) {
    const emp = empMap[email]; if (!emp) continue;
    const completed = pIds.slice(0, Math.floor(Math.random() * pIds.length));
    insertOB.run(uuidv4(), orgId, emp.id, emp.name, emp.email, JSON.stringify(pIds), JSON.stringify(completed), iso(-1, 1), iso(1, 5), completed.length === pIds.length ? 'completed' : 'in_progress', iso(1, 5));
  }
});
obTx();
console.log(`✅ ${newHires.length} onboarding records`);

// ─── DONE ─────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════");
console.log("  LEVEL 2 STRESS TEST COMPLETE");
console.log("═══════════════════════════════════════════════════════");
console.log(`\n  Organization: Metro General Hospital & Research Institute`);
console.log(`  State: CA | Industry: Healthcare`);
console.log(`  Employees: ${employees.length} (3 terminated)`);
console.log(`  Policies: ${policies.length}`);
console.log(`  Locations: ${locations.length}`);
console.log(`  Acknowledgments: ${ackCount} (${ackSkipped} pending)`);
console.log(`  HR Records: ${hrRecords.length}`);
console.log(`  Incidents: ${incidents.length}`);
console.log(`  System Events: ${sysEvents.length}`);
console.log(`  Onboarding: ${newHires.length}`);
console.log(`\n  Admin:    director@mghr.local / StressTest2026!`);
console.log(`  CFO:      cfo@mghr.local / StressTest2026!`);
console.log(`  ER Chief: er.chief@mghr.local / StressTest2026!`);
console.log(`  Nurse:    rn.johnson@mghr.local / StressTest2026!`);
console.log(`  Doctor:   dr.foster@mghr.local / StressTest2026!`);
console.log("");
db.close();
