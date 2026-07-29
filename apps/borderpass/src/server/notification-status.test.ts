import { describe, it, expect } from 'vitest';
import {
  decideOutboxStatus,
  isCallbackStatus,
  CALLBACK_STATUSES,
} from './notification-status';

describe('decideOutboxStatus — idempotent, non-regressing delivery-status reconciliation', () => {
  it('applies a legal advance from a non-terminal state', () => {
    expect(decideOutboxStatus('sent', 'delivered')).toEqual({ kind: 'apply', status: 'delivered' });
    expect(decideOutboxStatus('sent', 'bounced')).toEqual({ kind: 'apply', status: 'bounced' });
    // delivery_delayed is transient → may still advance to delivered
    expect(decideOutboxStatus('delivery_delayed', 'delivered')).toEqual({
      kind: 'apply',
      status: 'delivered',
    });
  });

  it('is an idempotent no-op when the status already matches', () => {
    expect(decideOutboxStatus('delivered', 'delivered')).toEqual({ kind: 'noop' });
    expect(decideOutboxStatus('bounced', 'bounced')).toEqual({ kind: 'noop' });
  });

  it('rejects a terminal-state regression as a conflict (never overwrites a terminal state)', () => {
    expect(decideOutboxStatus('delivered', 'bounced')).toEqual({ kind: 'conflict', from: 'delivered' });
    expect(decideOutboxStatus('bounced', 'delivered')).toEqual({ kind: 'conflict', from: 'bounced' });
    expect(decideOutboxStatus('failed', 'delivered')).toEqual({ kind: 'conflict', from: 'failed' });
    expect(decideOutboxStatus('complained', 'delivered')).toEqual({
      kind: 'conflict',
      from: 'complained',
    });
  });

  it('treats a repeated delivered callback as a no-op (double-apply = single effect)', () => {
    // First application would advance sent → delivered; a second delivered callback is a no-op.
    expect(decideOutboxStatus('sent', 'delivered')).toEqual({ kind: 'apply', status: 'delivered' });
    expect(decideOutboxStatus('delivered', 'delivered')).toEqual({ kind: 'noop' });
  });
});

describe('isCallbackStatus — untrusted body guard', () => {
  it('accepts every declared callback status', () => {
    for (const s of CALLBACK_STATUSES) expect(isCallbackStatus(s)).toBe(true);
  });

  it('rejects unknown, non-string, or internal-only statuses', () => {
    expect(isCallbackStatus('queued')).toBe(false); // not a delivery outcome
    expect(isCallbackStatus('sending')).toBe(false);
    expect(isCallbackStatus('sent')).toBe(false); // set by the dispatcher, not the callback
    expect(isCallbackStatus('DELIVERED')).toBe(false); // case-sensitive
    expect(isCallbackStatus(undefined)).toBe(false);
    expect(isCallbackStatus(null)).toBe(false);
    expect(isCallbackStatus(42)).toBe(false);
  });
});
