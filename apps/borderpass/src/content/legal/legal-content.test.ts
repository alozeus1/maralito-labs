/**
 * LEGAL REVIEW REQUIRED (content) — these tests check STRUCTURE, not legal sufficiency. No test here
 * can tell you the copy is legally adequate; only a qualified lawyer can. What they do enforce:
 * both locales exist and stay in sync, versions are stable and recorded, the required subject
 * matter is present, the draft banner is still there, and the consent rules behave.
 */
import { describe, it, expect } from 'vitest';
import {
  APP_CONSENT_TYPES,
  CONSENT_COPY,
  CURRENT_LEGAL_VERSIONS,
  LEGAL_LINKS,
  PRIVACY_VERSION,
  TERMS_VERSION,
  buildSignUpConsentDecisions,
  documentVersionForConsentType,
  getLegalDocument,
  getLegalDocumentVersion,
  resolveLegalLocale,
  signUpConsentIdempotencyKey,
  type LegalDocumentKind,
  type LegalLocale,
} from './index';

const KINDS: LegalDocumentKind[] = ['terms', 'privacy'];
const LOCALES: LegalLocale[] = ['es', 'en'];

describe('legal document versions', () => {
  it('exposes stable, prefixed version strings', () => {
    expect(TERMS_VERSION).toMatch(/^terms-\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_VERSION).toMatch(/^privacy-\d{4}-\d{2}-\d{2}$/);
    expect(CURRENT_LEGAL_VERSIONS).toEqual({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
  });

  it('resolves the version per kind and stamps it on the document in both locales', () => {
    expect(getLegalDocumentVersion('terms')).toBe(TERMS_VERSION);
    expect(getLegalDocumentVersion('privacy')).toBe(PRIVACY_VERSION);
    for (const kind of KINDS)
      for (const locale of LOCALES)
        expect(getLegalDocument(kind, locale).version).toBe(getLegalDocumentVersion(kind));
  });

  it('maps notification consents to the privacy notice version', () => {
    expect(documentVersionForConsentType('terms_of_service')).toBe(TERMS_VERSION);
    expect(documentVersionForConsentType('privacy_notice')).toBe(PRIVACY_VERSION);
    expect(documentVersionForConsentType('transactional_notifications')).toBe(PRIVACY_VERSION);
    expect(documentVersionForConsentType('marketing_communications')).toBe(PRIVACY_VERSION);
  });
});

describe('locale selection', () => {
  it('falls back to Spanish (primary market) for unknown/missing locales', () => {
    expect(resolveLegalLocale(undefined)).toBe('es');
    expect(resolveLegalLocale('fr')).toBe('es');
    expect(resolveLegalLocale('')).toBe('es');
    expect(resolveLegalLocale('es')).toBe('es');
    expect(resolveLegalLocale('en')).toBe('en');
    expect(getLegalDocument('terms', 'pt').locale).toBe('es');
  });
});

describe('bilingual copy integrity', () => {
  it('has both locales with matching section ids and order', () => {
    for (const kind of KINDS) {
      const es = getLegalDocument(kind, 'es');
      const en = getLegalDocument(kind, 'en');
      expect(es.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
      expect(es.sections.length).toBeGreaterThan(5);
    }
  });

  it('has no empty headings, paragraphs, or bullets', () => {
    for (const kind of KINDS)
      for (const locale of LOCALES) {
        const doc = getLegalDocument(kind, locale);
        expect(doc.title.length).toBeGreaterThan(0);
        expect(doc.summary.length).toBeGreaterThan(0);
        for (const s of doc.sections) {
          expect(s.heading.trim().length).toBeGreaterThan(0);
          expect(s.paragraphs.length).toBeGreaterThan(0);
          for (const p of s.paragraphs) expect(p.trim().length).toBeGreaterThan(0);
          for (const b of s.bullets ?? []) expect(b.trim().length).toBeGreaterThan(0);
        }
      }
  });

  it('keeps the pending-legal-review notice on every document (do not delete without sign-off)', () => {
    for (const kind of KINDS)
      for (const locale of LOCALES) {
        const notice = getLegalDocument(kind, locale).reviewNotice.toLowerCase();
        expect(notice).toMatch(locale === 'es' ? /revisión legal/ : /legal review/);
      }
  });
});

describe('required subject matter is present', () => {
  it('terms cover payment/Stripe, prohibited items, liability, and governing law', () => {
    for (const locale of LOCALES) {
      const ids = getLegalDocument('terms', locale).sections.map((s) => s.id);
      for (const id of [
        'the-service',
        'requests-and-quotes',
        'payment',
        'cancellations-refunds',
        'prohibited-items',
        'limitation-of-liability',
        'governing-law',
      ])
        expect(ids).toContain(id);
    }
  });

  it('privacy covers collection, card handling, security, retention, and ARCO rights', () => {
    for (const locale of LOCALES) {
      const ids = getLegalDocument('privacy', locale).sections.map((s) => s.id);
      for (const id of [
        'what-we-collect',
        'card-data',
        'purposes',
        'secondary-purposes',
        'security',
        'retention',
        'arco-rights',
        'how-to-exercise',
      ])
        expect(ids).toContain(id);
    }
  });

  it('states that BorderPass never stores full card data', () => {
    const es = getLegalDocument('privacy', 'es').sections.find((s) => s.id === 'card-data');
    const en = getLegalDocument('privacy', 'en').sections.find((s) => s.id === 'card-data');
    expect(es?.paragraphs.join(' ')).toContain('Stripe');
    expect(es?.paragraphs.join(' ')).toMatch(/NUNCA ve, recibe ni almacena/);
    expect(en?.paragraphs.join(' ')).toMatch(/NEVER sees, receives, or stores/);
  });

  it('flags unresolved legal placeholders so they cannot ship unnoticed', () => {
    const withPlaceholders = KINDS.flatMap((k) =>
      getLegalDocument(k, 'es').sections.filter((s) =>
        [...s.paragraphs, ...(s.bullets ?? [])].some((t) => /\[[^\]]+PENDIENTE[^\]]*\]/.test(t)),
      ),
    );
    // If this ever hits zero, either counsel resolved everything (then update this test and the
    // banner) or a placeholder was silently deleted without being answered.
    expect(withPlaceholders.length).toBeGreaterThan(0);
  });
});

describe('sign-up consent rules', () => {
  const base = {
    acceptedTermsAndPrivacy: false,
    transactionalNotifications: false,
    marketingCommunications: false,
  };

  it('records nothing and blocks sign-up when Terms + Privacy are not accepted', () => {
    const res = buildSignUpConsentDecisions(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('terms_not_accepted');
  });

  it('produces separate terms and privacy records from the single required checkbox', () => {
    const res = buildSignUpConsentDecisions({ ...base, acceptedTermsAndPrivacy: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const terms = res.decisions.find((d) => d.consentType === 'terms_of_service');
    const privacy = res.decisions.find((d) => d.consentType === 'privacy_notice');
    expect(terms).toEqual({
      consentType: 'terms_of_service',
      granted: true,
      documentVersion: TERMS_VERSION,
    });
    expect(privacy).toEqual({
      consentType: 'privacy_notice',
      granted: true,
      documentVersion: PRIVACY_VERSION,
    });
  });

  it('keeps transactional and marketing consent independent and records refusals', () => {
    const res = buildSignUpConsentDecisions({
      acceptedTermsAndPrivacy: true,
      transactionalNotifications: true,
      marketingCommunications: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const by = (t: string) => res.decisions.find((d) => d.consentType === t)?.granted;
    expect(by('transactional_notifications')).toBe(true);
    expect(by('marketing_communications')).toBe(false); // refusal is itself evidence
    expect(res.decisions).toHaveLength(APP_CONSENT_TYPES.length);
  });

  it('marketing opt-in never implies transactional and vice versa', () => {
    const marketingOnly = buildSignUpConsentDecisions({
      acceptedTermsAndPrivacy: true,
      transactionalNotifications: false,
      marketingCommunications: true,
    });
    expect(marketingOnly.ok).toBe(true);
    if (!marketingOnly.ok) return;
    const by = (t: string) => marketingOnly.decisions.find((d) => d.consentType === t)?.granted;
    expect(by('marketing_communications')).toBe(true);
    expect(by('transactional_notifications')).toBe(false);
  });

  it('derives a deterministic idempotency key per user + type + version', () => {
    const k1 = signUpConsentIdempotencyKey('user-1', 'terms_of_service', TERMS_VERSION);
    const k2 = signUpConsentIdempotencyKey('user-1', 'terms_of_service', TERMS_VERSION);
    const k3 = signUpConsentIdempotencyKey('user-1', 'privacy_notice', PRIVACY_VERSION);
    const k4 = signUpConsentIdempotencyKey('user-2', 'terms_of_service', TERMS_VERSION);
    expect(k1).toBe(k2); // retried submission must not duplicate evidence
    expect(new Set([k1, k3, k4]).size).toBe(3);
    expect(k1).toBe(`sign_up:user-1:terms_of_service:${TERMS_VERSION}`);
  });
});

describe('consent + footer copy', () => {
  it('offers bilingual, distinguishable transactional vs marketing labels', () => {
    for (const locale of LOCALES) {
      const c = CONSENT_COPY[locale];
      expect(c.termsCheckbox.length).toBeGreaterThan(0);
      expect(c.transactionalCheckbox).not.toBe(c.marketingCheckbox);
      expect(c.marketingHint.length).toBeGreaterThan(0);
      expect(c.termsLink.length).toBeGreaterThan(0);
      expect(c.privacyLink.length).toBeGreaterThan(0);
    }
  });

  it('exposes both public legal routes for the footer', () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual(['/terms', '/privacy']);
  });
});
