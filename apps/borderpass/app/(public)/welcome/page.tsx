import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';
import { LocaleToggle } from '../../_components/LocaleToggle';

export const dynamic = 'force-dynamic';

// Public welcome / onboarding. Warm hero over the El Paso ⇄ Juárez illustration, bilingual copy,
// and a single CTA into sign-in. Language toggle sets the locale for the whole app.
export default async function Welcome() {
  const locale = await getLocale();
  const m = getMessages(locale);

  return (
    <main className="px-margin-mobile mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <span className="font-heading text-primary text-xl font-bold">BorderPass</span>
        <LocaleToggle current={locale} />
      </header>

      <section className="flex flex-1 flex-col justify-center py-8">
        <div className="shadow-level-1 relative mb-8 h-56 overflow-hidden rounded-xl sm:h-72">
          <Image
            src="/img/hero-elpaso-juarez.png"
            alt="Illustration of the El Paso and Ciudad Juárez skylines connected by the international bridge at sunset"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover"
          />
        </div>
        <h1 className="font-heading text-on-surface text-4xl font-bold sm:text-5xl">BorderPass</h1>
        <p className="font-heading text-primary mt-3 text-xl sm:text-2xl">{m.welcome.tagline}</p>
        <p className="font-body text-on-surface-variant text-body-lg mt-3">{m.welcome.blurb}</p>

        <Link
          href={'/login' as Route}
          className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary mt-8 inline-flex items-center justify-center gap-2 self-start rounded-full px-8 py-4 text-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {m.welcome.getStarted}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </section>

      {/* "Powered by Maralito Labs" is permitted ONLY in welcome/footer/about/settings. */}
      <footer className="text-on-surface-variant py-2 text-center text-xs">
        Powered by Maralito Labs
      </footer>
    </main>
  );
}
