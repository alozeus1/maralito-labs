#!/usr/bin/env node
/**
 * CANONICAL RLS POLICY REGISTRY — the single source of truth for which policy files exist and the
 * order they must be applied in. (Phase 9 / defect D1.)
 *
 * WHY THIS EXISTS: the policy files were previously listed by hand in three places (the live-gate
 * script, `.github/workflows/live-gates.yml`, and `scripts/preflight.mjs`). Files were added to
 * `packages/db/src/rls/` without being added to those lists, so provisioning a fresh project silently
 * skipped them. Because a skipped file means `alter table … enable row level security` never runs,
 * the failure mode was FAIL-OPEN: tables (including PII) left with no RLS at all.
 *
 * INVARIANT (enforced by `validateRlsRegistry`, which every consumer calls):
 *   the set of `*.sql` files on disk === the set of files registered here.
 * Adding a policy file without registering it FAILS the preflight and CI. Registering a file that
 * doesn't exist also fails. There is no way to be silently partial.
 *
 * ORDER MATTERS: `policies.sql` first — it creates the helper functions (current org/user claims)
 * and the base grants that every domain file depends on. Domain files follow.
 *
 * Consumed by:
 *   - `scripts/preflight.mjs`                     (local + CI gate)
 *   - `.github/workflows/live-gates.yml`          (`--list` drives the psql apply loop)
 *   - `packages/db/scripts/live-rls-gate.ts`      (asserts coverage before running isolation checks)
 *   - `docs/production-readiness/*`               (documented provisioning order)
 *
 * CLI:
 *   node packages/db/src/rls/registry.mjs --list    # newline-separated absolute-ish paths, in order
 *   node packages/db/src/rls/registry.mjs --check   # exit 0 if registry === disk, else exit 1
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RLS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Ordered list of RLS policy files. `policies.sql` MUST stay first.
 * When you add a policy file to this directory, add it here too — otherwise preflight/CI fail.
 */
export const RLS_POLICY_FILES = [
  // Foundation: helper functions, base identity/org tables, shared grants.
  'policies.sql',
  // Domain policies (each enables RLS on its own tables and grants least privilege).
  'orders-policies.sql',
  'quotes-policies.sql',
  'payments-policies.sql',
  'notifications-policies.sql',
  'inspections-policies.sql',
  'delivery-preparations-policies.sql',
  // Added later — these were the D1 orphans (present on disk, applied by nothing).
  'addresses-policies.sql',
  'messages-policies.sql',
  'email-events-policies.sql',
  // Phase 9 additions.
  'sessions-policies.sql',
  'consents-policies.sql',
];

/** Absolute path for a registered policy file name. */
export function rlsPolicyPath(name) {
  return join(RLS_DIR, name);
}

/** All registered policy files as absolute paths, in application order. */
export function rlsPolicyPaths() {
  return RLS_POLICY_FILES.map(rlsPolicyPath);
}

/** Every `*.sql` actually present in the rls directory. */
export function rlsFilesOnDisk() {
  return readdirSync(RLS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Fail-closed validation in BOTH directions.
 * @returns {{ok: boolean, unregistered: string[], missing: string[], duplicates: string[]}}
 */
export function validateRlsRegistry() {
  const onDisk = rlsFilesOnDisk();
  const registered = RLS_POLICY_FILES;
  const registeredSet = new Set(registered);
  const diskSet = new Set(onDisk);

  const unregistered = onDisk.filter((f) => !registeredSet.has(f)); // on disk, applied by nothing
  const missing = registered.filter((f) => !diskSet.has(f)); // registered but absent
  const duplicates = registered.filter((f, i) => registered.indexOf(f) !== i);

  return {
    ok: unregistered.length === 0 && missing.length === 0 && duplicates.length === 0,
    unregistered,
    missing,
    duplicates,
  };
}

/** Throw with an actionable message when the registry and disk disagree. */
export function assertRlsRegistryValid() {
  const r = validateRlsRegistry();
  if (r.ok) return;
  const lines = ['RLS policy registry is out of sync with packages/db/src/rls/:'];
  if (r.unregistered.length) {
    lines.push(
      `  UNREGISTERED (on disk but applied by NOTHING — fail-open risk): ${r.unregistered.join(', ')}`,
      '    → add them to RLS_POLICY_FILES in packages/db/src/rls/registry.mjs (correct order).',
    );
  }
  if (r.missing.length) {
    lines.push(`  MISSING (registered but not on disk): ${r.missing.join(', ')}`);
  }
  if (r.duplicates.length) {
    lines.push(`  DUPLICATED in the registry: ${r.duplicates.join(', ')}`);
  }
  throw new Error(lines.join('\n'));
}

// ---- CLI ----------------------------------------------------------------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = process.argv[2];
  if (arg === '--list') {
    assertRlsRegistryValid(); // never emit a partial list
    console.log(rlsPolicyPaths().join('\n'));
  } else if (arg === '--names') {
    assertRlsRegistryValid();
    console.log(RLS_POLICY_FILES.join('\n'));
  } else if (arg === '--check') {
    try {
      assertRlsRegistryValid();
      console.log(`✅ RLS registry valid — ${RLS_POLICY_FILES.length} policy files registered.`);
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    console.error('usage: registry.mjs --list | --names | --check');
    process.exit(2);
  }
}
