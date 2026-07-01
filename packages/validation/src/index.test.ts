import { describe, it, expect } from 'vitest';
import { Money, Phone } from './index';

describe('shared schemas', () => {
  it('accepts integer minor-unit money', () => {
    expect(Money.parse({ amount_minor: 1500, currency: 'USD' })).toBeTruthy();
  });
  it('rejects float money', () => {
    expect(() => Money.parse({ amount_minor: 15.5, currency: 'USD' })).toThrow();
  });
  it('validates E.164 phone', () => {
    expect(Phone.parse('+5216561234567')).toBe('+5216561234567');
    expect(() => Phone.parse('6561234567')).toThrow();
  });
});
