import { createBrowserClient } from '@supabase/ssr';

/** Browser Supabase client. Uses the ANON key only (safe for the client bundle). */
export function createSupabaseBrowserClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}
