# Phase 8C (start) — Resend email dispatch + Google sign-in

> **Status:** foundation started 2026-07-08 (dev-only). Both features are wired app-side but stay
> **dark/inert** until the owner adds the credentials below. Development-only · synthetic-only ·
> no real PII · no live payments.

## A. Resend email dispatch (notification outbox → real sends)

**What's implemented (app-side, safe to ship):**
- `apps/borderpass/src/server/resend.ts` — provider transport (`sendEmail`) over the Resend REST API;
  no SDK; reads `RESEND_API_KEY` + `RESEND_FROM_EMAIL`; retryable-vs-terminal error classification;
  never logs the body/recipient.
- `apps/borderpass/src/server/notification-dispatch.ts` — `dispatchQueuedNotifications()` reads
  `queued` outbox rows, claims each `queued → sending` (no double-send), renders a **minimal non-PII**
  body (links to the order; no names/amounts/addresses), sends, then marks `sent`/`failed` (retryable
  failures return to `queued`). Notification statuses extended to `queued|sending|sent|failed`
  (text column, no migration).
- `.env.example` already lists `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

**Ships dark by design:** with no `RESEND_API_KEY`/`RESEND_FROM_EMAIL` set, dispatch is a no-op. And the
recipient resolver is **injected** — with no resolver, every row is skipped, never sent.

**⛔ PII gate (ADR-0014 / Phase 8B):** the outbox stores **no recipient address** on purpose. Turning a
row into an email needs the customer's real contact info = **real PII**, which stays gated on **8B (KMS)**
+ consent/opt-out handling. So a **real-recipient resolver is NOT wired here** — only a synthetic/dev
resolver may be used until 8B is validated.

**Owner steps to activate (dev/synthetic):**
1. Resend → API Keys → create a Sending key (`re_…`).
2. Verify a sender domain (SPF/DKIM) or use `onboarding@resend.dev` for dev.
3. Set `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in the app env (`.env.local` + Vercel Preview, server-only).
4. Provide a trigger for `dispatchQueuedNotifications` (dev: a script/route; later: a cron/queue worker)
   with a **synthetic** `resolveRecipient`. Real-customer sending waits on 8B.

## B. Google sign-in

**What's implemented (app-side, safe):**
- `apps/borderpass/app/(auth)/login/page.tsx` — a **"Continue with Google"** button calling
  `signInWithOAuth({ provider: 'google', redirectTo: <origin>/auth/callback })`. The existing
  `/auth/callback` already exchanges the OAuth `code` for a session and runs the same idempotent
  provisioning as magic-link — so **no other app change is needed**.

**Ships inert:** until the Google provider is enabled in Supabase, the button returns a safe error.

**Owner steps to activate:**
1. Google Cloud Console → create an OAuth 2.0 Client (Web); authorized redirect URI =
   `https://rupqejwzmwfspvbmkmai.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Sign In / Providers → **Google** → enable, paste Client ID + Secret.
3. Ensure the app origins (localhost + the stable preview `https://borderpass-dev.vercel.app`) are in
   Supabase redirect URLs (same list used for magic-link).

## Guardrails (unchanged)
Synthetic data only · no real PII until 8B/KMS · no live payments · both features inert until the owner
adds credentials. No app behavior changes for existing magic-link auth or payments.
