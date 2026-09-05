import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeState, resetFakeState, wasCalled } from '../fakes/automation/state';

/**
 * Defect D2 regression lock, part 2 — behaviour of the `/api/automation/*` handlers themselves.
 *
 * The middleware bypass (see middleware-public-prefixes.test.ts) means these routes are now reachable
 * unauthenticated. That is only safe because each one FAILS CLOSED on the `x-borderpass-secret`
 * shared secret before doing any work. These tests exercise the REAL route handlers with their
 * side-effecting collaborators replaced by recorders, and assert:
 *   - missing / wrong (same length) / wrong (different length) secret  -> 401
 *   - server-side secret unset                                        -> 401 (fail closed)
 *   - every rejection is JSON, never HTML, never a 302
 *   - no collaborator (dispatcher, review sender, privileged DB, audit) is reached on rejection
 *   - a valid secret gets through
 *   - no response ever echoes either secret value
 */

// Collaborators are replaced, not the auth: `@/server/automation-auth` stays REAL in every test.
vi.mock('@/server/env', () => import('../fakes/automation/env'));
vi.mock(
  '@/server/notification-dispatch',
  () => import('../fakes/automation/notification-dispatch'),
);
vi.mock('@/server/audit', () => import('../fakes/automation/audit'));
vi.mock('@/server/review-request', () => import('../fakes/automation/review-request'));
vi.mock('@maralito/db', () => import('../fakes/automation/db'));

import { POST as dispatchNotifications } from '../../app/api/automation/dispatch-notifications/route';
import { POST as notificationStatus } from '../../app/api/automation/notification-status/route';
import { POST as reviewRequest } from '../../app/api/automation/review-request/route';

/** Obvious fakes. Never a real credential. */
const SECRET = 'test_fake_n8n_shared_secret_do_not_use_0001';
const WRONG_SAME_LENGTH = 'q'.repeat(SECRET.length);
const WRONG_DIFFERENT_LENGTH = `${SECRET}_and_then_some_extra_characters`;

type RouteCase = {
  readonly name: string;
  readonly url: string;
  readonly handler: (req: Request) => Promise<Response>;
  readonly body: unknown;
  /** The first collaborator the handler would touch if auth were skipped. */
  readonly sentinel: string;
  readonly okStatus: number;
};

const ROUTES: readonly RouteCase[] = [
  {
    name: 'dispatch-notifications',
    url: 'http://localhost/api/automation/dispatch-notifications',
    handler: dispatchNotifications,
    body: { max: 5 },
    sentinel: 'dispatchQueuedNotifications',
    okStatus: 200,
  },
  {
    name: 'notification-status',
    url: 'http://localhost/api/automation/notification-status',
    handler: notificationStatus,
    body: { id: 'ob_fake_1', status: 'delivered' },
    sentinel: 'withPrivilegedDbAccess',
    okStatus: 200,
  },
  {
    name: 'review-request',
    url: 'http://localhost/api/automation/review-request',
    handler: reviewRequest,
    body: { order_id: 'ord_fake_1' },
    sentinel: 'sendOrderReviewRequest',
    okStatus: 200,
  },
];

function request(route: RouteCase, secretHeader: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secretHeader !== null) headers['x-borderpass-secret'] = secretHeader;
  return new Request(route.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(route.body),
  });
}

/** A rejection must be a JSON 401 — not a redirect, and not an HTML login page. */
async function expectJsonUnauthorized(res: Response): Promise<void> {
  expect(res.status).toBe(401);
  expect(res.status).not.toBe(302);
  const contentType = res.headers.get('content-type') ?? '';
  expect(contentType).toMatch(/application\/json/);
  expect(contentType).not.toMatch(/text\/html/);
  expect(res.headers.get('location')).toBeNull();
  const text = await res.text();
  expect(text.trimStart().startsWith('<')).toBe(false);
  expect(text).not.toMatch(/<html|<!DOCTYPE|sign in|<form/i);
  expect(JSON.parse(text)).toEqual({ error: 'unauthorized' });
}

/** No handler may ever echo a secret — in the body or in any response header. */
async function expectNoSecretLeak(res: Response): Promise<void> {
  const text = await res.clone().text();
  for (const needle of [SECRET, WRONG_SAME_LENGTH, WRONG_DIFFERENT_LENGTH]) {
    expect(text).not.toContain(needle);
    for (const [, value] of res.headers) {
      expect(value).not.toContain(needle);
    }
  }
  expect(text).not.toMatch(/N8N_WEBHOOK_SECRET|x-borderpass-secret/i);
}

beforeEach(() => {
  resetFakeState(SECRET);
});

describe('automation routes — fail closed on the shared secret before doing any work', () => {
  for (const route of ROUTES) {
    it(`${route.name}: no secret header -> JSON 401, not a 302 to /login`, async () => {
      const res = await route.handler(request(route, null));
      await expectJsonUnauthorized(res.clone());
      await expectNoSecretLeak(res);
      expect(wasCalled(route.sentinel)).toBe(false);
      expect(wasCalled('writeAudit')).toBe(false);
    });

    it(`${route.name}: wrong secret of EQUAL length -> JSON 401`, async () => {
      expect(WRONG_SAME_LENGTH.length).toBe(SECRET.length);
      const res = await route.handler(request(route, WRONG_SAME_LENGTH));
      await expectJsonUnauthorized(res.clone());
      await expectNoSecretLeak(res);
      expect(wasCalled(route.sentinel)).toBe(false);
    });

    it(`${route.name}: wrong secret of DIFFERENT length -> JSON 401 (no crypto throw)`, async () => {
      const res = await route.handler(request(route, WRONG_DIFFERENT_LENGTH));
      await expectJsonUnauthorized(res.clone());
      await expectNoSecretLeak(res);
      expect(wasCalled(route.sentinel)).toBe(false);
    });

    it(`${route.name}: empty secret header -> JSON 401`, async () => {
      const res = await route.handler(request(route, ''));
      await expectJsonUnauthorized(res);
      expect(wasCalled(route.sentinel)).toBe(false);
    });

    it(`${route.name}: server secret UNSET -> JSON 401 even with a matching header`, async () => {
      resetFakeState(undefined);
      const res = await route.handler(request(route, SECRET));
      await expectJsonUnauthorized(res);
      expect(wasCalled(route.sentinel)).toBe(false);
    });

    it(`${route.name}: rejects BEFORE reading the request body`, async () => {
      // A handler that parsed the body first would consume the stream; an unread body proves the
      // secret check is the first thing that happens.
      const req = request(route, null);
      const res = await route.handler(req);
      expect(res.status).toBe(401);
      expect(req.bodyUsed).toBe(false);
    });

    it(`${route.name}: malformed body is still rejected as 401, not 400, without a secret`, async () => {
      const req = new Request(route.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      });
      const res = await route.handler(req);
      expect(res.status).toBe(401);
      expect(wasCalled(route.sentinel)).toBe(false);
    });

    it(`${route.name}: valid secret -> the route proceeds`, async () => {
      const res = await route.handler(request(route, SECRET));
      expect(res.status).toBe(route.okStatus);
      expect(res.status).not.toBe(401);
      expect(res.headers.get('content-type') ?? '').toMatch(/application\/json/);
      expect(wasCalled(route.sentinel)).toBe(true);
      await expectNoSecretLeak(res);
    });
  }
});

describe('automation routes — authorised behaviour is unchanged by the middleware bypass', () => {
  it('dispatch-notifications returns the dispatcher summary', async () => {
    const route = ROUTES[0] as RouteCase;
    const res = await route.handler(request(route, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      scanned: 3,
      sent: 0,
      failed: 0,
      skipped: 3,
    });
    expect(wasCalled('writeAudit')).toBe(true);
  });

  it('notification-status advances a queued row and stays idempotent', async () => {
    const route = ROUTES[1] as RouteCase;
    const first = await route.handler(request(route, SECRET));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: 'updated' });
    expect(fakeState.updates).toHaveLength(1);

    // Re-report the same status: the decision layer must make it a no-op, not a second write.
    fakeState.outboxRow = { status: 'delivered' };
    const second = await route.handler(request(route, SECRET));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ status: 'idempotent' });
    expect(fakeState.updates).toHaveLength(1);
  });

  it('review-request returns the send result for a valid caller', async () => {
    const route = ROUTES[2] as RouteCase;
    const res = await route.handler(request(route, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'sent' });
  });

  it('review-request still validates its own input after auth passes', async () => {
    const route = ROUTES[2] as RouteCase;
    const req = new Request(route.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-borderpass-secret': SECRET },
      body: JSON.stringify({}),
    });
    const res = await route.handler(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_order_id' });
    expect(wasCalled('sendOrderReviewRequest')).toBe(false);
  });
});
