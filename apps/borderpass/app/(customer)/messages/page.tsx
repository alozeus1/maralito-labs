// Messages — real concierge thread. Loads the caller's RLS-scoped messages and renders a live
// thread + composer (MessageThread). A concierge intro card sits on top with an email fallback.
import { Mail, Star } from 'lucide-react';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';
import { listMyMessages } from '../../actions/messages';
import { MessageThread } from './MessageThread';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const t = getMessages(await getLocale()).messages;
  const res = await listMyMessages();
  const initial = res.ok ? (res.data ?? []) : [];

  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
        {t.title}
      </h1>
      <p className="font-body text-on-surface-variant text-body-md mb-md">{t.subtitle}</p>

      <section className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-headline-md text-on-surface">{t.conciergeTeam}</h2>
            <p className="text-on-surface-variant mt-1 flex items-center gap-1 text-sm">
              <Star className="text-primary h-4 w-4" aria-hidden="true" /> {t.speaks}
            </p>
          </div>
          <a
            href="mailto:support@maralito.uk"
            aria-label={t.email}
            className="border-outline text-on-surface hover:bg-surface-variant/60 focus-visible:ring-primary inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <p className="font-body text-on-surface-variant text-body-md mt-2">{t.reach}</p>
      </section>

      <MessageThread
        initial={initial}
        labels={{
          placeholder: t.placeholder,
          send: t.send,
          emptyThread: t.emptyThread,
          sendError: t.sendError,
        }}
      />
    </main>
  );
}
