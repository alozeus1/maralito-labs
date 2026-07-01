import { describe, it, expect } from 'vitest';
import { inspectionStatusLabel } from './copy';
import { INSPECTION_STATUSES } from './state-machine';

describe('inspectionStatusLabel', () => {
  it('gives a non-empty label for every status', () => {
    for (const s of INSPECTION_STATUSES) expect(inspectionStatusLabel(s).length).toBeGreaterThan(0);
  });
  it('maps the key statuses', () => {
    expect(inspectionStatusLabel('in_progress')).toBe('In progress');
    expect(inspectionStatusLabel('on_hold')).toBe('On hold');
    expect(inspectionStatusLabel('passed')).toBe('Passed');
    expect(inspectionStatusLabel('failed')).toBe('Failed');
  });
});
