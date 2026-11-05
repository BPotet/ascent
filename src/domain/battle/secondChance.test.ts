import {
  SECOND_CHANCE_BANNER_MS,
  SECOND_CHANCE_FREEZE_MS,
  SECOND_CHANCE_MS,
  secondChanceHp,
} from './secondChance';

describe('the second chance (#206)', () => {
  it.each([
    [80, 40],
    [88, 44],
    [81, 40],
    [72, 36],
  ])('raises a hero of %p max HP with %p HP: 50 %, rounded down', (maxHp, hp) => {
    expect(secondChanceHp(maxHp)).toBe(hp);
  });

  it('lasts 2 s: the 400 ms freeze, then the 1,600 ms banner', () => {
    expect(SECOND_CHANCE_FREEZE_MS).toBe(400);
    expect(SECOND_CHANCE_BANNER_MS).toBe(1_600);
    expect(SECOND_CHANCE_MS).toBe(SECOND_CHANCE_FREEZE_MS + SECOND_CHANCE_BANNER_MS);
  });
});
