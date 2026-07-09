// Messages — concierge contact. Secure in-app threads need a messaging backend (future); until
// then this connects the customer to their concierge through real channels rather than faking chat.
import { Mail, MessageCircle, Star } from 'lucide-react';

export default function MessagesPage() {
  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
        Messages
      </h1>
      <p className="font-body text-on-surface-variant text-body-md mb-md">
        Your concierge manages your border crossing and delivery end to end.
      </p>

      <section className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl text-center">
        <div className="bg-surface-dim mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <MessageCircle className="text-on-surface-variant h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-headline-md text-on-surface">Your concierge team</h2>
        <p className="text-on-surface-variant mt-1 flex items-center justify-center gap-1 text-sm">
          <Star className="text-primary h-4 w-4" aria-hidden="true" /> Speaks English &amp; Español
        </p>
        <p className="font-body text-on-surface-variant text-body-md mx-auto mt-3 max-w-md">
          Have a question about an order? Reach us directly — secure in-app messaging is on the way.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="https://wa.me/message"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </a>
          <a
            href="mailto:support@maralito.uk"
            className="border-outline text-on-surface hover:bg-surface-variant/60 focus-visible:ring-primary inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto"
          >
            <Mail className="h-4 w-4" aria-hidden="true" /> Email
          </a>
        </div>
      </section>
    </main>
  );
}
