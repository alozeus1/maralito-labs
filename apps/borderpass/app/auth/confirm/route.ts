import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/server/supabase';
import { auditSignIn } from '@/server/auth-events';
import { provisionAuthenticatedUser } from '@/server/provisioning';

export const dynamic = 'force-dynamic';

/**
 * Token-hash magic-link confirm (device-independent). Unlike /auth/callback (PKCE, bound to the
 * browser that requested the link), this verifies the token server-side, so the link works even
 * when opened in a different browser/app (the common mobile case: request in Safari, open in the
 * Gmail app). Email template links here: /auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = (searchParams.get('type') ?? 'email') as EmailOtpType;
  const next = searchParams.get('next') ?? '/';
  if (tokenHash) {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      await provisionAuthenticatedUser(data.user.id, data.user.email ?? undefined);
      await auditSignIn(data.user.id, true);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  await auditSignIn('unknown', false);
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
