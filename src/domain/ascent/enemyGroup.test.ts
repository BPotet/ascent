import { seedRandom } from '../battle/SeededRandom';
import {
  GROUP_SIZE_WEIGHTS,
  KIND_WEIGHTS,
  drawGroup,
  drawGroupSize,
  sizeWeights,
} from './enemyGroup';

const SEEDS = Array.from({ length: 600 }, (_, index) => index * 2_654_435_761);

describe('Group size (P3)', () => {
  it('has the weights of each floor, for 1 to 5 enemies', () => {
    expect(GROUP_SIZE_WEIGHTS).toEqual({
      1: [4, 10, 6, 0, 0],
      2: [1, 6, 9, 4, 0],
      3: [0, 5, 9, 5, 1],
      4: [0, 4, 8, 7, 1],
      5: [0, 2, 8, 8, 2],
    });
  });

  it('draws 1 to 3 enemies at floor 1, and every size with a weight', () => {
    const at = (floor: number) =>
      new Set(SEEDS.map((seed) => drawGroupSize(floor, seedRandom(seed), false).value));

    expect(at(1)).toEqual(new Set([1, 2, 3]));
    expect(at(5)).toEqual(new Set([2, 3, 4, 5]));
  });

  it('turns a draw of 5 into 4 once a group of 5 has been faced', () => {
    expect(sizeWeights(3, true)).toEqual([0, 5, 9, 6, 0]);
    const sizes = SEEDS.map((seed) => drawGroupSize(5, seedRandom(seed), true).value);
    expect(Math.max(...sizes)).toBe(4);
  });
});

describe('Group composition (P3)', () => {
  const groups = (size: number) => SEEDS.map((seed) => drawGroup(size, seedRandom(seed)).value);

  it('has the weights of the Codex, in its order', () => {
    expect(Object.entries(KIND_WEIGHTS)).toEqual([
      ['ghoul', 3],
      ['specter', 2],
      ['necromancer', 1],
      ['skeleton', 3],
      ['madVillager', 2],
      ['candleBearer', 1],
      ['cryptRat', 2],
    ]);
  });

  it('draws as many enemies as the size, with at most 1 of each type but the Ghoul and the Crypt rat', () => {
    for (const size of [1, 2, 3, 4, 5]) {
      for (const group of groups(size)) {
        expect(group).toHaveLength(size);
        for (const capped of [
          'specter',
          'necromancer',
          'skeleton',
          'madVillager',
          'candleBearer',
        ]) {
          expect(group.filter((kind) => kind === capped).length).toBeLessThanOrEqual(1);
        }
        expect(group.filter((kind) => kind === 'cryptRat').length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('draws up to 3 Crypt rats in a group (#268)', () => {
    const counts = [3, 4, 5].flatMap((size) =>
      groups(size).map((group) => group.filter((kind) => kind === 'cryptRat').length),
    );
    expect(Math.max(...counts)).toBe(3);
  });

  it('can draw every enemy of tier 1, the Candle bearer and the Crypt rat included (#268)', () => {
    expect(new Set(groups(3).flat())).toEqual(
      new Set([
        'ghoul',
        'specter',
        'necromancer',
        'skeleton',
        'madVillager',
        'candleBearer',
        'cryptRat',
      ]),
    );
  });

  it('never draws a lone Necromancer nor a lone Candle bearer, but a lone Skeleton or Crypt rat can be (#268)', () => {
    expect(new Set(groups(1).flat())).toEqual(
      new Set(['ghoul', 'specter', 'skeleton', 'madVillager', 'cryptRat']),
    );
  });

  it('can draw a Necromancer with a Candle bearer, neither alone (#268)', () => {
    const pairs = groups(2).filter(
      (group) => group.includes('necromancer') && group.includes('candleBearer'),
    );
    expect(pairs.length).toBeGreaterThan(0);
  });
});
