import { describe, it, expect, beforeEach } from 'vitest';
import { register } from '../../instrumentation';
import { getObservabilityStatus } from '@maralito/observability';

// Proves the start-up hook actually wires the observability seam (row 4 of the observability plan),
// and that it degrades to a silent no-op with no SENTRY_DSN rather than throwing.
describe('instrumentation.register', () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
  });

  it('initialises observability in the node runtime (no DSN → capture disabled, never throws)', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    await expect(register()).resolves.toBeUndefined();
    const status = getObservabilityStatus();
    expect(status).not.toBeNull();
    expect(status?.capture).toBe('disabled');
    expect(status?.logging).toBe('stdout-json');
  });

  it('does nothing in the edge runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    await expect(register()).resolves.toBeUndefined();
  });
});
