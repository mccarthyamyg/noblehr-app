import LegalPageShell from '@/components/legal/LegalPageShell';
import { legalConfig, mailtoConcerns } from '@/config/legal';
import { Button } from '@/components/ui/button';
import { Mail, Shield, AlertTriangle } from 'lucide-react';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function ContactConcerns() {
  const c = legalConfig;

  return (
    <LegalPageShell title="Contact, concerns & trust" lastUpdated={c.privacyLastUpdated}>
      <p>
        We take questions about privacy, security, and the use of <strong>{c.appPublicName}</strong> seriously—
        especially because the product can involve sensitive workforce information.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="font-medium text-slate-900 flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          Primary contact
        </p>
        <p className="text-slate-600">
          For legal notices, privacy requests, security reports, and general concerns about the Service:
        </p>
        <Button asChild variant="default" className="w-full sm:w-auto">
          <a href={mailtoConcerns(`Question about ${c.appPublicName}`)}>{c.contactEmail}</a>
        </Button>
        <p className="text-xs text-slate-500">
          Before public beta or billing, replace placeholder contact addresses in your deployment configuration (
          <code className="bg-slate-100 px-1 rounded">VITE_LEGAL_CONTACT_EMAIL</code>) so messages reach you.
        </p>
      </div>

      <Section title="What to include">
        <ul className="list-disc pl-5 space-y-1">
          <li>Your name and organization (if applicable).</li>
          <li>Whether you are an administrator, employee, or other party.</li>
          <li>A clear description of the question, concern, or request.</li>
          <li>For privacy rights requests, the email address associated with your account (if any).</li>
          <li>For security issues, steps to reproduce and impact—please avoid publicly disclosing exploitable details.</li>
        </ul>
      </Section>

      <Section title="Employees and workforce data">
        <p className="flex gap-2">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span>
            If you are an employee and have questions about what your employer stores in {c.appPublicName}, start with
            your employer&apos;s HR or management team. They control most workforce records. We can help with access
            or technical issues when appropriate and when we can verify the request.
          </span>
        </p>
      </Section>

      <Section title="Security vulnerabilities">
        <p className="flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            If you believe you have found a security vulnerability, email us with details. Do not perform testing that
            could harm other customers&apos; data or service availability without prior written authorization.
          </span>
        </p>
      </Section>

      <Section title="Response times">
        <p>
          We are a small team; response times may vary. For urgent suspected breaches or illegal activity involving
          the Service, mark the subject line clearly. We may involve legal counsel or law enforcement where required.
        </p>
      </Section>
    </LegalPageShell>
  );
}
