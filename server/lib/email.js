/**
 * Email service - uses nodemailer when configured.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in env.
 * When not configured, logs to console (dev mode).
 */
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

const FROM = process.env.SMTP_FROM || 'Noble HR <noreply@noblehr.app>';
const isConfigured = !!process.env.SMTP_HOST;

export async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured) {
    console.log('[EMAIL] Would send to', to, ':', subject);
    console.log('[EMAIL] Body:', text || html?.slice(0, 200));
    return { dev: true };
  }
  return transporter.sendMail({
    from: FROM,
    to,
    subject,
    html: html || text,
    text: text || html?.replace(/<[^>]*>/g, ''),
  });
}

export async function sendPasswordReset({ to, resetLink }) {
  const subject = '[Noble HR] Reset your password';
  const html = `
    <h2>Password Reset</h2>
    <p>Click the link below to reset your password. It expires in 1 hour.</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Reset Password</a></p>
    <p style="color:#666;font-size:12px;">If you didn't request this, ignore this email.</p>
  `;
  return sendEmail({ to, subject, html });
}

export async function sendOrgApprovalNotification({ superAdminEmail, orgName, adminEmail, adminName, approvalLink }) {
  const subject = `[Noble HR] New organization awaiting approval: ${orgName}`;
  const html = `
    <h2>New Organization Signup</h2>
    <p><strong>Organization:</strong> ${orgName}</p>
    <p><strong>Admin:</strong> ${adminName || adminEmail} (${adminEmail})</p>
    <p><a href="${approvalLink}" style="display:inline-block;padding:10px 20px;background:#1e40af;color:white;text-decoration:none;border-radius:6px;">Approve or Deny</a></p>
    <p style="color:#666;font-size:12px;">This link expires in 7 days. If you don't approve, the request will need to be resubmitted.</p>
  `;
  return sendEmail({ to: superAdminEmail, subject, html });
}

/** TRUTH #158: Reminder that policies are due for acknowledgment */
export async function sendAcknowledgmentReminder({ to, policyTitles, dueDate }) {
  const list = (policyTitles && policyTitles.length) ? policyTitles.map(t => `<li>${t}</li>`).join('') : '<li>One or more policies</li>';
  const subject = '[Noble HR] Policies awaiting your acknowledgment';
  const html = `
    <h2>Policy Acknowledgment Reminder</h2>
    <p>The following policies require your acknowledgment${dueDate ? ` by ${dueDate}` : ''}:</p>
    <ul>${list}</ul>
    <p>Please log in to Noble HR to review and acknowledge them.</p>
    <p style="color:#666;font-size:12px;">This is an automated reminder from your organization's HR system.</p>
  `;
  return sendEmail({ to, subject, html });
}

/** TRUTH #158: Confirmation that employee acknowledged a policy */
export async function sendAcknowledgmentConfirmation({ to, policyTitle }) {
  const subject = '[Noble HR] You acknowledged a policy';
  const html = `
    <h2>Acknowledgment Recorded</h2>
    <p>You have acknowledged the policy: <strong>${policyTitle || 'Policy'}</strong>.</p>
    <p>This confirmation is for your records.</p>
    <p style="color:#666;font-size:12px;">Noble HR</p>
  `;
  return sendEmail({ to, subject, html });
}

/** TRUTH #158: Email verification before first login — legal defensibility chain */
export async function sendVerificationEmail({ to, verificationLink, orgName }) {
  const subject = `Verify your email for ${orgName || 'Noble HR'}`;
  const html = `
    <h2>Verify your email</h2>
    <p>Click the link below to verify your email address and activate your account.</p>
    <p><a href="${verificationLink}" style="display:inline-block;padding:10px 20px;background:#1e40af;color:white;text-decoration:none;border-radius:6px;">Verify Email</a></p>
    <p style="color:#666;font-size:12px;">This link expires in 24 hours.</p>
  `;
  return sendEmail({ to, subject, html });
}
