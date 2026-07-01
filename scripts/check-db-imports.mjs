// Guard: tenant-facing code (apps/**) must use withTenant/withPrivilegedDbAccess — never the raw
// DB client. Fails CI if createRawDbClient / createDbClient / getDb appears in apps/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = /\b(createRawDbClient|createDbClient|getDb)\b/;
const violations = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (!/node_modules|\.next|dist|\.turbo/.test(p)) walk(p);
    } else if (/\.(ts|tsx)$/.test(p) && BANNED.test(readFileSync(p, 'utf8'))) violations.push(p);
  }
}
try {
  walk('apps');
} catch {}
if (violations.length) {
  console.error(
    '❌ Raw DB client used in tenant-facing code (use withTenant/withPrivilegedDbAccess):',
  );
  violations.forEach((v) => console.error('   ' + v));
  process.exit(1);
}
console.log('✅ no raw DB client imports in apps/');
