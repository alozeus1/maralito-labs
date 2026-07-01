import 'server-only'; // hard guard: throws if ever imported into a client bundle
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only, privileged ops only
 * (seed, audit writes, role administration) with explicit justification + audit.
 * NEVER expose the service-role key to the browser.
 */
export function createSupabaseServiceClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
