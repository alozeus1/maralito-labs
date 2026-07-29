/**
 * LEGAL REVIEW REQUIRED — public entry point for the versioned legal copy.
 *
 * Everything exported here is a TEMPLATE pending review by a qualified lawyer for Mexican
 * (LFPDPPP / consumer protection) and U.S. requirements. See docs/production-readiness/legal-consent.md.
 *
 * Pure module: no server imports, no DB, no React. Safe to import from server components, client
 * components, and tests alike.
 */
import { PRIVACY, PRIVACY_VERSION } from './privacy';
import { TERMS, TERMS_VERSION } from './terms';
import {
  DEFAULT_LEGAL_LOCALE,
  isLegalLocale,
  type LegalDocument,
  type LegalDocumentByLocale,
  type LegalDocumentKind,
  type LegalLocale,
} from './types';

export * from './types';
export * from './consent';
export { TERMS, TERMS_VERSION } from './terms';
export { PRIVACY, PRIVACY_VERSION } from './privacy';

const DOCUMENTS: Readonly<Record<LegalDocumentKind, LegalDocumentByLocale>> = {
  terms: TERMS,
  privacy: PRIVACY,
};

/** Narrow an arbitrary UI locale (or an unknown cookie value) to a locale we actually have copy for. */
export function resolveLegalLocale(value: string | undefined): LegalLocale {
  return isLegalLocale(value) ? value : DEFAULT_LEGAL_LOCALE;
}

/** The document to render. Unknown/unsupported locales fall back to Spanish (primary market). */
export function getLegalDocument(
  kind: LegalDocumentKind,
  locale: string | undefined,
): LegalDocument {
  return DOCUMENTS[kind][resolveLegalLocale(locale)];
}

/** Version currently in force for a document kind — this is what gets stored on a consent record. */
export function getLegalDocumentVersion(kind: LegalDocumentKind): string {
  return kind === 'terms' ? TERMS_VERSION : PRIVACY_VERSION;
}
