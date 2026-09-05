// Phase 7 preflight (ADR-0013). Runs the LOCALLY-RUNNABLE gates and prints a checklist of the gates
// that still require a real operator/environment. Exits non-zero if any local gate fails.
// Usage: node scripts/preflight.mjs   (or: pnpm preflight)
//
// This NEVER claims a live gate passed. Operator-run gates are printed as TODO with how to run them.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

let failed = 0;
const run = (name, cmd) => {
  process.stdout.write(`• ${name} ... `);
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log('PASS');
  } catch (e) {
    failed++;
    console.log('FAIL');
    const out = (e.stdout || e.stderr || '').toString().trim();
    if (out) console.log('   ' + out.split('\n').slice(-3).join('\n   '));
  }
};
const checkFile = (name, path, mustContain = []) => {
  process.stdout.write(`• ${name} ... `);
  if (!existsSync(path)) {
    failed++;
    console.log(`FAIL (missing ${path})`);
    return;
  }
  const src = readFileSync(path, 'utf8');
  const missing = mustContain.filter((k) => !src.includes(k));
  if (missing.length) {
    failed++;
    console.log(`FAIL (missing keys: ${missing.join(', ')})`);
  } else console.log('PASS');
};

console.log('\n== Local gates (runnable in any environment) ==');
run('raw DB client guard (check:db-imports)', 'node scripts/check-db-imports.mjs');
run(
  'client Stripe boundary (check:client-stripe)',
  'node scripts/check-client-stripe-boundary.mjs',
);
run(
  'server-only boundary for edge-imported modules (check:server-only)',
  'node scripts/check-server-only-boundary.mjs',
);
checkFile('.env.example has Supabase + Stripe + DB keys', '.env.example', [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
]);
// RLS policy coverage — driven by the CANONICAL registry (Phase 9 / D1). The registry validates in
// both directions, so a policy file added to packages/db/src/rls/ without being registered (and
// therefore applied by nothing — a FAIL-OPEN risk) fails this gate.
{
  const { RLS_POLICY_FILES, validateRlsRegistry } =
    await import('../packages/db/src/rls/registry.mjs');
  const r = validateRlsRegistry();
  process.stdout.write('• RLS policy registry in sync (canonical, fail-closed) ... ');
  if (r.ok) {
    console.log(`PASS (${RLS_POLICY_FILES.length} files, application order pinned)`);
  } else {
    failed++;
    console.log('FAIL');
    if (r.unregistered.length) {
      console.log(
        `   UNREGISTERED (on disk, applied by NOTHING → those tables may end up with NO RLS): ${r.unregistered.join(', ')}`,
      );
      console.log('   → add them to RLS_POLICY_FILES in packages/db/src/rls/registry.mjs');
    }
    if (r.missing.length) console.log(`   MISSING on disk: ${r.missing.join(', ')}`);
    if (r.duplicates.length) console.log(`   DUPLICATED: ${r.duplicates.join(', ')}`);
  }
  for (const f of RLS_POLICY_FILES) {
    checkFile(`  rls/${f}`, `packages/db/src/rls/${f}`);
  }
}
checkFile('live-rls-gate script present', 'packages/db/scripts/live-rls-gate.ts', [
  'DATABASE_URL',
  'Rollback',
]);

console.log(
  '\n== Operator-run gates (REAL environment — NOT run here; see docs/phase-7/live-gate-runbook.md) ==',
);
const todo = [
  'Real `pnpm install` + commit pnpm-lock.yaml',
  'Full app build:           pnpm build',
  'Full app-server typecheck: pnpm typecheck',
  'Full Vitest suite:        pnpm test',
  'Provision live Supabase + apply migrations + ALL policies + seed',
  'Live RLS isolation gate:  DATABASE_URL=... pnpm --filter @maralito/db gate:rls',
  'OTP → provisioning → session live smoke',
  'Stripe TEST-mode smoke:   stripe listen --forward-to <app>/api/stripe/webhook + PaymentIntent confirm',
  'Stripe API-version validation (confirm pinned 2024-06-20 vs account)',
  'KMS / secret-management decision (before any real address/PII)',
  'Preview-branching decision (Supabase + Vercel)',
];
todo.forEach((t) => console.log(`  [ ] ${t}`));

console.log(
  `\n${failed === 0 ? '✅ local gates passed' : `❌ ${failed} local gate(s) failed`} — operator gates above remain UNRUN until executed in the real environment.`,
);
process.exit(failed === 0 ? 0 : 1);
