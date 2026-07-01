import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/server/supabase';
import { auditSignIn } from '@/server/auth-events';
import { provisionAuthenticatedUser } from '@/server/provisioning';

export const dynamic = 'force-dynamic';

/** OTP/magic-link callback: exchange code → session → provision (idempotent) → audit → redirect. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  if (code) {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await provisionAuthenticatedUser(data.user.id, data.user.email ?? undefined);
      await auditSignIn(data.user.id, true);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  await auditSignIn('unknown', false);
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
