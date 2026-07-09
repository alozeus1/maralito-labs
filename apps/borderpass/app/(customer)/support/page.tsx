// Support — help center: FAQ (native accordion, no client JS) + a direct contact card.
import { Mail, ChevronDown } from 'lucide-react';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does a cross-border request work?',
    a: 'Start a request, we prepare a quote covering the item, our service fee, and estimated duties. Once you accept and pay, we purchase or receive the item, inspect it in El Paso, handle the border crossing, and deliver it in Juárez.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Most orders clear the border and reach Juárez within a few days of inspection. Your order’s Journey timeline shows the current stage and what’s next.',
  },
  {
    q: 'What are the fees?',
    a: 'Each quote itemizes the service fee, delivery, inspection, and estimated import duties before you pay. Nothing is charged until you accept a quote.',
  },
  {
    q: 'Is my payment secure?',
    a: 'Payments are processed by Stripe. We never see or store your full card details.',
  },
  {
    q: 'Which items can you bring across?',
    a: 'Most retail goods for personal, gift, or business use. Restricted or prohibited items are flagged during review, and we’ll explain any issue before charging you.',
  },
];

export default function SupportPage() {
  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
        Support
      </h1>
      <p className="font-body text-on-surface-variant text-body-md mb-md">
        Answers to common questions about crossings, customs, and delivery.
      </p>

      <div className="space-y-3">
        {FAQ.map((item) => (
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
        <h2 className="font-heading text-headline-md mb-1">Still need help?</h2>
        <p className="text-body-md mb-4 opacity-90">
          Reach our concierge team and we’ll get back to you.
        </p>
        <a
          href="mailto:support@maralito.uk"
          className="bg-secondary text-on-secondary focus-visible:ring-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Email support
        </a>
      </section>
    </main>
  );
}
