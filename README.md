# Maralito Monorepo — BorderPass

**BorderPass** is a premium cross-border shopping concierge for customers in Ciudad Juárez who shop
from U.S. stores without crossing the border. It is the **first app** on the shared **Maralito
Platform** + **Maralito Automation Platform**. *Maralito Labs* is the parent company — used only as
"Powered by Maralito Labs" in welcome/footer/about/settings.

> **Status:** Phase 0 (foundation) scaffolded. No business flows yet. See `docs/phase-0/`.

## Layout
```
apps/borderpass/        # single Next.js App Router app — (public)(auth)(customer)(admin) route groups
packages/               # shared, reusable for future Maralito apps:
  config ui validation sdk db auth payments notifications automation ai observability
docs/                   # all planning + architecture docs (see docs/README.md)
spike/                  # Phase 0 spike (LangGraph × Inngest)
.github/workflows/      # security-gated CI
```

## Locked stack
Next.js + TypeScript + Tailwind · Next.js BFF · **Supabase** (Postgres + Auth + Storage) + **Drizzle**
· Stripe · Resend + Twilio/WhatsApp · **Inngest** · LangGraph via the AI gateway · PostHog · Sentry/OTel
· Vercel · GitHub Actions. (ADRs in `docs/decisions/adr/`.)

## Develop (after `pnpm install` in a real env)
```
pnpm dev          # run apps
pnpm typecheck    # strict TS
pnpm lint         # eslint
pnpm test         # vitest
pnpm build        # turbo build
```
Copy `.env.example` → `.env.local` and fill via your secret manager. **Never commit secrets.**

## Principles
Thin app, fat platform · RBAC + RLS (double enforcement) · audit sensitive actions · **AI is
human-in-the-loop** for risky/compliance/payment/refund actions · mobile-first · bilingual EN/ES ·
no provider keys in app (AI via gateway).
