// Les groupes d'ennemis des paliers 2 et 3 (#38, § 3.2) : leur taille selon l'étage, leurs
// ennemis, les plafonds, et un soutien jamais seul.
import { seedRandom } from '../battle/SeededRandom';
import { drawGroup, drawGroupSize, sizeWeights } from './enemyGroup';
import { TIERS, type Tier } from './tiers';

const SEEDS = Array.from({ length: 600 }, (_, index) => index * 2_654_435_761);

const sizes = (tier: Tier, floor: number) =>
  new Set(SEEDS.map((seed) => drawGroupSize(floor, seedRandom(seed), false, tier).value));
const groups = (tier: Tier, size: number) =>
  SEEDS.map((seed) => drawGroup(size, seedRandom(seed), tier).value);

describe('the group size at tiers 2 and 3 (#38)', () => {
  it('draws 2, 3 or 4 enemies at every floor of tier 2, never 1 nor 5', () => {
    for (const floor of [1, 2, 3, 4, 5]) expect(sizes(2, floor)).toEqual(new Set([2, 3, 4]));
  });

  it('draws 3 or 4 enemies at every floor of tier 3, never 1, 2 nor 5', () => {
    for (const floor of [1, 2, 3, 4, 5]) expect(sizes(3, floor)).toEqual(new Set([3, 4]));
  });

  it('follows the weights of the floor: more groups of 4 at floor 5 than at floor 1', () => {
    const fours = (floor: number) =>
      SEEDS.filter((seed) => drawGroupSize(floor, seedRandom(seed), false, 2).value === 4).length;

    expect(fours(5)).toBeGreaterThan(fours(1) * 2);
  });

  it('never turns a draw into another size at tiers 2 and 3 after a group of 5', () => {
    expect(sizeWeights(5, true, 2)).toEqual([0, 1, 7, 9, 0]);
    expect(sizeWeights(5, true, 3)).toEqual([0, 0, 5, 8, 0]);
  });
});

describe('the enemies drawn at tiers 2 and 3 (#38)', () => {
  it('draws only the enemies of tier 2, every one of them, never one of tier 3', () => {
    const drawn = new Set(groups(2, 4).flat());

    expect(drawn).toEqual(
      new Set(['ghoul', 'madVillager', 'thornPilgrim', 'ashBramble', 'ashGleaner']),
    );
  });

  it('draws only the enemies of tier 3, every one of them, never a Ghoul nor one of tier 2', () => {
    const drawn = new Set(groups(3, 3).flat());

    expect(drawn).toEqual(new Set(['skeleton', 'specter', 'necromancer', 'bronzeWarden']));
  });

  it('keeps each cap: at most 1 of each enemy, the Ghoul excepted (5 at most)', () => {
    for (const tier of [2, 3] as const) {
      for (const size of [2, 3, 4]) {
        for (const group of groups(tier, size)) {
          expect(group).toHaveLength(size);
          for (const { kind, cap } of TIERS[tier].enemies) {
            expect(group.filter((each) => each === kind).length).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
  });

  it('never draws a support alone: an Ash gleaner or a Necromancer is always accompanied', () => {
    expect(groups(2, 1).flat()).not.toContain('ashGleaner');
    expect(groups(3, 1).flat()).not.toContain('necromancer');
    for (const group of [...groups(2, 2), ...groups(3, 3)]) expect(group.length).toBeGreaterThan(1);
  });

  it('draws the group from left to right with the same seed, the same way', () => {
    expect(drawGroup(3, seedRandom(5), 2)).toEqual(drawGroup(3, seedRandom(5), 2));
  });
});
