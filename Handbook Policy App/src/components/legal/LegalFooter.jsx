import { Link } from 'react-router-dom';
import { legalConfig } from '@/config/legal';

/**
 * Compact site footer: copyright + links. Use on auth screens and main app shell.
 */
export default function LegalFooter({ className = '' }) {
  const { legalEntityName, copyrightYear, appPublicName } = legalConfig;

  return (
    <footer
      className={`text-center text-xs text-slate-500 space-y-2 px-4 py-6 ${className}`}
      role="contentinfo"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/legal/terms" className="text-primary hover:underline">
          Terms of Service
        </Link>
        <span className="text-slate-300" aria-hidden>
          |
        </span>
        <Link to="/legal/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        <span className="text-slate-300" aria-hidden>
          |
        </span>
        <Link to="/legal/contact" className="text-primary hover:underline">
          Contact & concerns
        </Link>
      </div>
      <p className="text-slate-400 max-w-lg mx-auto leading-snug">
        © {copyrightYear} {legalEntityName}. All rights reserved.
      </p>
      <p className="text-slate-400 max-w-lg mx-auto leading-snug">
        {appPublicName} is provided by {legalEntityName}.
      </p>
      <p className="text-slate-400 max-w-xl mx-auto leading-snug">
        This software does not provide legal advice. Employers are responsible for compliance with
        employment and privacy laws that apply to them.
      </p>
    </footer>
  );
}
