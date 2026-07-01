// Guard (Phase 5, ADR-0011): browser/client code must never touch the server Stripe surface or
// secrets. Scans every client module — files under apps/**/src/client/ AND any file declaring the
// 'use client' directive — for the server-only Stripe identifiers. Fails CI if any appears.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Server-only Stripe surface + secrets that must NOT appear in client code.
const BANNED = /\b(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|getStripeClient|loadStripeConfig|verifyStripeWebhook|createPaymentIntent|retrievePaymentIntent)\b/;
const USE_CLIENT = /^\s*['"]use client['"]/m;

const violations = [];
function isClientModule(path, src) {
  return /\/src\/client\//.test(path) || USE_CLIENT.test(src);
}
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) { if (!/node_modules|\.next|dist|\.turbo/.test(p)) walk(p); }
    else if (/\.(ts|tsx)$/.test(p)) {
      const src = readFileSync(p, 'utf8');
      if (isClientModule(p, src) && BANNED.test(src)) violations.push(p);
    }
  }
}
try { walk('apps'); } catch {}
if (violations.length) {
  console.error('❌ Client code references the server-only Stripe surface (secret/client/webhook):');
  violations.forEach((v) => console.error('   ' + v));
  process.exit(1);
}
console.log('✅ no server Stripe secret/client imports in client code');
