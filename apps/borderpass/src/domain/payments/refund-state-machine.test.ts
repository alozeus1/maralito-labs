import { describe, it, expect } from 'vitest';
import {
  assertRefundTransition,
  isLegalRefundTransition,
  isTerminalRefundStatus,
  getNextAllowedRefundStatuses,
  refundSucceeds,
  IllegalRefundTransitionError,
} from './refund-state-machine';

describe('refund state machine (Phase 8D, ADR-0015)', () => {
  it('legal transitions', () => {
    for (const [f, t] of [
      ['requested', 'processing'],
      ['requested', 'succeeded'],
      ['requested', 'failed'],
      ['requested', 'canceled'],
      ['processing', 'succeeded'],
      ['processing', 'failed'],
      ['processing', 'canceled'],
    ] as const)
      expect(isLegalRefundTransition(f, t)).toBe(true);
  });
  it('illegal transitions (terminals have no outgoing)', () => {
    for (const [f, t] of [
      ['succeeded', 'processing'],
      ['failed', 'succeeded'],
      ['canceled', 'processing'],
      ['succeeded', 'canceled'],
    ] as const)
      expect(isLegalRefundTransition(f, t)).toBe(false);
  });
  it('assert throws on illegal', () => {
    expect(() => assertRefundTransition('succeeded', 'processing')).toThrow(IllegalRefundTransitionError);
  });
  it('terminals are succeeded/failed/canceled', () => {
    for (const s of ['succeeded', 'failed', 'canceled'] as const)
      expect(isTerminalRefundStatus(s)).toBe(true);
    expect(getNextAllowedRefundStatuses('succeeded')).toHaveLength(0);
  });
  it('refundSucceeds only for succeeded', () => {
    expect(refundSucceeds('succeeded')).toBe(true);
    for (const s of ['requested', 'processing', 'failed', 'canceled'] as const)
      expect(refundSucceeds(s)).toBe(false);
  });
});
