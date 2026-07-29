/**
 * ============================ LEGAL REVIEW REQUIRED ============================
 * Public Privacy Notice (Aviso de Privacidad) page. The copy it renders
 * (src/content/legal/privacy.ts) is a TEMPLATE written by engineers — it is NOT legal advice, has
 * NOT been reviewed by a qualified lawyer, and claims compliance with no specific law (in
 * particular, it does NOT assert LFPDPPP compliance; a Mexican "aviso de privacidad integral" has
 * mandatory content that counsel must confirm item by item).
 *
 * Two factual claims in the copy are engineering commitments that MUST stay true:
 *   1. Card data is handled by Stripe and never stored by BorderPass.
 *   2. Delivery address / contact PII is encrypted at rest (envelope encryption; production KMS is
 *      still PENDING — this notice must not go live before KMS is enabled).
 * If either changes, update the copy in the same change. See docs/production-readiness/legal-consent.md.
 * ==============================================================================
 *
 * Renders without auth and contains no user data — public, PII-free by construction.
 */
import type { Metadata } from 'next';
import { getLocale } from '@/server/locale';
import { CONSENT_COPY, getLegalDocument, resolveLegalLocale } from '@/content/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad · BorderPass',
  description: 'Aviso de Privacidad de BorderPass (borrador pendiente de revisión legal).',
  robots: { index: false, follow: false }, // draft copy — do not index until legal sign-off
};

export default async function PrivacyPage() {
  const locale = resolveLegalLocale(await getLocale());
  const doc = getLegalDocument('privacy', locale);
  const copy = CONSENT_COPY[locale];

  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
        {doc.title}
      </h1>
      <p className="text-on-surface-variant text-body-md">
        {copy.lastUpdated}: {doc.lastUpdated} · <span className="font-mono">{doc.version}</span>
      </p>
      <p className="font-body text-on-surface-variant text-body-md mt-3">{doc.summary}</p>

      {/* Draft banner — remove ONLY after qualified legal review signs the copy off. */}
      <aside
        role="note"
        className="border-error/40 bg-error-container/30 text-on-error-container mt-md p-md rounded-xl border"
      >
        <p className="text-label-md mb-1 font-semibold uppercase tracking-wide">
          {copy.reviewBadge}
        </p>
        <p className="text-body-md">{doc.reviewNotice}</p>
      </aside>

      <div className="mt-md space-y-4">
        {doc.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl"
          >
            <h2 className="font-heading text-headline-md text-on-surface mb-2">
              {section.heading}
            </h2>
            {section.paragraphs.map((p) => (
              <p key={p} className="text-on-surface-variant text-body-md mb-2 last:mb-0">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="text-on-surface-variant text-body-md mt-3 list-disc space-y-1 pl-5">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <footer className="text-on-surface-variant mt-10 text-center text-xs">
        Powered by Maralito Labs
      </footer>
    </main>
  );
}
