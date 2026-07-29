#!/usr/bin/env node
/**
 * CI guard (Phase 9 / defect D4).
 *
 * Some server modules cannot use the `server-only` marker package because they are imported by
 * `middleware.ts`, which Next.js evaluates in the EDGE runtime. `server-only` resolves to its
 * throwing `index.js` outside the `react-server` export condition, so importing it there crashes
 * every request. Those modules are listed in EDGE_SAFE_SERVER_MODULES below.
 *
 * Losing `server-only` means losing its compile-time protection against a module reaching the client
 * bundle. This guard restores an equivalent protection: it fails the build if any Client Component
 * (a file whose first meaningful line is `'use client'`) imports one of those modules, directly or
 * via the `@/server/...` alias.
 *
 * It also asserts the inverse invariant: those modules must NOT (re-)introduce `import 'server-only'`.
 *
 * Usage: node scripts/check-server-only-boundary.mjs   (or: pnpm check:server-only)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP_DIR = resolve('apps/borderpass');

/** Server modules that are edge-imported and therefore must stay `server-only`-free. */
const EDGE_SAFE_SERVER_MODULES = [
  { file: 'src/server/rate-limit.ts', specifiers: ['@/server/rate-limit', './rate-limit', '../server/rate-limit'] },
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** A Client Component declares 'use client' before any import. */
function isClientComponent(src) {
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    return /^['"]use client['"]\s*;?$/.test(line);
  }
  return false;
}

let failures = 0;
const files = walk(APP_DIR);

// 1) No Client Component may import an edge-safe server module.
for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!isClientComponent(src)) continue;
  for (const mod of EDGE_SAFE_SERVER_MODULES) {
    for (const spec of mod.specifiers) {
      const re = new RegExp(`from\\s+['"]${spec.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`);
      if (re.test(src)) {
        failures++;
        console.error(
          `❌ Client Component imports a server module: ${relative(process.cwd(), file)} imports "${spec}" (${mod.file}).\n` +
            '   That module has no `server-only` marker (it is edge-imported by middleware), so nothing\n' +
            '   else stops it reaching the client bundle. Move the call to a server action or route handler.',
        );
      }
    }
  }
}

// 2) Edge-safe modules must not (re-)introduce `import 'server-only'`.
for (const mod of EDGE_SAFE_SERVER_MODULES) {
  const path = join(APP_DIR, mod.file);
  let src;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    failures++;
    console.error(`❌ Missing edge-safe server module: ${mod.file}`);
    continue;
  }
  if (/^\s*import\s+['"]server-only['"]/m.test(src)) {
    failures++;
    console.error(
      `❌ ${mod.file} imports 'server-only', but it is imported by middleware (edge runtime).\n` +
        "   'server-only' resolves to a throwing module outside the react-server condition, so this\n" +
        '   would crash every request. Remove it; this guard provides the client-bundle protection.',
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} server-only boundary violation(s).`);
  process.exit(1);
}
console.log(
  `✅ server-only boundary OK (${EDGE_SAFE_SERVER_MODULES.length} edge-safe module(s); no client imports, no throwing marker)`,
);
