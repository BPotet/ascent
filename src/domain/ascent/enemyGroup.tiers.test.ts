// Les groupes d'ennemis des paliers 2 et 3 (#38, § 3.2) : leur taille selon l'étage, leurs
// ennemis, les plafonds, et un soutien jamais seul.
import { seedRandom } from '../battle/SeededRandom';
import { drawGroup, drawGroupSize, sizeWeights } from './enemyGroup';
import { TIERS, type Tier } from './tiers';

const SEEDS = Array.from({ length: 600 }, (_, index) => index * 2_654_435_761);
/**
 * Les ennemis du palier 3 (#214) : les trois qui restent, les trois du Beffroi, puis le Bélier de
 * bronze et le Battant de cloche (#266).
 */
/** Les ennemis du palier 2 (#213), puis la Cosse de braise et la Phalène voleuse (#267). */
const ASH_GARDENS = [
  'thornPilgrim',
  'ashBramble',
  'ashGleaner',
  'burningHusk',
  'mothkin',
  'emberPod',
  'thievingMoth',
];
const BELFRY = new Set([
  'bronzeWarden',
  'gargoyle',
  'bellFounder',
  'bellNovice',
  'matinsRinger',
  'clockJack',
  'bronzeRam',
  'bellClapper',
]);

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
  it('draws only the enemies of tier 2, every one of them, never one of tier 3 (#267)', () => {
    const drawn = new Set(groups(2, 4).flat());

    expect(drawn).toEqual(new Set(ASH_GARDENS));
  });

  it('never draws a Ghoul nor a Mad villager at tier 2, for 200 seeds (#213)', () => {
    const drawn = SEEDS.slice(0, 200).flatMap((seed) =>
      [1, 2, 3, 4, 5].flatMap((floor) => {
        const size = drawGroupSize(floor, seedRandom(seed), false, 2);
        return drawGroup(size.value, size.random, 2).value;
      }),
    );

    expect(drawn).not.toContain('ghoul');
    expect(drawn).not.toContain('madVillager');
    expect(new Set(drawn)).toEqual(new Set(ASH_GARDENS));
  });

  it('draws exactly the eight enemies of tier 3, none of tiers 1 and 2 (#214, #266)', () => {
    const drawn = new Set([...groups(3, 3), ...groups(3, 4)].flat());

    expect(drawn).toEqual(BELFRY);
  });

  it('never draws a Skeleton, a Specter, a Necromancer nor a Mothkin at tier 3, for 200 seeds (#214)', () => {
    const drawn = SEEDS.slice(0, 200).flatMap((seed) =>
      [1, 2, 3, 4, 5].flatMap((floor) => {
        const size = drawGroupSize(floor, seedRandom(seed), false, 3);
        return drawGroup(size.value, size.random, 3).value;
      }),
    );

    for (const kind of ['skeleton', 'specter', 'necromancer', 'mothkin']) {
      expect(drawn).not.toContain(kind);
    }
    expect(new Set(drawn)).toEqual(BELFRY);
  });

  it('keeps each cap: at most 1 of each enemy, 2 Mothkin at tier 2, 2 Bell novices at tier 3', () => {
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

  it('never draws a support alone: an Ash gleaner or a Matins ringer is always accompanied', () => {
    expect(groups(2, 1).flat()).not.toContain('ashGleaner');
    expect(groups(3, 1).flat()).not.toContain('matinsRinger');
    for (const group of [...groups(2, 2), ...groups(3, 3)]) expect(group.length).toBeGreaterThan(1);
  });

  it('draws the Matins ringer with at least one other enemy, in groups of 3 and of 4 (#214)', () => {
    const withRinger = [...groups(3, 3), ...groups(3, 4)].filter((group) =>
      group.includes('matinsRinger'),
    );

    expect(withRinger.length).toBeGreaterThan(0);
    for (const group of withRinger) {
      expect(group.filter((kind) => kind !== 'matinsRinger').length).toBeGreaterThan(0);
    }
  });

  it.each(['emberPod', 'thievingMoth'])(
    'draws at most 1 %s in a group of tier 2, and none at tiers 1 and 3 (#267)',
    (kind) => {
      const count = (group: readonly string[]) => group.filter((each) => each === kind).length;

      expect(new Set(groups(2, 4).map(count))).toEqual(new Set([0, 1]));
      for (const tier of [1, 3] as const) {
        expect(groups(tier, 4).flat()).not.toContain(kind);
      }
    },
  );

  it('draws up to 2 Mothkin in a group of tier 2, never more (#172)', () => {
    const counts = groups(2, 4).map((group) => group.filter((kind) => kind === 'mothkin').length);
    expect(new Set(counts)).toEqual(new Set([0, 1, 2]));
  });

  it('draws up to 2 Bell novices in a group of tier 3, never 3 (#214)', () => {
    for (const size of [3, 4]) {
      const counts = groups(3, size).map(
        (group) => group.filter((kind) => kind === 'bellNovice').length,
      );
      expect(new Set(counts)).toEqual(new Set([0, 1, 2]));
    }
  });

  it('draws the group from left to right with the same seed, the same way', () => {
    expect(drawGroup(3, seedRandom(5), 2)).toEqual(drawGroup(3, seedRandom(5), 2));
  });
});
