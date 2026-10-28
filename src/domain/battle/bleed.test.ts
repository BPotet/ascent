// Le Saignement (`Bleed`, prototype #107) : règles B1, B4 et B5.
import { BLEEDING_OUTCOMES, bleedsOn, mergeBleed, tickBleed } from './bleed';

describe('bleedsOn (B1)', () => {
  it('bleeds on a good parry, a suffered blow and a parry on a perilous blow', () => {
    expect(BLEEDING_OUTCOMES).toEqual(['parry', 'suffered', 'perilousParry']);
    expect(bleedsOn('parry')).toBe(true);
    expect(bleedsOn('suffered')).toBe(true);
    expect(bleedsOn('perilousParry')).toBe(true);
  });

  it('never bleeds on a perfect parry nor a dodge', () => {
    expect(bleedsOn('perfectParry')).toBe(false);
    expect(bleedsOn('dodge')).toBe(false);
  });
});

describe('mergeBleed (B4)', () => {
  it('starts a bleed when there is none', () => {
    expect(mergeBleed(undefined, { damage: 2, rounds: 3 })).toEqual({ damage: 2, rounds: 3 });
  });

  it('keeps the strongest damage and the longest duration, never adding them', () => {
    expect(mergeBleed({ damage: 2, rounds: 1 }, { damage: 2, rounds: 3 })).toEqual({
      damage: 2,
      rounds: 3,
    });
    expect(mergeBleed({ damage: 3, rounds: 2 }, { damage: 1, rounds: 1 })).toEqual({
      damage: 3,
      rounds: 2,
    });
  });
});

describe('tickBleed (B2, B5)', () => {
  it('takes the damage and counts down one round', () => {
    expect(tickBleed(50, { damage: 2, rounds: 3 })).toEqual({
      loss: 2,
      bleed: { damage: 2, rounds: 2 },
    });
  });

  it('ends after the last round', () => {
    expect(tickBleed(50, { damage: 2, rounds: 1 })).toEqual({ loss: 2, bleed: undefined });
  });

  it('never takes the hero below 1 HP, and still counts down', () => {
    expect(tickBleed(2, { damage: 2, rounds: 3 })).toEqual({
      loss: 1,
      bleed: { damage: 2, rounds: 2 },
    });
    expect(tickBleed(1, { damage: 2, rounds: 2 })).toEqual({
      loss: 0,
      bleed: { damage: 2, rounds: 1 },
    });
  });
});
