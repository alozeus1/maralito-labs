import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@maralito/auth';
import { getServerEnv } from './env';

/** Request-scoped server Supabase client (ANON key + cookies → RLS sees the user). */
export async function getServerSupabase(): Promise<SupabaseClient> {
  const env = getServerEnv();
  const store = await cookies();
  return createSupabaseServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (cs) => {
        try {
          cs.forEach((c) => store.set({ name: c.name, value: c.value, ...c.options }));
        } catch {
          /* setAll called from a Server Component — safe to ignore (middleware refreshes). */
        }
      },
    },
  );
}
