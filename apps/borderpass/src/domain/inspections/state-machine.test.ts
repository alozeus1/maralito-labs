import { describe, it, expect } from 'vitest';
import {
  INSPECTION_STATUSES, isLegalInspectionTransition, assertInspectionTransition,
  IllegalInspectionTransitionError, isTerminalInspectionStatus, inspectionResultFor,
  getNextAllowedInspectionStatuses, type InspectionStatus,
} from './state-machine';

describe('inspection state machine', () => {
  it('has 5 statuses', () => expect(INSPECTION_STATUSES).toHaveLength(5));

  it('allows the spec-legal transitions', () => {
    const legal: [InspectionStatus, InspectionStatus][] = [
      ['scheduled', 'in_progress'], ['in_progress', 'on_hold'], ['on_hold', 'in_progress'],
      ['in_progress', 'passed'], ['in_progress', 'failed'],
    ];
    for (const [f, t] of legal) expect(isLegalInspectionTransition(f, t)).toBe(true);
  });

  it('rejects illegal transitions (incl. skipping in_progress and leaving terminals)', () => {
    const illegal: [InspectionStatus, InspectionStatus][] = [
      ['scheduled', 'passed'], ['scheduled', 'failed'], ['scheduled', 'on_hold'],
      ['on_hold', 'passed'], ['on_hold', 'failed'],
      ['passed', 'in_progress'], ['failed', 'in_progress'], ['passed', 'failed'],
    ];
    for (const [f, t] of illegal) expect(isLegalInspectionTransition(f, t)).toBe(false);
  });

  it('assert throws on illegal', () =>
    expect(() => assertInspectionTransition('scheduled', 'passed')).toThrow(IllegalInspectionTransitionError));

  it('terminals are passed + failed (no out-edges)', () => {
    expect(isTerminalInspectionStatus('passed')).toBe(true);
    expect(isTerminalInspectionStatus('failed')).toBe(true);
    expect(getNextAllowedInspectionStatuses('passed')).toHaveLength(0);
    expect(getNextAllowedInspectionStatuses('failed')).toHaveLength(0);
  });

  it('inspectionResultFor maps terminals only', () => {
    expect(inspectionResultFor('passed')).toBe('passed');
    expect(inspectionResultFor('failed')).toBe('failed');
    for (const s of ['scheduled', 'in_progress', 'on_hold'] as InspectionStatus[])
      expect(inspectionResultFor(s)).toBeNull();
  });
});
