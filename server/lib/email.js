/**
 * Email service — uses Resend (resend.com) for transactional email.
 * Set RESEND_API_KEY in env to enable. Falls back to console logging in dev.
 */
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Noble HR <onboarding@resend.dev>';
const isConfigured = !!RESEND_API_KEY;

let resend = null;
if (isConfigured) {
  resend = new Resend(RESEND_API_KEY);
  console.log('✓ Email service configured (Resend)');
} else {
  console.log('⚠ Email not configured — set RESEND_API_KEY to enable.');
}

export async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured) {
    console.log('[EMAIL] Would send to', to, ':', subject);
    console.log('[EMAIL] Body:', text || html?.slice(0, 200));
    return { dev: true };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (result.error) {
      console.error('[Email] Resend error:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Email] Sent to ${to}: "${subject}" (id: ${result.data?.id})`);
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendPasswordReset({ to, resetLink }) {
  const subject = '[Noble HR] Reset your password';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">Password Reset</h2>
      <p style="color: #475569; line-height: 1.6;">Click the button below to reset your password. This link expires in 1 hour.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a>
      </p>
      <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Noble HR · Secure HR Management Platform</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

export async function sendOrgApprovalNotification({ superAdminEmail, orgName, adminEmail, adminName, approvalLink }) {
  const subject = `[Noble HR] New organization awaiting approval: ${orgName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">New Organization Signup</h2>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 4px 0; color: #475569;"><strong>Organization:</strong> ${orgName}</p>
        <p style="margin: 4px 0; color: #475569;"><strong>Admin:</strong> ${adminName || adminEmail} (${adminEmail})</p>
      </div>
      <p style="margin: 24px 0;">
        <a href="${approvalLink}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Approve or Deny</a>
      </p>
      <p style="color: #94a3b8; font-size: 13px;">This link expires in 7 days. If you don't approve, the request will need to be resubmitted.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Noble HR · Secure HR Management Platform</p>
    </div>
  `;
  return sendEmail({ to: superAdminEmail, subject, html });
}

/** Reminder that policies are due for acknowledgment */
export async function sendAcknowledgmentReminder({ to, policyTitles, dueDate }) {
  const list = (policyTitles && policyTitles.length) ? policyTitles.map(t => `<li style="color: #475569; padding: 4px 0;">${t}</li>`).join('') : '<li>One or more policies</li>';
  const subject = '[Noble HR] Policies awaiting your acknowledgment';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">Policy Acknowledgment Reminder</h2>
      <p style="color: #475569; line-height: 1.6;">The following policies require your acknowledgment${dueDate ? ` by <strong>${dueDate}</strong>` : ''}:</p>
      <ul style="margin: 16px 0; padding-left: 20px;">${list}</ul>
      <p style="color: #475569;">Please log in to Noble HR to review and acknowledge them.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated reminder from your organization's HR system.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/** Confirmation that employee acknowledged a policy */
export async function sendAcknowledgmentConfirmation({ to, policyTitle }) {
  const subject = '[Noble HR] Policy acknowledged';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">Acknowledgment Recorded ✓</h2>
      <p style="color: #475569; line-height: 1.6;">You have acknowledged the policy: <strong>${policyTitle || 'Policy'}</strong>.</p>
      <p style="color: #94a3b8; font-size: 13px;">This confirmation is for your records.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Noble HR · Secure HR Management Platform</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/** Email verification before first login */
export async function sendVerificationEmail({ to, verificationLink, orgName }) {
  const subject = `Verify your email for ${orgName || 'Noble HR'}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 16px;">Verify Your Email</h2>
      <p style="color: #475569; line-height: 1.6;">Click the button below to verify your email address and activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Verify Email</a>
      </p>
      <p style="color: #94a3b8; font-size: 13px;">This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Noble HR · Secure HR Management Platform</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}
