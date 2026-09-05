// @vitest-environment node
//
// This suite reads real source files off disk. The project default is `jsdom`, where
// `import.meta.url` is an http(s) URL, so `fileURLToPath` throws "The URL must be of scheme file".
// Node is also the honest environment here — nothing under test touches the DOM.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Defect D2 regression lock, part 3 — a source-level contract for `app/api/automation/*`.
 *
 * The behavioural tests (automation-routes-auth.test.ts) can only cover handlers they import. This
 * file walks the directory instead, so a NEW automation route added later is covered automatically:
 * because the middleware now lets the whole `/api/automation` prefix through unauthenticated, any
 * handler under it that forgets the shared-secret gate is directly exposed.
 */

const AUTOMATION_DIR = fileURLToPath(new URL('../../app/api/automation', import.meta.url));

/** Comments describe the guarantees; only executable code proves them. Compare against code only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const ROUTE_FILES: { name: string; source: string; code: string }[] = readdirSync(AUTOMATION_DIR, {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .map((e) => {
    const source = readFileSync(`${AUTOMATION_DIR}/${e.name}/route.ts`, 'utf8');
    return { name: e.name, source, code: stripComments(source) };
  });

describe('every /api/automation route obeys the shared-secret contract', () => {
  it('found the automation routes on disk', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(0);
  });

  for (const { name, code } of ROUTE_FILES) {
    it(`${name}: uses the shared secretOk helper (no bespoke comparison)`, () => {
      expect(code).toContain(`from '@/server/automation-auth'`);
      expect(code).toContain(`secretOk(req.headers.get('x-borderpass-secret')`);
      // A hand-rolled `===` on the secret would not be constant-time.
      expect(code).not.toMatch(/N8N_WEBHOOK_SECRET\s*===/);
      expect(code).not.toMatch(/===\s*env\.N8N_WEBHOOK_SECRET/);
    });

    it(`${name}: returns a JSON 401 on failure`, () => {
      expect(code).toMatch(
        /NextResponse\.json\(\s*\{\s*error:\s*'unauthorized'\s*\}[\s\S]{0,60}401/,
      );
      // No handler may fall back to a redirect (that is exactly the D2 failure mode).
      expect(code).not.toContain('NextResponse.redirect');
    });

    it(`${name}: performs the secret check before touching the body or any collaborator`, () => {
      const gate = code.indexOf('secretOk(');
      expect(gate).toBeGreaterThan(0);
      // Every call site that could constitute "work" must appear after the gate.
      for (const call of [
        'req.json()',
        'req.text()',
        'withPrivilegedDbAccess(',
        'dispatchQueuedNotifications(',
        'sendOrderReviewRequest(',
        'writeAudit(',
      ]) {
        const at = code.indexOf(call);
        if (at !== -1) expect(at).toBeGreaterThan(gate);
      }
    });

    it(`${name}: pins the nodejs runtime (node crypto constant-time compare)`, () => {
      expect(code).toContain(`runtime = 'nodejs'`);
      expect(code).toContain(`dynamic = 'force-dynamic'`);
    });

    it(`${name}: never logs or echoes the secret`, () => {
      expect(code).not.toMatch(/console\.(log|info|warn|error|debug)/);
      // Each secret is referenced exactly once in code: as an argument to secretOk.
      expect(code.match(/N8N_WEBHOOK_SECRET/g) ?? []).toHaveLength(1);
      expect(code.match(/x-borderpass-secret/g) ?? []).toHaveLength(1);
      const gate = code.indexOf('secretOk(');
      const gateEnd = code.indexOf(')', code.indexOf('N8N_WEBHOOK_SECRET'));
      expect(code.indexOf('x-borderpass-secret')).toBeGreaterThan(gate);
      expect(code.indexOf('N8N_WEBHOOK_SECRET')).toBeGreaterThan(gate);
      expect(gateEnd).toBeGreaterThan(gate);
    });
  }
});

describe('the shared secretOk helper itself', () => {
  const HELPER = readFileSync(
    fileURLToPath(new URL('../../src/server/automation-auth.ts', import.meta.url)),
    'utf8',
  );

  it('uses a constant-time comparison and never logs', () => {
    expect(HELPER).toContain('timingSafeEqual');
    expect(HELPER).not.toMatch(/console\./);
  });

  it('guards the length mismatch before timingSafeEqual (which throws on unequal buffers)', () => {
    const lengthGuard = HELPER.indexOf('a.length !== b.length');
    const compare = HELPER.lastIndexOf('timingSafeEqual(');
    expect(lengthGuard).toBeGreaterThan(0);
    expect(compare).toBeGreaterThan(lengthGuard);
  });
});
