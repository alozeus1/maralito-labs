/**
 * LEGAL REVIEW REQUIRED — shared types for the versioned legal copy in this directory.
 *
 * The copy under src/content/legal is a TEMPLATE written by engineers, not legal advice, and has
 * not been reviewed by a qualified lawyer for Mexican (LFPDPPP/LFPC) or U.S. requirements. Nothing
 * here claims compliance with any specific law. See docs/production-readiness/legal-consent.md.
 */

export const LEGAL_LOCALES = ['es', 'en'] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];
/** Spanish is the primary market language (Ciudad Juárez), so it is the fallback. */
export const DEFAULT_LEGAL_LOCALE: LegalLocale = 'es';

export const LEGAL_DOCUMENT_KINDS = ['terms', 'privacy'] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

export interface LegalSection {
  /** Stable anchor id — must be identical across locales so deep links survive a language switch. */
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDocument {
  readonly kind: LegalDocumentKind;
  /** Immutable version string, e.g. 'terms-2026-07-28'. Recorded with every consent record. */
  readonly version: string;
  readonly locale: LegalLocale;
  readonly title: string;
  /** ISO date (YYYY-MM-DD) shown as "last updated". */
  readonly lastUpdated: string;
  readonly summary: string;
  /** Visible banner stating this text is pending qualified legal review. Do not remove silently. */
  readonly reviewNotice: string;
  readonly sections: readonly LegalSection[];
}

export type LegalDocumentByLocale = Readonly<Record<LegalLocale, LegalDocument>>;

export const isLegalLocale = (v: string | undefined): v is LegalLocale =>
  !!v && (LEGAL_LOCALES as readonly string[]).includes(v);
