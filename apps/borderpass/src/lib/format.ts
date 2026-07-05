/**
 * Tiny presentation formatters (Phase 8A.3). Pure — no I/O, no PII.
 * Locale defaults to the runtime locale (html lang is driven by profile in a later phase);
 * callers may pass an explicit BCP-47 locale. Not a full i18n layer by design.
 */

export function formatMoneyMinor(minor: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: Date | string | number, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(value: Date | string | number, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Humanize a snake_case status key for display ("awaiting_payment" → "Awaiting payment"). */
export function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
