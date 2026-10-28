import { seedRandom } from '../battle/SeededRandom';
import { GROUP_SIZE_WEIGHTS, drawGroup, drawGroupSize, sizeWeights } from './enemyGroup';

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

  it('draws as many enemies as the size, with at most 1 Specter, 1 Necromancer and 1 Skeleton', () => {
    for (const size of [1, 2, 3, 4, 5]) {
      for (const group of groups(size)) {
        expect(group).toHaveLength(size);
        expect(group.filter((kind) => kind === 'specter').length).toBeLessThanOrEqual(1);
        expect(group.filter((kind) => kind === 'necromancer').length).toBeLessThanOrEqual(1);
        expect(group.filter((kind) => kind === 'skeleton').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fills the rest with Ghouls, and every type is possible', () => {
    const five = groups(5);
    expect(five.every((group) => group.filter((kind) => kind === 'ghoul').length >= 2)).toBe(true);
    expect(new Set(groups(3).flat())).toEqual(
      new Set(['ghoul', 'specter', 'necromancer', 'skeleton']),
    );
  });

  it('never draws a lone Necromancer, but a lone Skeleton can be', () => {
    expect(new Set(groups(1).flat())).toEqual(new Set(['ghoul', 'specter', 'skeleton']));
  });
});
