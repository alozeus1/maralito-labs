import 'server-only';

/**
 * Post-delivery review-request email copy. Localized (Spanish default, per ADR-0009 i18n), rendered
 * server-side so the app owns the message content and the review link — n8n is only the scheduler.
 * Escapes all interpolated values (name, order ref, URL) before embedding in HTML.
 */
export interface ReviewEmailInput {
  locale: 'en' | 'es';
  customerName?: string | null;
  orderRef: string;
  reviewUrl: string;
}

const COPY = {
  en: {
    subject: (ref: string) => `How did we do with order ${ref}?`,
    greeting: (name: string) => `Hi ${name},`,
    greetingNoName: 'Hi there,',
    body: 'Your BorderPass order was delivered — we hope everything arrived just as you expected. If we made your cross-border shopping easier, a short review would mean a lot and helps other shoppers find us.',
    cta: 'Leave a review',
    thanks: 'Thank you for trusting BorderPass.',
    sign: 'The BorderPass team',
  },
  es: {
    subject: (ref: string) => `¿Qué te pareció tu pedido ${ref}?`,
    greeting: (name: string) => `Hola ${name}:`,
    greetingNoName: 'Hola:',
    body: 'Tu pedido de BorderPass fue entregado y esperamos que todo haya llegado tal como lo esperabas. Si te facilitamos tus compras transfronterizas, una breve reseña significaría mucho y ayuda a otras personas a encontrarnos.',
    cta: 'Dejar una reseña',
    thanks: 'Gracias por confiar en BorderPass.',
    sign: 'El equipo de BorderPass',
  },
} as const;

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

export function buildReviewEmail(input: ReviewEmailInput): { subject: string; html: string } {
  const t = COPY[input.locale];
  const name = input.customerName?.trim();
  const greeting = name ? t.greeting(escapeHtml(name)) : t.greetingNoName;
  const ref = escapeHtml(input.orderRef);
  // escapeHtml also encodes `&` → `&amp;`, which is the correct form for a URL inside an href attribute.
  const href = escapeHtml(input.reviewUrl);

  const html =
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1b1b1b;line-height:1.5">' +
    `<p>${greeting}</p>` +
    `<p>${t.body}</p>` +
    `<p style="margin:28px 0"><a href="${href}" style="background:#a33e06;color:#fff8f6;text-decoration:none;padding:12px 22px;border-radius:9999px;display:inline-block;font-weight:600">${t.cta}</a></p>` +
    `<p style="color:#565e74;font-size:14px;margin-top:32px">Order ${ref}</p>` +
    `<p style="color:#565e74;font-size:14px">${t.thanks}<br>${t.sign}</p>` +
    '</div>';

  return { subject: t.subject(input.orderRef), html };
}
