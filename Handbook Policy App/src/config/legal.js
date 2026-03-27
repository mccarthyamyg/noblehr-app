/**
 * Public legal / branding copy. Override via Vite env for production.
 * VITE_LEGAL_ENTITY_NAME — e.g. incorporated company name (until then, use a trade name you control).
 * VITE_LEGAL_CONTACT_EMAIL — privacy, terms questions, and concerns.
 */

const appPublicName = import.meta.env.VITE_APP_PUBLIC_NAME || 'Noble HR';

export const legalConfig = {
  appPublicName,
  /** Shown in copyright and legal notices */
  legalEntityName:
    import.meta.env.VITE_LEGAL_ENTITY_NAME ||
    '[Legal entity name — set VITE_LEGAL_ENTITY_NAME before public beta or billing]',
  /** Primary contact for legal, privacy, and trust concerns */
  contactEmail:
    import.meta.env.VITE_LEGAL_CONTACT_EMAIL ||
    import.meta.env.VITE_SUPPORT_EMAIL ||
    'concerns@example.com',
  copyrightYear: 2026,
  /** Placeholder until you choose a state with counsel */
  governingLawState:
    import.meta.env.VITE_GOVERNING_LAW_STATE || '[U.S. state — to be specified]',
  termsLastUpdated: '2026-03-27',
  privacyLastUpdated: '2026-03-27',
};

export function mailtoConcerns(subject = '') {
  const base = `mailto:${legalConfig.contactEmail}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}
