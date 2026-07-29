/**
 * LEGAL REVIEW REQUIRED — pure consent logic + consent UI copy (es/en).
 *
 * Pure by design (no imports outside this directory, no DB, no server): the sign-up consent rules
 * are unit-testable and the copy can be rendered from a client component. The privileged write path
 * lives in src/server/consent.ts.
 *
 * Product rules encoded here (confirm each with counsel before real users):
 *  - Terms + Privacy acceptance is REQUIRED and must be an explicit, UNTICKED checkbox. It produces
 *    TWO consent records (terms_of_service + privacy_notice) so each document version is provable
 *    independently — the versions can and will diverge.
 *  - Transactional notifications (messages about your OWN order) and marketing communications are
 *    SEPARATE decisions. Marketing must never be pre-ticked and must never be a condition of using
 *    the service.
 */
import { PRIVACY_VERSION } from './privacy';
import { TERMS_VERSION } from './terms';
import type { LegalLocale } from './types';

/**
 * Mirrors CONSENT_TYPES in packages/db/src/schema/consents.ts. Kept as a local literal union so this
 * module stays dependency-free; src/server/consent.ts asserts at compile time that the two agree.
 */
export const APP_CONSENT_TYPES = [
  'terms_of_service',
  'privacy_notice',
  'transactional_notifications',
  'marketing_communications',
] as const;
export type AppConsentType = (typeof APP_CONSENT_TYPES)[number];

export const APP_CONSENT_SOURCES = ['sign_up', 'profile_settings', 'reconsent_prompt'] as const;
export type AppConsentSource = (typeof APP_CONSENT_SOURCES)[number];

/** Versions currently in force. A bump here means existing users must re-consent. */
export const CURRENT_LEGAL_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
} as const;

/**
 * Which document version governs a given consent type. Notification preferences are governed by the
 * privacy notice (it is the document that describes transactional vs marketing messaging), so a
 * privacy bump correctly invalidates a stale notification consent.
 */
export function documentVersionForConsentType(consentType: AppConsentType): string {
  return consentType === 'terms_of_service'
    ? CURRENT_LEGAL_VERSIONS.terms
    : CURRENT_LEGAL_VERSIONS.privacy;
}

export interface ConsentDecision {
  readonly consentType: AppConsentType;
  readonly granted: boolean;
  readonly documentVersion: string;
}

export interface SignUpConsentInput {
  /** The single required checkbox covering both /terms and /privacy. Must start unticked. */
  readonly acceptedTermsAndPrivacy: boolean;
  /** Service messages about the user's own orders. */
  readonly transactionalNotifications: boolean;
  /** Promotions and offers. Optional; never pre-ticked; never a condition of service. */
  readonly marketingCommunications: boolean;
}

export type SignUpConsentResult =
  | { readonly ok: true; readonly decisions: readonly ConsentDecision[] }
  | { readonly ok: false; readonly reason: 'terms_not_accepted' };

/**
 * Turn the sign-up form state into the exact set of consent records to persist. Refuses to produce
 * anything if the required acceptance is missing — sign-up must be blocked, not silently recorded.
 * Always returns all four decisions (a declined opt-in is recorded as granted:false, which is itself
 * evidence that the choice was offered and refused).
 */
export function buildSignUpConsentDecisions(input: SignUpConsentInput): SignUpConsentResult {
  if (!input.acceptedTermsAndPrivacy) return { ok: false, reason: 'terms_not_accepted' };
  const decision = (consentType: AppConsentType, granted: boolean): ConsentDecision => ({
    consentType,
    granted,
    documentVersion: documentVersionForConsentType(consentType),
  });
  return {
    ok: true,
    decisions: [
      decision('terms_of_service', true),
      decision('privacy_notice', true),
      decision('transactional_notifications', input.transactionalNotifications),
      decision('marketing_communications', input.marketingCommunications),
    ],
  };
}

/**
 * Deterministic dedupe key for sign-up: a retried submission (double click, retried network call)
 * must NOT create a second evidence row for the same decision at the same document version.
 * Preference CHANGES made later must always append, so those callers pass their own unique key.
 */
export function signUpConsentIdempotencyKey(
  authUserId: string,
  consentType: AppConsentType,
  documentVersion: string,
): string {
  return `sign_up:${authUserId}:${consentType}:${documentVersion}`;
}

/** Bilingual copy for the sign-up consent block and the legal footer links. */
export const CONSENT_COPY = {
  es: {
    heading: 'Antes de continuar',
    termsCheckbox: 'He leído y acepto los Términos del Servicio y el Aviso de Privacidad.',
    termsRequired: 'Debes aceptar los Términos y el Aviso de Privacidad para crear tu cuenta.',
    transactionalCheckbox:
      'Quiero recibir mensajes sobre mis pedidos (cotización lista, pago, inspección y entrega).',
    transactionalHint:
      'Son avisos del servicio sobre TUS pedidos. Si los desactivas, tendrás que consultar el estado en la app.',
    marketingCheckbox: 'Quiero recibir promociones y novedades de BorderPass.',
    marketingHint: 'Opcional. Puedes cancelarlo cuando quieras y no afecta tu servicio.',
    termsLink: 'Términos del Servicio',
    privacyLink: 'Aviso de Privacidad',
    lastUpdated: 'Última actualización',
    reviewBadge: 'Borrador — pendiente de revisión legal',
  },
  en: {
    heading: 'Before you continue',
    termsCheckbox: 'I have read and accept the Terms of Service and the Privacy Notice.',
    termsRequired: 'You must accept the Terms and Privacy Notice to create your account.',
    transactionalCheckbox:
      'Send me messages about my orders (quote ready, payment, inspection, and delivery).',
    transactionalHint:
      'These are service messages about YOUR orders. If you turn them off you will need to check status in the app.',
    marketingCheckbox: 'Send me BorderPass promotions and news.',
    marketingHint: 'Optional. You can unsubscribe at any time and it does not affect your service.',
    termsLink: 'Terms of Service',
    privacyLink: 'Privacy Notice',
    lastUpdated: 'Last updated',
    reviewBadge: 'Draft — pending legal review',
  },
} as const satisfies Record<LegalLocale, Record<string, string>>;

/** Footer link labels + hrefs, so the shells can render legal links from one import. */
export const LEGAL_LINKS = [
  { href: '/terms', labelKey: 'termsLink' },
  { href: '/privacy', labelKey: 'privacyLink' },
] as const;
