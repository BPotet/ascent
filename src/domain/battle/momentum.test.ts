// Élan et pouvoir (#32, règle C3).
import {
  BULWARK_DAMAGE_PERCENT,
  MOMENTUM_MAX,
  MOMENTUM_START,
  POWERS,
  gainMomentum,
  missingMomentum,
} from './momentum';

describe('momentum and powers (C3)', () => {
  it('starts at 1, capped at 5', () => {
    expect([MOMENTUM_START, MOMENTUM_MAX]).toEqual([1, 5]);
  });

  it('gains 1 momentum, never above the cap', () => {
    expect(gainMomentum(1)).toBe(2);
    expect(gainMomentum(4)).toBe(5);
    expect(gainMomentum(5)).toBe(5);
  });

  it('costs 1 momentum for the Bulwark, which halves the next blow', () => {
    expect(POWERS.bulwark.cost).toBe(1);
    expect(BULWARK_DAMAGE_PERCENT).toBe(50);
  });

  it('tells the momentum a power misses', () => {
    expect(missingMomentum(0, 'bulwark')).toBe(1);
    expect(missingMomentum(1, 'bulwark')).toBe(0);
    expect(missingMomentum(5, 'bulwark')).toBe(0);
  });
});
