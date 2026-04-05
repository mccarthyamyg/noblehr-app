import LegalPageShell from '@/components/legal/LegalPageShell';
import { legalConfig } from '@/config/legal';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const c = legalConfig;

  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={c.privacyLastUpdated}>
      <p className="text-slate-600 border-l-4 border-amber-400 bg-amber-50/80 pl-3 py-2 rounded-r text-xs">
        <strong>Not legal advice.</strong> This policy describes how we handle information in connection with{' '}
        {c.appPublicName}. Employment-related privacy obligations often fall on the employer as well—consult counsel
        for notice and workforce privacy programs.
      </p>

      <Section title="1. Who this policy covers">
        <p>
          This Privacy Policy explains how <strong>{c.legalEntityName}</strong> (&quot;we,&quot; &quot;us&quot;)
          collects, uses, discloses, and protects information in connection with <strong>{c.appPublicName}</strong>
          (&quot;Service&quot;). It applies to visitors to our website or app, organization administrators who create
          accounts, and end users (such as employees) who are invited to use the Service by their employer.
        </p>
      </Section>

      <Section title="2. Roles: employer vs. platform">
        <p>
          When a business uses the Service with its workforce, that business typically decides <em>why</em> and{' '}
          <em>how</em> employee-related personal information is processed for its HR and compliance programs. We
          provide the Service on the organization&apos;s instructions and for our own legitimate operations (security,
          billing when applicable, product improvement in aggregate). Your employer&apos;s privacy notice may also
          apply to you.
        </p>
      </Section>

      <Section title="3. Categories of information we process">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Account and contact data:</strong> name, email address, phone number (if provided), password
            credentials or authentication tokens, organization name, role, and similar profile fields.
          </li>
          <li>
            <strong>Workforce and HR content:</strong> policies, handbooks, acknowledgments (including timestamps and
            content fingerprints where used), onboarding records, disciplinary and performance-related records your
            administrators create, incident reports, uploaded documents, internal notes (where the product allows), and
            compliance checklist items.
          </li>
          <li>
            <strong>Technical and security data:</strong> IP address, device/browser type, approximate location derived
            from IP, logs of actions for security and audit (aligned with product features such as activity history),
            cookies or similar technologies used to maintain sessions.
          </li>
          <li>
            <strong>Support communications:</strong> information you send when you contact us.
          </li>
          <li>
            <strong>Payment data (if billing is enabled):</strong> processed by payment processors; we typically
            receive limited billing metadata, not full card numbers.
          </li>
        </ul>
      </Section>

      <Section title="4. How we use information">
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide, operate, maintain, and secure the Service.</li>
          <li>Authenticate users, enforce permissions, and prevent fraud or abuse.</li>
          <li>Send transactional emails (invites, password reset, acknowledgments, verification).</li>
          <li>Provide customer support and respond to legal requests where required.</li>
          <li>
            Improve reliability and performance; use aggregated or de-identified analytics where possible for product
            development.
          </li>
          <li>Comply with law and enforce our Terms of Service.</li>
        </ul>
      </Section>

      <Section title="5. AI processing">
        <p>
          If you use AI-assisted features, portions of your prompts or content may be transmitted to an AI provider
          to generate suggestions. You should avoid submitting highly sensitive data beyond what is necessary. Refer to
          your AI provider&apos;s documentation and your organizational policies. We configure services for commercial
          use; you should confirm retention and training practices with us or the provider as your program matures.
        </p>
      </Section>

      <Section title="6. How we share information">
        <p>We do not sell your personal information. We disclose information only as follows:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Service providers (subprocessors)</strong> that help us host, deliver email, monitor security, or
            provide AI capabilities—under contractual obligations to protect data and use it only for defined services.
          </li>
          <li>
            <strong>Your organization</strong>—users with appropriate roles can see employee-related data according to
            product permissions.
          </li>
          <li>
            <strong>Legal and safety:</strong> when required by law, court order, or to protect rights, safety, and
            security.
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with a merger, acquisition, or asset sale, subject to
            appropriate confidentiality commitments.
          </li>
        </ul>
      </Section>

      <Section title="7. Platform operator access (support)">
        <p>
          A small number of authorized platform operators may access customer environments when necessary to diagnose
          issues, prevent abuse, or meet security obligations. Access should be limited, logged where the product
          supports it, and used for legitimate operational purposes—not for unrelated review of your business
          information.
        </p>
      </Section>

      <Section title="8. Retention">
        <p>
          We retain information for as long as needed to provide the Service and for legitimate business purposes
          (such as security, backups, and legal compliance). Organizations may be able to export or request deletion of
          certain data subject to legal holds and product capabilities. Specific retention schedules may be tightened
          before paid or regulated deployments.
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          We implement technical and organizational measures appropriate to the nature of HR data, including access
          controls, encryption in transit (HTTPS), and secure handling of credentials. No method of storage or
          transmission is 100% secure; we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="10. Your choices and rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or restrict certain personal
          information, or to object to processing. Employees should often start with their employer&apos;s HR contact;
          individuals may also contact us at the email below. We may need to verify requests and coordinate with the
          organization that controls the account.
        </p>
      </Section>

      <Section title="11. Children">
        <p>
          The Service is not directed to children under 16. We do not knowingly collect personal information from
          children for commercial purposes. If you believe we have collected information from a child in error, contact
          us for deletion.
        </p>
      </Section>

      <Section title="12. International users">
        <p>
          If you access the Service from outside the United States, you understand that information may be processed in
          the United States or other countries where we or our providers operate, which may have different data
          protection laws.
        </p>
      </Section>

      <Section title="13. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version and revise the
          &quot;Last updated&quot; date. For material changes, we will provide additional notice as appropriate.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          Privacy questions or requests:{' '}
          <a className="text-primary font-medium hover:underline" href={`mailto:${c.contactEmail}`}>
            {c.contactEmail}
          </a>
        </p>
      </Section>
    </LegalPageShell>
  );
}

