// Élan (#32, règle C3) ; les pouvoirs vivent dans leur registre (`powers.ts`, #235).
import { MOMENTUM_MAX, MOMENTUM_START, gainMomentum, missingMomentum } from './momentum';

describe('momentum (C3)', () => {
  it('starts at 1, capped at 5', () => {
    expect([MOMENTUM_START, MOMENTUM_MAX]).toEqual([1, 5]);
  });

  it('gains 1 momentum, never above the cap', () => {
    expect(gainMomentum(1)).toBe(2);
    expect(gainMomentum(4)).toBe(5);
    expect(gainMomentum(5)).toBe(5);
  });

  it('tells the momentum a cost misses', () => {
    expect(missingMomentum(0, 1)).toBe(1);
    expect(missingMomentum(1, 1)).toBe(0);
    expect(missingMomentum(5, 1)).toBe(0);
    expect(missingMomentum(2, 3)).toBe(1);
  });
});
