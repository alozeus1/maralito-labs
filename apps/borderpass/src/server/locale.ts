import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n';

// Resolve the UI locale for the current request from the bp_locale cookie (set by the client
// LocaleToggle). Defaults to Spanish. Server-only — read in Server Components / the root layout.
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
