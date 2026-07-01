import { createServerClient } from '@supabase/ssr';

/** Minimal cookie adapter so this package stays framework-agnostic (the app passes Next's cookies()). */
export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

/** Server Supabase client bound to the request's cookies (RSC / route handlers). ANON key + RLS. */
export function createSupabaseServerClient(url: string, anonKey: string, cookies: CookieAdapter) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (c) => cookies.setAll(c),
    },
  });
}
