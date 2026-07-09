// Support — help center: FAQ (native accordion, no client JS) + a direct contact card. Localized.
import { Mail, ChevronDown } from 'lucide-react';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const t = getMessages(await getLocale()).support;

  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
        {t.title}
      </h1>
      <p className="font-body text-on-surface-variant text-body-md mb-md">{t.subtitle}</p>

      <div className="space-y-3">
        {t.faq.map((item) => (
          <details
            key={item.q}
            className="bg-surface-container-lowest shadow-level-1 p-md group rounded-xl"
          >
            <summary className="text-on-surface flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
              {item.q}
              <ChevronDown
                className="text-outline h-5 w-5 flex-shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="text-on-surface-variant text-body-md mt-3">{item.a}</p>
          </details>
        ))}
      </div>

      <section className="bg-secondary-container text-on-secondary-container mt-md p-md rounded-xl">
        <h2 className="font-heading text-headline-md mb-1">{t.stillNeedHelp}</h2>
        <p className="text-body-md mb-4 opacity-90">{t.stillNeedHelpBody}</p>
        <a
          href="mailto:support@maralito.uk"
          className="bg-secondary text-on-secondary focus-visible:ring-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> {t.emailSupport}
        </a>
      </section>
    </main>
  );
}
