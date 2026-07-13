import { describe, it, expect } from 'vitest';
import { buildReviewEmail } from './review-email';

describe('buildReviewEmail', () => {
  it('renders Spanish copy by default locale with the review link and name', () => {
    const { subject, html } = buildReviewEmail({
      locale: 'es',
      customerName: 'María',
      orderRef: 'BP-1042',
      reviewUrl: 'https://example.com/review?o=1',
    });
    expect(subject).toBe('¿Qué te pareció tu pedido BP-1042?');
    expect(html).toContain('Hola María:');
    expect(html).toContain('Dejar una reseña');
    // `&` in the URL is HTML-encoded for the href attribute.
    expect(html).toContain('href="https://example.com/review?o=1"');
    expect(html).toContain('BP-1042');
  });

  it('renders English copy and a nameless greeting when no name is present', () => {
    const { subject, html } = buildReviewEmail({
      locale: 'en',
      customerName: null,
      orderRef: 'BP-2001',
      reviewUrl: 'https://example.com/r',
    });
    expect(subject).toBe('How did we do with order BP-2001?');
    expect(html).toContain('Hi there,');
    expect(html).toContain('Leave a review');
  });

  it('escapes HTML in interpolated values (no injection via name)', () => {
    const { html } = buildReviewEmail({
      locale: 'en',
      customerName: '<script>alert(1)</script>',
      orderRef: 'BP-3',
      reviewUrl: 'https://example.com/r',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('encodes ampersands in the review URL so multi-param links survive as an href', () => {
    const { html } = buildReviewEmail({
      locale: 'es',
      customerName: 'Ana',
      orderRef: 'BP-9',
      reviewUrl: 'https://g.example/review?a=1&b=2',
    });
    expect(html).toContain('href="https://g.example/review?a=1&amp;b=2"');
  });
});
