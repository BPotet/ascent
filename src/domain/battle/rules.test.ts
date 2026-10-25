import {
  COUNTER_MS,
  HERO_ACTION_MS,
  HIT_STOP_MS,
  OFF_BALANCE_MS,
  PARRY_WINDOW_MS,
  PERFECT_WINDOW_MS,
  judgePress,
  missDeadline,
  pressDelta,
  scaleDamage,
} from './rules';

describe('battle rules', () => {
  it('keeps the durations validated by the owner', () => {
    expect([PERFECT_WINDOW_MS, PARRY_WINDOW_MS, OFF_BALANCE_MS, HIT_STOP_MS]).toEqual([
      60, 160, 450, 90,
    ]);
    expect([HERO_ACTION_MS, COUNTER_MS]).toEqual([500, 400]);
  });

  describe('judgePress (C7)', () => {
    it.each([
      [-161, 'miss'],
      [-160, 'good'],
      [-61, 'good'],
      [-60, 'perfect'],
      [0, 'perfect'],
      [60, 'perfect'],
      [61, 'good'],
      [160, 'good'],
      [161, 'miss'],
    ] as const)('judges a delta of %i ms as %s', (delta, judgement) => {
      expect(judgePress(delta)).toBe(judgement);
    });
  });

  describe('pressDelta', () => {
    it('is the press instant, plus the input offset, minus the impact instant', () => {
      expect(pressDelta(1_000, 0, 1_050)).toBe(-50);
      expect(pressDelta(1_000, 20, 1_050)).toBe(-30);
      expect(pressDelta(1_100, -15, 1_050)).toBe(35);
    });

    it('judges a press with a non-zero input offset', () => {
      // 70 ms d'avance, corrigés de +20 ms : 50 ms, parfait.
      expect(judgePress(pressDelta(930, 20, 1_000))).toBe('perfect');
      expect(judgePress(pressDelta(930, 0, 1_000))).toBe('good');
    });
  });

  describe('missDeadline (C7, C12)', () => {
    it('is the impact plus 160 ms without input offset', () => {
      expect(missDeadline(1_000, 0)).toBe(1_160);
    });

    it('waits longer with a negative input offset, never less with a positive one', () => {
      expect(missDeadline(1_000, -30)).toBe(1_190);
      expect(missDeadline(1_000, 30)).toBe(1_160);
    });
  });

  describe('scaleDamage (C8)', () => {
    it.each([
      ['a good parry of 5 (25 %, reduction 10 %)', 5, [25, 90], 1],
      ['a suffered blow of 5', 5, [90], 4],
      ['a suffered perilous blow of 9', 9, [90], 8],
      ['a suffered hit of a double attack (3)', 3, [90], 2],
      ['the counter of the Sentinel (50 % of 10, ×1.3)', 10, [50, 130], 6],
      ['a hero attack', 10, [100], 10],
      ['a good parry of 3, raised to the minimum of 1', 3, [25, 90], 1],
    ] as const)('computes %s', (_, base, percents, damage) => {
      expect(scaleDamage(base, ...percents)).toBe(damage);
    });

    it('gives no damage when a factor or the base is zero', () => {
      expect(scaleDamage(5, 0, 90)).toBe(0);
      expect(scaleDamage(5, 90, 0)).toBe(0);
      expect(scaleDamage(0, 90)).toBe(0);
    });

    it('keeps the base without factor', () => {
      expect(scaleDamage(7)).toBe(7);
    });

    it('rounds down above the minimum', () => {
      expect(scaleDamage(19, 50)).toBe(9);
      expect(scaleDamage(20, 50)).toBe(10);
    });
  });
});
