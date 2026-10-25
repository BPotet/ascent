// Frappe en rythme et frappe parfaite (#32, règles C6) : multiplicateur de frappe et calcul d'un impact.
import {
  GOOD_STRIKE_PERCENT,
  PERFECT_STRIKE_BASE_PERCENT,
  PLAIN_STRIKE_PERCENT,
  STRIKE_RECOVERY_MS,
  STRIKE_WIND_UP_MS,
  counterBlow,
  strikeBlow,
  strikeMultiplier,
} from './strike';

const SENTINEL_STRIKE = { attackPower: 10, guardDamage: 12 };

describe('timed strike (C6)', () => {
  it('prepares the strike for 700 ms, then recovers for 320 ms after its window', () => {
    expect(STRIKE_WIND_UP_MS).toBe(700);
    expect(STRIKE_RECOVERY_MS).toBe(320);
  });

  describe('strikeMultiplier (C6.2, C6.4)', () => {
    it('gives 1.5 to a perfect strike, 1.2 to a good one, 1.0 otherwise or without a press', () => {
      expect([PERFECT_STRIKE_BASE_PERCENT, GOOD_STRIKE_PERCENT, PLAIN_STRIKE_PERCENT]).toEqual([
        150, 120, 100,
      ]);
      expect(strikeMultiplier('perfect')).toBe(150);
      expect(strikeMultiplier('good')).toBe(120);
      expect(strikeMultiplier('miss')).toBe(100);
      expect(strikeMultiplier(null)).toBe(100);
    });

    it('adds the perfect strike bonuses to the perfect strike only', () => {
      expect(strikeMultiplier('perfect', [10, 15])).toBe(175);
      expect(strikeMultiplier('good', [10, 15])).toBe(120);
      expect(strikeMultiplier('miss', [10])).toBe(100);
    });
  });

  describe('strikeBlow (C6.5): one rounding, at the end', () => {
    it.each([
      [100, 10, 12, 15],
      [120, 12, 14, 18],
      [150, 15, 18, 22],
    ])(
      'multiplier %i: %i HP and %i guard on a standing enemy, %i HP on a stunned one',
      (multiplier, hp, guard, stunnedHp) => {
        expect(strikeBlow({ ...SENTINEL_STRIKE, multiplier, stunned: false })).toEqual({
          hp,
          guard,
        });
        expect(strikeBlow({ ...SENTINEL_STRIKE, multiplier, stunned: true })).toEqual({
          hp: stunnedHp,
          guard: 0,
        });
      },
    );

    it('removes at least 1 HP and 1 guard point', () => {
      expect(
        strikeBlow({ attackPower: 0.5, guardDamage: 0.5, multiplier: 100, stunned: false }),
      ).toEqual({ hp: 1, guard: 1 });
    });
  });

  describe('counterBlow (C8, C6.6)', () => {
    it('deals 50 % of the attack times the trait, and 100 % of the guard damage', () => {
      expect(counterBlow({ ...SENTINEL_STRIKE, counterPercent: 130, stunned: false })).toEqual({
        hp: 6,
        guard: 12,
      });
    });

    it('deals ×1.5 to a stunned enemy, and no guard damage', () => {
      // 10 × 50 % × 130 % × 150 % = 9,75.
      expect(counterBlow({ ...SENTINEL_STRIKE, counterPercent: 130, stunned: true })).toEqual({
        hp: 9,
        guard: 0,
      });
    });
  });
});
