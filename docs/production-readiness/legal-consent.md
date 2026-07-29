# Legal & Consent Surface (BorderPass)

Status: **built, unwired, and NOT legally cleared.** Development-only, like the rest of the app.

> ## ⚠️ THIS COPY IS A TEMPLATE, NOT LEGAL ADVICE
>
> The Terms of Service and Privacy Notice in this repository were written by engineers so the
> product has a legal surface to point at and so consent can be captured and versioned. **No
> qualified lawyer has reviewed them.** They do not claim compliance with Mexico's LFPDPPP, the Ley
> Federal de Protección al Consumidor, or any U.S. federal or state requirement.
>
> Every unresolved item is marked inline with a `[ ... ]` placeholder and every source file carries a
> `LEGAL REVIEW REQUIRED` banner comment. Both public pages render a visible "pending legal review"
> banner and are `robots: noindex`. **Do not remove the banners, and do not onboard real users,
> until counsel has reviewed and signed the copy off.**

---

## 1. What was built

| File                                                    | Purpose                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/borderpass/app/(public)/terms/page.tsx`            | Public `/terms` page (no auth, no PII, noindex, draft banner) |
| `apps/borderpass/app/(public)/privacy/page.tsx`          | Public `/privacy` page (same)                                 |
| `apps/borderpass/src/content/legal/types.ts`             | Shared document types + locale narrowing                      |
| `apps/borderpass/src/content/legal/terms.ts`             | Versioned ToS copy, **es + en** (`TERMS_VERSION`)             |
| `apps/borderpass/src/content/legal/privacy.ts`           | Versioned Privacy Notice copy, **es + en** (`PRIVACY_VERSION`)|
| `apps/borderpass/src/content/legal/consent.ts`           | Pure consent rules + bilingual consent/footer copy            |
| `apps/borderpass/src/content/legal/index.ts`             | `getLegalDocument`, `resolveLegalLocale`, version helpers      |
| `apps/borderpass/src/content/legal/legal-content.test.ts`| 18 structural + consent-rule tests                            |
| `apps/borderpass/src/server/consent.ts`                  | Server seam: record / read consent (privileged writes)        |
| `packages/db/src/schema/consents.ts`                     | `consent_records` table (+ one export line in `schema/index.ts`) |
| `packages/db/src/rls/consents-policies.sql`              | RLS: read-own-only, no tenant insert/update/delete            |
| `packages/db/tests/consents-rls.isolation.test.ts`       | 9 PGlite isolation/immutability tests against the real policy |

Spanish is the primary market language, so `resolveLegalLocale` falls back to `es` for any unknown
or missing locale. Both documents exist in `es` and `en` with identical section ids (deep links
survive a language switch — enforced by test).

## 2. Data model — the consent evidence ledger

`consent_records` is **append-only evidence**, one row per decision:

- `auth_user_id`, `org_id`, `consent_type`, `document_version`, `document_locale`, `granted`,
  `source`, `idempotency_key`, `recorded_at`.
- Consent types: `terms_of_service`, `privacy_notice`, `transactional_notifications`,
  `marketing_communications`. **Transactional and marketing are deliberately separate rows** so a
  marketing withdrawal can never be read as a withdrawal of order notifications.
- **Immutable.** Withdrawal = a NEW row with `granted:false`. Nothing is ever updated or deleted.
- **No PII.** No email, phone, address, IP address, or user agent. IP/user-agent capture as consent
  evidence is deliberately deferred: those are personal data themselves and need production KMS plus
  a legal decision. **Flag for counsel: confirm whether the captured fields are sufficient proof.**
- Refusals are recorded (`granted:false`), which is itself evidence that the choice was offered.

### RLS (`packages/db/src/rls/consents-policies.sql`)

- Subject reads their own rows (`auth_user_id = auth.uid()`); `grant select` only.
- `revoke insert, update, delete ... from authenticated` — the browser cannot forge, alter, or erase
  a consent record. Verified on real Postgres (PGlite) in the isolation test.
- **Staff get no policy at all** (same stance as `addresses-policies.sql`). Compliance/ARCO retrieval
  goes through `readConsentHistoryForCompliance()` on the privileged, audited seam.
- Documented but *not* applied: an immutability TRIGGER blocking UPDATE/DELETE for every role
  including the owner connection. It would also block legitimate backfills — decide with counsel and
  the operator before enabling.

## 3. Operator actions required

1. **Generate + apply the migration** — the table does not exist yet:
   ```bash
   pnpm --filter @maralito/db db:generate   # creates the drizzle migration for consent_records
   pnpm --filter @maralito/db db:migrate
   ```
2. **Apply the new policy file** on the live project, after `policies.sql`:
   `packages/db/src/rls/consents-policies.sql` — this is now the **8th** policy file. Add it to the
   operator checklist in `docs/phase-7/live-gate-runbook.md` and consider extending
   `packages/db/scripts/live-rls-gate.ts` (owned by the Phase-7 tooling owner) to cover
   `consent_records`.
3. Nothing here changes the standing "development-only until live gates pass" position.

## 4. Wiring instructions (files the coordinator/operator must touch)

I do not own any existing auth page or layout, so nothing below is applied. These are exact,
drop-in-ready changes.

### 4.1 New file — `apps/borderpass/app/actions/consent.ts`

Sign-up completes in two steps (OTP requested on `/sign-up`, session established later by
`verifyEmailCode` / `/auth/callback`), so the checkbox state is captured at sign-up in a cookie
holding **three booleans and a locale — no PII** — and persisted on the first authenticated request.

```ts
'use server';
import { cookies } from 'next/headers';
import { getAppSession } from '@/server/auth';
import { getLocale } from '@/server/locale';
import { recordSignUpConsent, recordConsentChange } from '@/server/consent';
import { resolveLegalLocale, type AppConsentType } from '@/content/legal';

const PENDING_CONSENT_COOKIE = 'bp_pending_consent';

/** Called from the sign-up form BEFORE the OTP is requested. Stores decisions only — no PII. */
export async function stashSignUpConsent(input: {
  acceptedTermsAndPrivacy: boolean;
  transactionalNotifications: boolean;
  marketingCommunications: boolean;
}): Promise<{ ok: boolean }> {
  if (!input.acceptedTermsAndPrivacy) return { ok: false };
  const locale = resolveLegalLocale(await getLocale());
  (await cookies()).set(PENDING_CONSENT_COOKIE, JSON.stringify({ ...input, locale }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour — the OTP window
  });
  return { ok: true };
}

/** Idempotent. Call once the user is authenticated + provisioned. Safe to call on every request. */
export async function flushPendingSignUpConsent(): Promise<void> {
  const session = await getAppSession();
  if (!session) return;
  const jar = await cookies();
  const raw = jar.get(PENDING_CONSENT_COOKIE)?.value;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      acceptedTermsAndPrivacy: boolean;
      transactionalNotifications: boolean;
      marketingCommunications: boolean;
      locale: 'es' | 'en';
    };
    await recordSignUpConsent(
      { authUserId: session.sub, orgId: session.orgId, locale: parsed.locale },
      parsed,
    );
  } finally {
    jar.delete(PENDING_CONSENT_COOKIE);
  }
}

/** Later preference changes (Profile page). Always appends a new evidence row. */
export async function updateMyConsent(
  consentType: AppConsentType,
  granted: boolean,
): Promise<{ ok: boolean }> {
  const session = await getAppSession();
  if (!session) return { ok: false };
  const locale = resolveLegalLocale(await getLocale());
  const res = await recordConsentChange(
    { authUserId: session.sub, orgId: session.orgId, locale },
    { consentType, granted, source: 'profile_settings' },
  );
  return { ok: res.ok };
}
```

### 4.2 New file — `apps/borderpass/app/(auth)/sign-up/ConsentCheckboxes.tsx`

Unticked by default. Terms+Privacy is required; transactional and marketing are separate and
independent; marketing is never a condition of service.

```tsx
'use client';
import Link from 'next/link';
import type { Route } from 'next';
import { CONSENT_COPY, type LegalLocale } from '@/content/legal';

export interface ConsentState {
  acceptedTermsAndPrivacy: boolean;
  transactionalNotifications: boolean;
  marketingCommunications: boolean;
}

export function ConsentCheckboxes({
  locale,
  value,
  onChange,
  showError,
}: {
  locale: LegalLocale;
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  showError: boolean;
}) {
  const t = CONSENT_COPY[locale];
  const row = (
    key: keyof ConsentState,
    label: string,
    hint?: string,
    required?: boolean,
  ) => (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
        required={required}
        aria-describedby={hint ? `${key}-hint` : undefined}
        className="accent-primary mt-1 h-4 w-4 flex-shrink-0"
      />
      <span>
        <span className="text-on-surface">{label}</span>
        {hint && (
          <span id={`${key}-hint`} className="text-on-surface-variant mt-0.5 block text-xs">
            {hint}
          </span>
        )}
      </span>
    </label>
  );

  return (
    <fieldset className="border-outline-variant mt-4 space-y-3 rounded-xl border p-4">
      <legend className="text-on-surface-variant px-1 text-xs">{t.heading}</legend>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.acceptedTermsAndPrivacy}
          onChange={(e) => onChange({ ...value, acceptedTermsAndPrivacy: e.target.checked })}
          required
          className="accent-primary mt-1 h-4 w-4 flex-shrink-0"
        />
        <span className="text-on-surface">
          {t.termsCheckbox}{' '}
          <Link href={'/terms' as Route} className="underline underline-offset-2" target="_blank">
            {t.termsLink}
          </Link>{' '}
          ·{' '}
          <Link href={'/privacy' as Route} className="underline underline-offset-2" target="_blank">
            {t.privacyLink}
          </Link>
        </span>
      </label>

      {row('transactionalNotifications', t.transactionalCheckbox, t.transactionalHint)}
      {row('marketingCommunications', t.marketingCheckbox, t.marketingHint)}

      {showError && !value.acceptedTermsAndPrivacy && (
        <p role="alert" className="text-error text-sm">
          {t.termsRequired}
        </p>
      )}
    </fieldset>
  );
}
```

### 4.3 Edit — `apps/borderpass/app/(auth)/sign-up/page.tsx`

The page is a client component and currently has no locale. Pass one in from a small server wrapper
or read it from the `bp_locale` cookie client-side; `'es'` is the correct default.

```tsx
// add imports
import { ConsentCheckboxes, type ConsentState } from './ConsentCheckboxes';
import { stashSignUpConsent } from '../../actions/consent';

// add state
const [consent, setConsent] = useState<ConsentState>({
  acceptedTermsAndPrivacy: false,       // MUST start false — never pre-tick
  transactionalNotifications: true,     // service messages about their own orders
  marketingCommunications: false,       // MUST start false
});
const [consentError, setConsentError] = useState(false);

// at the top of submit(), before signInWithOtp:
if (!consent.acceptedTermsAndPrivacy) {
  setConsentError(true);
  return;
}
const stashed = await stashSignUpConsent(consent);
if (!stashed.ok) { setConsentError(true); return; }

// in the form JSX, directly above the submit button:
<ConsentCheckboxes locale={locale} value={consent} onChange={setConsent} showError={consentError} />
```

### 4.4 Edit — one call to flush the pending consent

Add **one line** in whichever of these the auth owner prefers (both are idempotent and safe):

- `apps/borderpass/app/actions/auth.ts`, immediately after `provisionAuthenticatedUser(...)`:
  ```ts
  await flushPendingSignUpConsent();
  ```
- and/or `apps/borderpass/app/(customer)/layout.tsx`, after the session guard, to also cover the
  emailed-link path through `/auth/callback`.

### 4.5 Footer links (public + authenticated shells)

New file `apps/borderpass/app/_components/LegalFooter.tsx`:

```tsx
import Link from 'next/link';
import type { Route } from 'next';
import { CONSENT_COPY, type LegalLocale } from '@/content/legal';

export function LegalFooter({ locale }: { locale: LegalLocale }) {
  const t = CONSENT_COPY[locale];
  return (
    <footer className="text-on-surface-variant flex items-center justify-center gap-3 py-6 text-xs">
      <Link href={'/terms' as Route} className="underline underline-offset-2">{t.termsLink}</Link>
      <span aria-hidden="true">·</span>
      <Link href={'/privacy' as Route} className="underline underline-offset-2">{t.privacyLink}</Link>
      <span aria-hidden="true">·</span>
      <span>Powered by Maralito Labs</span>
    </footer>
  );
}
```

Render it in:

- `apps/borderpass/app/(customer)/layout.tsx` — after `{children}`, before `<BottomNav />`
  (`locale` is already resolved there). Add bottom padding so the fixed nav does not cover it.
- `apps/borderpass/app/(admin)/layout.tsx` — same pattern.
- `apps/borderpass/app/(public)/welcome/page.tsx` — replace the existing "Powered by Maralito Labs"
  footer with `<LegalFooter locale={locale} />`.
- `apps/borderpass/app/(auth)/login/page.tsx` and `sign-up/page.tsx` — a plain `<a href="/terms">` /
  `<a href="/privacy">` pair is enough on the unauthenticated shells.

## 5. What legal review must resolve before real users

1. **Legal entity + registered address** (`[RAZÓN SOCIAL / ENTIDAD LEGAL PENDIENTE]`) — appears in
   both documents and is mandatory content for a Mexican `aviso de privacidad`.
2. **Governing law and venue** — currently an explicit placeholder in the Terms.
3. **Limitation of liability** — deliberately left unwritten. Mexican consumer-protection law limits
   the enforceability of certain exclusions; engineers must not invent this clause.
4. **Refund window, non-refundable amounts, and the dispute/aclaración procedure.**
5. **Prohibited-items list** — illustrative only; must be validated against U.S. export rules and
   Mexican import rules with a licensed customs broker.
6. **Retention periods** — the fiscal/accounting retention period is a placeholder.
7. **ARCO procedure and statutory response deadline** — the exact formal procedure and timeline are
   placeholders.
8. **Cross-border transfer basis** — which transfers require express consent vs. fall in a statutory
   exception.
9. **Whether the consent record fields constitute sufficient proof**, and whether IP/user-agent must
   be captured (currently deliberately not captured).
10. **Consumer-law disclosures** that a cross-border purchase-and-import service may owe in Mexico
    which are not represented here at all.

Two claims in the Privacy Notice are **engineering commitments that must stay true**: (a) card data
is handled by Stripe and never stored by BorderPass; (b) delivery address / contact PII is encrypted
at rest. (b) depends on production KMS, which is still pending — the notice must not go live before
KMS is enabled. If either stops being true, the copy becomes a false statement and must change in
the same PR.

## 6. Versioning and re-consent

`TERMS_VERSION` / `PRIVACY_VERSION` are stamped onto every consent record. Bump the version string
when the substance changes; `hasAcceptedCurrentLegalDocuments()` then returns `false` for existing
users, which is the hook for a re-consent prompt (`source: 'reconsent_prompt'`). The re-consent
**gate** itself (blocking the app until re-acceptance) is not built — follow-up.

## 7. Verification actually performed

Run in the Linux sandbox (`pnpm`/`vitest`/`next` cannot run there; these were run directly):

- `packages/db` typecheck — `tsc --noEmit -p packages/db/tsconfig.json`: **clean**.
- `apps/borderpass` typecheck — `tsc --noEmit`: **0 errors in any file added here** (8 pre-existing
  errors elsewhere: `src/server/pii-vault.ts` missing `@maralito/crypto`, `packages/observability`).
- ESLint on all added files (repo config, incl. the raw-DB-client ban): **0 errors, 0 warnings**.
- Prettier: **all added files conform**.
- `src/content/legal/legal-content.test.ts` — bundled with esbuild and executed under node with a
  vitest-compatible shim: **18/18 passed** (version format, locale fallback to `es`, es/en section
  parity, non-empty copy, draft banner present, required sections present, "never stores card data"
  assertion, unresolved-placeholder detector, sign-up consent rules, idempotency-key determinism).
- `packages/db/tests/consents-rls.isolation.test.ts` — executed the same way against **real Postgres
  (PGlite)** applying the real `policies.sql` + `consents-policies.sql`: **9/9 passed** (own-rows-only
  read, cross-customer denial, staff sees nothing, no-claims sees nothing, tenant INSERT rejected,
  tenant UPDATE rejected, tenant DELETE rejected, duplicate sign-up evidence rejected by the
  idempotency key, withdrawal appends a new row leaving the grant intact).

Not verified (cannot be, here): `pnpm build`, the real Vitest run, and anything against live
Supabase. The migration has **not** been generated or applied.
