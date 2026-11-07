// Frappe en rythme et frappe parfaite (#32, règles C6) : multiplicateur de frappe et calcul d'un impact.
import {
  GOOD_STRIKE_PERCENT,
  PERFECT_STRIKE_BASE_PERCENT,
  PERFECT_STRIKE_WINDOW_MS,
  PLAIN_STRIKE_PERCENT,
  STRIKE_RECOVERY_MS,
  STRIKE_WIND_UP_MS,
  bulwarkCounterBlow,
  counterBlow,
  judgeStrike,
  strikeBlow,
  strikeMultiplier,
} from './strike';

const SENTINEL_STRIKE = { attackPower: 10, guardDamage: 12 };

describe('timed strike (C6)', () => {
  it('prepares the strike for 700 ms, then recovers for 320 ms after its window', () => {
    expect(STRIKE_WIND_UP_MS).toBe(700);
    expect(STRIKE_RECOVERY_MS).toBe(320);
  });

  describe('judgeStrike (#211): the perfect strike window is 40 ms', () => {
    it('keeps the perfect strike window at 40 ms, narrower than the 60 ms of the defenses', () => {
      expect(PERFECT_STRIKE_WINDOW_MS).toBe(40);
    });

    it.each([
      [0, 'perfect'],
      [40, 'perfect'],
      [-40, 'perfect'],
      [41, 'good'],
      [-41, 'good'],
      [60, 'good'],
      [-60, 'good'],
      [160, 'good'],
      [-160, 'good'],
      [161, 'miss'],
      [-161, 'miss'],
    ] as const)('judges a strike %i ms from the impact as %s', (delta, judgement) => {
      expect(judgeStrike(delta)).toBe(judgement);
    });
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
      [null, 10, 12, 15],
      ['miss', 10, 12, 15],
      ['good', 12, 14, 18],
      ['perfect', 15, 18, 22],
    ] as const)(
      'judgement %s: %i HP and %i guard on a standing enemy, %i HP on a stunned one',
      (judgement, hp, guard, stunnedHp) => {
        expect(strikeBlow({ ...SENTINEL_STRIKE, judgement, stunned: false })).toEqual({
          hp,
          guard,
        });
        expect(strikeBlow({ ...SENTINEL_STRIKE, judgement, stunned: true })).toEqual({
          hp: stunnedHp,
          guard: 0,
        });
      },
    );

    it('removes at least 1 HP and 1 guard point', () => {
      expect(
        strikeBlow({ attackPower: 0.5, guardDamage: 0.5, judgement: null, stunned: false }),
      ).toEqual({ hp: 1, guard: 1 });
    });
  });

  describe('strikeBlow, the guard break of a strike (#244, G1)', () => {
    // Lame juste (+50) et Heure juste (+30) : des bonus de frappe parfaite.
    const BONUSES = [50, 30];

    it('puts the perfect strike bonuses into the HP only: 23 HP and 18 guard', () => {
      // PV : 10 × 230 % = 23 ; garde : 12 × 150 % = 18 (27 avant #244).
      expect(
        strikeBlow({
          ...SENTINEL_STRIKE,
          judgement: 'perfect',
          perfectBonusPercents: BONUSES,
          stunned: false,
        }),
      ).toEqual({ hp: 23, guard: 18 });
    });

    it('applies the guard break percents to the guard, in one rounding: 23 guard', () => {
      // Braise brisante : 12 × 150 % × 130 % = 23,4.
      expect(
        strikeBlow({
          ...SENTINEL_STRIKE,
          judgement: 'perfect',
          perfectBonusPercents: BONUSES,
          stunned: false,
          guardPercents: [130],
        }),
      ).toEqual({ hp: 23, guard: 23 });
    });

    it('takes 36 guard with a perfect power strike of 200 % guard and Lame juste', () => {
      // Le Coup de bouclier (#236) : 12 × 150 % × 200 %.
      expect(
        strikeBlow({
          ...SENTINEL_STRIKE,
          judgement: 'perfect',
          perfectBonusPercents: [50],
          stunned: false,
          guardPercents: [200],
        }).guard,
      ).toBe(36);
    });

    it('computes each hit of the Wanderer alone: 12 HP and 11 guard with Lame juste and Rend', () => {
      // PV : 6 × 200 % = 12 ; garde : 5 × 150 % × 150 % = 11,25.
      expect(
        strikeBlow({
          attackPower: 6,
          guardDamage: 5,
          judgement: 'perfect',
          perfectBonusPercents: [50],
          stunned: false,
          guardPercents: [150],
        }),
      ).toEqual({ hp: 12, guard: 11 });
    });

    it('keeps a good strike as it was: 14 guard, no bonus', () => {
      expect(
        strikeBlow({
          ...SENTINEL_STRIKE,
          judgement: 'good',
          perfectBonusPercents: [50],
          stunned: false,
        }),
      ).toEqual({ hp: 12, guard: 14 });
    });

    it('takes no guard from a stunned enemy, the bonuses still in the HP', () => {
      // PV : 10 × 200 % × 150 % = 30.
      expect(
        strikeBlow({
          ...SENTINEL_STRIKE,
          judgement: 'perfect',
          perfectBonusPercents: [50],
          stunned: true,
          guardPercents: [130],
        }),
      ).toEqual({ hp: 30, guard: 0 });
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

    it('scales its HP and its guard damage by the given shares, still with one rounding', () => {
      // 10 × 50 % × 130 % × 50 % = 3,25 ; 12 × 25 % = 3.
      expect(
        counterBlow({
          ...SENTINEL_STRIKE,
          counterPercent: 130,
          stunned: false,
          hpPercent: 50,
          guardPercent: 25,
        }),
      ).toEqual({ hp: 3, guard: 3 });
    });
  });

  describe('bulwarkCounterBlow, the Bulwark riposte (#128, R4)', () => {
    const SENTINEL_RIPOSTE = {
      ...SENTINEL_STRIKE,
      counterPercent: 130,
      bulwarkCounterPercent: 50,
      bulwarkCounterGuardPercent: 25,
    };

    it('deals 3 HP and 3 guard points for the Sentinel without a boon', () => {
      // 10 × 50 % × 130 % × 50 % = 3,25 ; 12 × 25 % = 3.
      expect(bulwarkCounterBlow({ ...SENTINEL_RIPOSTE, stunned: false })).toEqual({
        hp: 3,
        guard: 3,
      });
    });

    it('deals 4 HP and no guard damage to a stunned enemy', () => {
      // 10 × 50 % × 130 % × 50 % × 150 % = 4,875.
      expect(bulwarkCounterBlow({ ...SENTINEL_RIPOSTE, stunned: true })).toEqual({
        hp: 4,
        guard: 0,
      });
    });

    it('rounds once, at the end: 10 × 50 % × 130 % × 50 % × 160 % = 5.2, not 3 × 160 %', () => {
      expect(
        bulwarkCounterBlow({ ...SENTINEL_RIPOSTE, stunned: false, attackPercents: [160] }).hp,
      ).toBe(5);
    });

    it('removes at least 1 HP and 1 guard point', () => {
      expect(
        bulwarkCounterBlow({
          ...SENTINEL_RIPOSTE,
          attackPower: 1,
          guardDamage: 1,
          stunned: false,
        }),
      ).toEqual({ hp: 1, guard: 1 });
    });

    it('takes the items and the boons like the counter: attack, counter, guard damage, Blazing Ember', () => {
      expect(
        bulwarkCounterBlow({
          ...SENTINEL_RIPOSTE,
          attackPower: 12,
          stunned: false,
          attackPercents: [120],
          counterPercents: [150],
          guardPercents: [160],
        }),
        // 12 × 50 % × 130 % × 50 % × 120 % × 150 % = 7,02 ; 12 × 25 % × 160 % = 4,8.
      ).toEqual({ hp: 7, guard: 4 });
      expect(
        bulwarkCounterBlow({ ...SENTINEL_RIPOSTE, stunned: true, stunnedBonusPercent: 50 }).hp,
        // 10 × 50 % × 130 % × 50 % × 200 % = 6,5.
      ).toBe(6);
    });
  });
});
