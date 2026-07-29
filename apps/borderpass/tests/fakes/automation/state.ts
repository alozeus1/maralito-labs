/**
 * Shared mutable state for the `/api/automation/*` route fakes (defect D2 verification).
 *
 * The automation routes must FAIL CLOSED on the `x-borderpass-secret` shared secret *before* doing
 * any work. Proving "before any work" needs the collaborators (dispatcher, review sender, privileged
 * DB access, audit writer) replaced by recorders so a test can assert they were never reached.
 *
 * Every fake in this directory records into `fakeState.calls`. The tests read that log.
 * NOTE: the secrets used here are obvious fakes — never a real credential.
 */

export type FakeCall = { readonly module: string; readonly fn: string };

export type FakeEnv = {
  /** `undefined` models "no secret configured on the server" — must still deny (fail closed). */
  N8N_WEBHOOK_SECRET: string | undefined;
  BORDERPASS_APP_URL: string | undefined;
};

export type FakeDispatchSummary = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type FakeReviewResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'not_found' }
  | { status: 'not_deliverable' }
  | { status: 'send_failed'; retryable: boolean };

export type FakeState = {
  env: FakeEnv;
  calls: FakeCall[];
  dispatchSummary: FakeDispatchSummary;
  reviewResult: FakeReviewResult;
  /** Row returned by the faked privileged `select` in the notification-status route. */
  outboxRow: { status: string } | null;
  /** Every `update(...).set(...)` payload the notification-status route wrote. */
  updates: Record<string, unknown>[];
};

function freshState(secret: string | undefined): FakeState {
  return {
    env: { N8N_WEBHOOK_SECRET: secret, BORDERPASS_APP_URL: 'http://localhost:3000' },
    calls: [],
    dispatchSummary: { scanned: 3, sent: 0, failed: 0, skipped: 3 },
    reviewResult: { status: 'sent' },
    outboxRow: { status: 'queued' },
    updates: [],
  };
}

export const fakeState: FakeState = freshState(undefined);

/** Reset every knob between tests. `secret` is what the *server* believes N8N_WEBHOOK_SECRET is. */
export function resetFakeState(secret: string | undefined): void {
  const next = freshState(secret);
  fakeState.env = next.env;
  fakeState.calls = next.calls;
  fakeState.dispatchSummary = next.dispatchSummary;
  fakeState.reviewResult = next.reviewResult;
  fakeState.outboxRow = next.outboxRow;
  fakeState.updates = next.updates;
}

export function recordCall(module: string, fn: string): void {
  fakeState.calls.push({ module, fn });
}

/** Did the route reach a collaborator? Used to assert "no work happened before auth". */
export function wasCalled(fn: string): boolean {
  return fakeState.calls.some((c) => c.fn === fn);
}
