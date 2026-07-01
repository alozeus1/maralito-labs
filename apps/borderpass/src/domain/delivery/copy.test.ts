import { describe, it, expect } from 'vitest';
import { deliveryPrepStatusLabel } from './copy';
import { DELIVERY_PREP_STATUSES } from './state-machine';

describe('deliveryPrepStatusLabel', () => {
  it('gives a non-empty label for every status', () => {
    for (const s of DELIVERY_PREP_STATUSES) expect(deliveryPrepStatusLabel(s).length).toBeGreaterThan(0);
  });
  it('maps the key statuses', () => {
    expect(deliveryPrepStatusLabel('preparing')).toBe('Preparing');
    expect(deliveryPrepStatusLabel('ready')).toBe('Ready');
    expect(deliveryPrepStatusLabel('scheduled')).toBe('Scheduled');
    expect(deliveryPrepStatusLabel('handed_off')).toBe('Handed off');
  });
});
