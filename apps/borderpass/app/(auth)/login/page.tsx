'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@maralito/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const sb = createSupabaseBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr('Could not send sign-in link. Please try again.');
    else setSent(true);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Sign in</h1>
      {sent ? (
        <p className="mt-3 text-on-surface-variant">Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label htmlFor="email" className="block text-sm">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-surface-variant p-3" />
          <button type="submit" className="w-full rounded-3xl bg-primary p-3 text-on-primary">Send link</button>
          {err && <p role="alert" className="text-error text-sm">{err}</p>}
        </form>
      )}
    </main>
  );
}
