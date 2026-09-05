#!/usr/bin/env node
/**
 * Operator migration applier — a transparent alternative to `drizzle-kit migrate`.
 *
 * WHY THIS EXISTS: `drizzle-kit migrate` applies every pending migration inside ONE transaction and
 * renders progress with a spinner that overwrites the failure message. When a migration fails you get
 * `Exit status 1`, the whole batch rolls back, and the journal still shows only the last successful
 * migration — with no indication of WHICH statement failed or WHY. That is unusable for diagnosis.
 *
 * This script instead:
 *   - reads `migrations/meta/_journal.json` for the canonical order,
 *   - skips migrations already recorded in `drizzle.__drizzle_migrations`,
 *   - applies each remaining migration in its OWN transaction, together with its journal row, so a
 *     file is either fully applied and recorded, or not applied at all (no partial state),
 *   - prints the exact psql error, with file and statement context, and stops.
 *
 * The journal hash is `sha256(raw .sql file content)` — the same value drizzle-orm computes, verified
 * against the existing row for 0000. Recording it here keeps `drizzle-kit migrate` consistent
 * afterwards: it will see these migrations as applied and move on.
 *
 * Usage (DATABASE_URL must be exported; it is NEVER printed):
 *   node packages/db/scripts/apply-migrations.mjs --dry-run   # show what WOULD be applied
 *   node packages/db/scripts/apply-migrations.mjs             # apply pending migrations
 *
 * Requires the `psql` client on PATH.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is not set. Export it first (e.g. `set -a; source .env.local; set +a`).',
  );
  process.exit(1);
}

/** Run SQL through psql. Returns stdout. Throws with psql's stderr on failure. */
function psql(sql, { file = null } = {}) {
  const args = ['-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-q'];
  let tmp = null;
  if (file) {
    args.push('-f', file);
  } else {
    tmp = join(mkdtempSync(join(tmpdir(), 'mig-')), 'q.sql');
    writeFileSync(tmp, sql);
    args.push('-f', tmp);
  }
  try {
    return execFileSync('psql', [DATABASE_URL, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err.stderr || '').toString().trim();
    const e = new Error(stderr || err.message);
    e.psql = true;
    throw e;
  }
}

// ---- 1. Load the canonical order from the journal -----------------------------------------------
const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'));
const entries = journal.entries.map((e) => {
  const sqlPath = join(MIGRATIONS_DIR, `${e.tag}.sql`);
  const sql = readFileSync(sqlPath, 'utf8');
  return {
    tag: e.tag,
    when: e.when,
    sqlPath,
    hash: createHash('sha256').update(sql).digest('hex'),
  };
});

// ---- 2. Ask the database what it already has ----------------------------------------------------
psql(`create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);`);

const appliedRaw = psql(`select hash from drizzle.__drizzle_migrations;`);
const applied = new Set(
  appliedRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[0-9a-f]{64}$/.test(l)),
);

const pending = entries.filter((e) => !applied.has(e.hash));

console.log(
  `\nMigrations: ${entries.length} total · ${applied.size} already applied · ${pending.length} pending`,
);
for (const e of entries) {
  console.log(`  ${applied.has(e.hash) ? '✓ applied' : '· PENDING'}  ${e.tag}`);
}
if (pending.length === 0) {
  console.log('\n✅ Database is up to date. Nothing to do.');
  process.exit(0);
}
if (DRY_RUN) {
  console.log('\n(dry run — nothing applied)');
  process.exit(0);
}

// ---- 3. Apply each pending migration in its own transaction, with its journal row ---------------
for (const e of pending) {
  process.stdout.write(`\napplying ${e.tag} ... `);
  const body = readFileSync(e.sqlPath, 'utf8').split('--> statement-breakpoint').join('\n');
  const script = `begin;
${body}
insert into drizzle.__drizzle_migrations (hash, created_at) values ('${e.hash}', ${e.when});
commit;`;
  const tmp = join(mkdtempSync(join(tmpdir(), 'mig-')), `${e.tag}.sql`);
  writeFileSync(tmp, script);
  try {
    psql(null, { file: tmp });
    console.log('OK (applied + recorded)');
  } catch (err) {
    console.log('FAILED — rolled back, nothing recorded\n');
    console.error('─'.repeat(72));
    console.error(err.message); // psql prints file:line and the failing statement
    console.error('─'.repeat(72));
    console.error(`\nStopped at ${e.tag}. Earlier migrations remain applied and recorded.`);
    console.error('Fix the cause, then re-run this script — it resumes from here.');
    process.exit(1);
  }
}

console.log('\n✅ All pending migrations applied and recorded in drizzle.__drizzle_migrations.');
console.log('   `drizzle-kit migrate` will now see them as applied.');
