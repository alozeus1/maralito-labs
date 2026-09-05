// @vitest-environment node
//
// This suite reads real source files off disk. The project default is `jsdom`, where
// `import.meta.url` is an http(s) URL, so `fileURLToPath` throws "The URL must be of scheme file".
// Node is also the honest environment here — nothing under test touches the DOM.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Defect D2 regression lock — `/api/automation/*` must bypass the auth-redirect gate.
 *
 * The n8n workflows call `/api/automation/*` with no session cookie. Before the fix those paths were
 * absent from `PUBLIC_PREFIXES`, so the middleware 302'd them to `/login`: the workflow then received
 * an HTML login page with a 200 after the redirect and "succeeded" while doing nothing. Authentication
 * for these routes is the shared secret checked inside each handler, not a session.
 *
 * WHY THIS TEST READS THE SOURCE: `middleware.ts` cannot be imported here — it pulls in `next/server`
 * and `@supabase/ssr` at module scope, and `isPublic` is module-private (exporting extra symbols from
 * a Next middleware file is not something a test should force). So this test extracts the REAL
 * `PUBLIC_PREFIXES` literal and the REAL `isPublic` expression out of `apps/borderpass/middleware.ts`
 * and evaluates them verbatim. Nothing is re-implemented: change the predicate or drop the prefix in
 * the source and these tests fail.
 */

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MIDDLEWARE_SOURCE = readFileSync(`${APP_ROOT}middleware.ts`, 'utf8');

/** `const PUBLIC_PREFIXES = [ ... ];` — comments and trailing commas included, verbatim. */
function extractPublicPrefixes(source: string): string[] {
  const match = /const PUBLIC_PREFIXES\s*=\s*(\[[\s\S]*?\n\]);/.exec(source);
  if (!match || match[1] === undefined) {
    throw new Error('could not locate the PUBLIC_PREFIXES literal in middleware.ts');
  }
  const value: unknown = new Function(`return (${match[1]});`)();
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new Error('PUBLIC_PREFIXES is not a string[]');
  }
  return value as string[];
}

/**
 * `const isPublic = (p: string) => <expr>;` — capture the parameter name and the body expression so
 * the (TypeScript-annotated) real predicate can be evaluated as plain JS without rewriting it.
 */
function extractIsPublic(source: string, prefixes: readonly string[]): (p: string) => boolean {
  const match = /const isPublic\s*=\s*\(\s*(\w+)\s*:\s*string\s*\)\s*=>\s*([\s\S]*?);\n/.exec(
    source,
  );
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error('could not locate the isPublic predicate in middleware.ts');
  }
  const [, param, body] = match;
  const fn = new Function('PUBLIC_PREFIXES', param, `return (${body});`) as (
    prefixes: readonly string[],
    p: string,
  ) => unknown;
  return (p: string) => fn(prefixes, p) === true;
}

const PUBLIC_PREFIXES = extractPublicPrefixes(MIDDLEWARE_SOURCE);
const isPublic = extractIsPublic(MIDDLEWARE_SOURCE, PUBLIC_PREFIXES);

/** Every `app/api/automation/<name>/route.ts` actually on disk. */
function automationRoutePaths(): string[] {
  return readdirSync(`${APP_ROOT}app/api/automation`, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `/api/automation/${e.name}`);
}

describe('middleware isPublic() — D2: /api/automation must bypass the login redirect', () => {
  it('extracted the real predicate and prefixes from middleware.ts', () => {
    expect(PUBLIC_PREFIXES.length).toBeGreaterThan(0);
    expect(typeof isPublic).toBe('function');
    // Sanity: the extraction is live, not a stale copy.
    expect(MIDDLEWARE_SOURCE).toContain('PUBLIC_PREFIXES.some');
  });

  it("lists '/api/automation' as a public prefix", () => {
    expect(PUBLIC_PREFIXES).toContain('/api/automation');
  });

  it('classifies every automation route on disk as public', () => {
    const routes = automationRoutePaths();
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(isPublic(route)).toBe(true);
    }
  });

  it('classifies the automation prefix itself and deeper paths as public', () => {
    expect(isPublic('/api/automation')).toBe(true);
    expect(isPublic('/api/automation/')).toBe(true);
    expect(isPublic('/api/automation/dispatch-notifications')).toBe(true);
    expect(isPublic('/api/automation/a/b/c')).toBe(true);
  });

  it('does NOT treat sibling paths that merely share the prefix string as public', () => {
    // The `startsWith(x + '/')` boundary is what stops these. A bare `startsWith(x)` would leak them.
    for (const path of [
      '/api/automationXYZ',
      '/api/automation-internal',
      '/api/automation.json',
      '/api/automations',
      '/api/automations/secret',
      '/api/automationadmin',
    ]) {
      expect(isPublic(path)).toBe(false);
    }
  });

  it('enforces the segment boundary for EVERY public prefix, not just automation', () => {
    // General property: appending characters to a prefix without a `/` must never stay public.
    for (const prefix of PUBLIC_PREFIXES) {
      expect(isPublic(`${prefix}X`)).toBe(false);
      expect(isPublic(`${prefix}-evil`)).toBe(false);
      expect(isPublic(`${prefix}.json`)).toBe(false);
    }
  });

  it('still redirects protected customer and admin paths', () => {
    for (const path of [
      '/',
      '/orders',
      '/orders/ord_123',
      '/admin',
      '/admin/orders',
      '/admin/orders/ord_123',
      '/account',
      '/api/orders',
      '/api/quotes',
      '/api/admin/orders',
    ]) {
      expect(isPublic(path)).toBe(false);
    }
  });

  it('is case-sensitive, so a cased variant cannot be used to widen the bypass', () => {
    expect(isPublic('/API/AUTOMATION/dispatch-notifications')).toBe(false);
    expect(isPublic('/Api/Automation/dispatch-notifications')).toBe(false);
  });

  it('cannot be used to reach a protected path via dot-segments', () => {
    // `req.nextUrl.pathname` is WHATWG-URL normalised before the predicate ever sees it, so `..`
    // (raw or percent-encoded) collapses away from the automation prefix rather than smuggling it.
    const normalise = (raw: string) => new URL(raw, 'http://localhost').pathname;
    expect(normalise('/api/automation/../orders')).toBe('/api/orders');
    expect(normalise('/api/automation/%2e%2e/orders')).toBe('/api/orders');
    expect(isPublic(normalise('/api/automation/../orders'))).toBe(false);
    expect(isPublic(normalise('/api/automation/%2e%2e/orders'))).toBe(false);
    expect(isPublic(normalise('/api/automation/../../admin'))).toBe(false);
  });

  it('keeps the other unauthenticated-by-design webhook prefixes public', () => {
    // These share D2's failure mode (no session cookie, own signature check) — regressing any of
    // them reintroduces the same silent-HTML-redirect bug on a different integration.
    expect(isPublic('/api/stripe/webhook')).toBe(true);
    expect(isPublic('/api/webhooks/resend')).toBe(true);
    expect(isPublic('/api/health')).toBe(true);
    expect(isPublic('/api/healthz')).toBe(false);
  });

  it('runs the middleware matcher over /api/automation at all', () => {
    // The bypass is worthless if the matcher skipped the path (it would then never be gated OR
    // rewritten). Assert the matcher only excludes Next internals and static assets.
    const matcher = /matcher:\s*\[([^\]]*)\]/.exec(MIDDLEWARE_SOURCE);
    expect(matcher).not.toBeNull();
    const raw = matcher?.[1] ?? '';
    expect(raw).toContain('_next/static');
    expect(raw).not.toContain('api');
  });
});
