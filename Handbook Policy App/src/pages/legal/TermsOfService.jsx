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

export default function TermsOfService() {
  const c = legalConfig;

  return (
    <LegalPageShell title="Terms of Service" lastUpdated={c.termsLastUpdated}>
      <p className="text-slate-600 border-l-4 border-amber-400 bg-amber-50/80 pl-3 py-2 rounded-r text-xs">
        <strong>Not legal advice.</strong> These terms are a starting point for a workforce-policy and HR
        documentation product. Have qualified counsel review them before external beta, paid plans, or
        handling regulated data at scale.
      </p>

      <Section title="1. Who we are">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of <strong>{c.appPublicName}</strong>
          (&quot;Service&quot;), offered by <strong>{c.legalEntityName}</strong> (&quot;we,&quot; &quot;us,&quot;
          &quot;our&quot;). By creating an account, inviting users, or otherwise using the Service, you agree to
          these Terms.
        </p>
      </Section>

      <Section title="2. What the Service is (and is not)">
        <p>
          {c.appPublicName} provides tools for organizations to create, organize, publish, and track acknowledgment
          of workplace policies, maintain employee-related records (such as disciplinary documentation and incident
          reports where your organization chooses to use those features), compliance checklists, and related workflows.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            The Service is <strong>not</strong> a law firm and <strong>does not</strong> provide legal advice.
            Templates, AI-assisted drafts, and compliance suggestions are informational only.
          </li>
          <li>
            You are solely responsible for determining whether any policy, procedure, or record is legally sufficient
            or appropriate for your workforce, industry, and locations.
          </li>
          <li>
            The Service does <strong>not</strong> replace payroll, benefits administration, labor relations counsel,
            or government filings unless we explicitly offer such features in writing.
          </li>
        </ul>
      </Section>

      <Section title="3. Eligibility and authority">
        <p>
          You represent that you have authority to bind your organization. If you use the Service on behalf of a
          company or other entity, you represent that you have the power to enter into these Terms for that entity.
        </p>
      </Section>

      <Section title="4. Customer data, employees, and your responsibilities">
        <p>
          Organizations (&quot;Customers&quot;) upload or generate sensitive workforce data, including personal
          information about employees and former employees. You are responsible for:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Having a lawful basis under applicable employment and privacy laws to collect, submit, and process that
            data in the Service.
          </li>
          <li>
            Providing any required notices to employees (and, where required, obtaining consent) for your use of the
            Service and subprocessors.
          </li>
          <li>
            The accuracy, legality, and appropriateness of content you create or upload, including AI-assisted
            content you choose to publish.
          </li>
          <li>
            Restricting access within your organization appropriately (e.g., limiting which administrators can
            view incident reports or employee files).
          </li>
        </ul>
      </Section>

      <Section title="5. AI-generated content">
        <p>
          Features may use third-party artificial intelligence services to suggest or draft text. Output may be
          incorrect, incomplete, or not suitable for your jurisdiction. You must review, edit, and approve content
          before relying on it. We do not warrant that AI output is legally compliant or factually correct.
        </p>
      </Section>

      <Section title="6. Accounts, security, and acceptable use">
        <p>
          Keep credentials confidential. You must not misuse the Service, including probing, scanning, or testing
          vulnerabilities without permission; circumventing access controls; uploading malware; harassing users; or
          using the Service in violation of law. We may suspend or terminate access for violations.
        </p>
      </Section>

      <Section title="7. Platform administration (super admin)">
        <p>
          For support, fraud prevention, and integrity of the platform, designated platform operators may have
          technical ability to access customer environments in limited circumstances. Such access is intended to be used
          only for legitimate support and platform operations, subject to confidentiality obligations described in our
          Privacy Policy—not for unrelated commercial use of your business data.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          We retain rights in the Service, software, and branding. Subject to these Terms, we grant you a limited,
          non-exclusive, non-transferable right to use the Service for your internal business purposes. You retain
          rights in content you provide; you grant us a license to host, process, and display that content as needed
          to operate the Service (including security, backup, and support).
        </p>
      </Section>

      <Section title="9. Confidentiality of sensitive HR information">
        <p>
          You agree to treat information you access through the Service in accordance with applicable law and your
          organization&apos;s policies. Features that restrict visibility (for example, incident reports) rely on
          technical controls and your administrative configuration; you remain responsible for workforce privacy and
          employment obligations.
        </p>
      </Section>

      <Section title="10. Third-party services">
        <p>
          The Service relies on infrastructure and service providers (such as hosting, email delivery, and AI
          providers). Their use is described at a high level in the Privacy Policy. We are not responsible for
          third-party services outside our reasonable control.
        </p>
      </Section>

      <Section title="11. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY
          LAW, WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE,
          UNINTERRUPTED, OR FREE OF HARMFUL COMPONENTS.
        </p>
      </Section>

      <Section title="12. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER WE NOR OUR SUPPLIERS WILL BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS
          OPPORTUNITIES, ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS. OUR AGGREGATE LIABILITY FOR ALL CLAIMS
          ARISING OUT OF OR RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE
          SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US$100), SO LONG AS YOU
          HAVE NOT YET BEEN CHARGED FEES, IN WHICH CASE THE CAP MAY BE LIMITED TO US$100 UNLESS OTHERWISE AGREED IN
          WRITING.
        </p>
        <p className="text-slate-600 text-xs">
          Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the
          fullest extent permitted by law.
        </p>
      </Section>

      <Section title="13. Indemnity">
        <p>
          You will defend and indemnify us against third-party claims, damages, and costs (including reasonable
          attorneys&apos; fees) arising from your content, your violation of these Terms, or your violation of
          applicable law—except to the extent caused by our willful misconduct.
        </p>
      </Section>

      <Section title="14. Suspension and termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for breach, risk, legal
          requirement, or non-payment (when billing applies). Provisions that by their nature should survive
          (including disclaimers, limitations, indemnity, and governing law) will survive termination.
        </p>
      </Section>

      <Section title="15. Changes">
        <p>
          We may modify the Service and these Terms. If we make material changes, we will provide notice by email,
          in-product notice, or by posting an updated date at the top of this page. Continued use after notice
          constitutes acceptance of the updated Terms, except where prohibited by law.
        </p>
      </Section>

      <Section title="16. Governing law and venue">
        <p>
          These Terms are governed by the laws of <strong>{c.governingLawState}</strong>, excluding conflict-of-law
          rules, unless a different governing law is required by applicable consumer protection law. You agree that
          courts located in that state (or the federal courts with appropriate jurisdiction) have exclusive venue,
          subject to mandatory arbitration or forum rules if we add them in a future paid agreement.
        </p>
      </Section>

      <Section title="17. Contact">
        <p>
          Questions about these Terms: <a className="text-primary font-medium hover:underline" href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>
        </p>
      </Section>
    </LegalPageShell>
  );
}
