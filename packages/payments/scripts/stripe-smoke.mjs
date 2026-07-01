// Phase 7 — Stripe TEST-mode smoke (ADR-0013). Runs the OFFLINE-verifiable checks here; the live
// PaymentIntent + webhook round-trip is an OPERATOR step (Stripe CLI) documented in
// docs/phase-7/stripe-test-mode-runbook.md. This NEVER contacts live Stripe, NEVER stores card data,
// and uses Stripe TEST objects only. It refuses a live (sk_live_) key.
//   Run: STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... pnpm --filter @maralito/payments stripe:smoke
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cfg = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/stripe/config.ts'), 'utf8');
const pinned = (cfg.match(/DEFAULT_STRIPE_API_VERSION\s*=\s*'([^']+)'/) || [])[1] ?? 'unknown';

let fail = 0;
const line = (ok, name, note = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ' — ' + note : ''}`); };

const sk = process.env.STRIPE_SECRET_KEY, wh = process.env.STRIPE_WEBHOOK_SECRET;
line(!!sk && !!wh, '1 STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET present', (!sk || !wh) ? 'set TEST-mode env to run offline checks' : '');
if (sk) {
  if (sk.startsWith('sk_live_')) line(false, '2 secret key is TEST mode (sk_test_)', 'LIVE key detected — REFUSED; use sk_test_ only');
  else line(sk.startsWith('sk_test_'), '2 secret key is TEST mode (sk_test_)', sk.startsWith('sk_test_') ? '' : 'not an sk_test_ key');
}

const configuredVer = process.env.STRIPE_API_VERSION || pinned;
line(configuredVer === pinned, `3 API version matches pinned default (${pinned})`, configuredVer === pinned ? '' : `configured=${configuredVer}; VERIFY against Stripe dashboard`);

if (wh && sk && !sk.startsWith('sk_live_')) {
  try {
    const stripe = new Stripe(sk);
    const payload = JSON.stringify({ id: 'evt_smoke', type: 'payment_intent.succeeded', data: { object: { id: 'pi_smoke' } } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: wh });
    const ev = stripe.webhooks.constructEvent(payload, header, wh);
    line(ev.id === 'evt_smoke', '4 webhook signature verify (offline, no network)');
    let threw = false; try { stripe.webhooks.constructEvent(JSON.stringify({ id: 'tampered' }), header, wh); } catch { threw = true; }
    line(threw, '5 tampered payload rejected (fail closed)');
  } catch (e) { line(false, '4 webhook signature verify (offline)', String(e)); }
} else {
  console.log('SKIP  4-5 offline signature verify — needs STRIPE_WEBHOOK_SECRET + sk_test_ key');
}

console.log('\n== Operator-run (REAL Stripe TEST mode — NOT executed here) ==');
[
  'stripe login   (test mode)',
  'stripe listen --forward-to http://localhost:3000/api/stripe/webhook   (copy the whsec_ into STRIPE_WEBHOOK_SECRET)',
  'Initiate payment for an accepted quote → confirm with test card 4242 4242 4242 4242',
  'Confirm webhook payment_intent.succeeded → order awaiting_payment → paid',
  'Confirm receipt notification_outbox row queued',
  `Confirm Stripe dashboard API version matches pinned ${pinned} (or set STRIPE_API_VERSION)`,
].forEach((s) => console.log('  [ ] ' + s));

console.log(`\n${fail === 0 ? '✅ offline checks passed' : '❌ ' + fail + ' offline check(s) failed'} — live Stripe TEST-mode smoke remains OPERATOR-run (not executed here).`);
process.exit(fail === 0 ? 0 : 1);
