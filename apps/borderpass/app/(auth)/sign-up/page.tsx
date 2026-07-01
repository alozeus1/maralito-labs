'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@maralito/auth';

export default function SignUp() {
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
      options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr('Could not start sign-up. Please try again.');
    else setSent(true);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Create your account</h1>
      {sent ? (
        <p className="text-on-surface-variant mt-3">Check your email to finish signing up.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label htmlFor="email" className="block text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface-variant w-full rounded-md p-3"
          />
          <button type="submit" className="bg-primary text-on-primary w-full rounded-3xl p-3">
            Continue
          </button>
          {err && (
            <p role="alert" className="text-error text-sm">
              {err}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
