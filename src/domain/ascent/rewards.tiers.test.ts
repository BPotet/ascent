// L'Or, les Élites et les boss par palier (#38, § 3.2 et § 3.5).
import { seedRandom } from '../battle/SeededRandom';
import { drawElite } from './elites';
import { bossGold, drawBoss, drawCombatGold, eliteGold } from './rewards';
import { TIERS } from './tiers';

const SEEDS = Array.from({ length: 300 }, (_, index) => index * 2_654_435_761);

describe('the Gold of each tier (#38)', () => {
  it('gives (9 + 2 to 6) × 1.5, rounded down, for 3 enemies at tier 3: 16 to 22', () => {
    const golds = new Set(SEEDS.map((seed) => drawCombatGold(3, seedRandom(seed), 150).value));

    expect(golds).toEqual(new Set([16, 18, 19, 21, 22]));
  });

  it('gives (3 per enemy + 2 to 6) × 1.25 at tier 2, and the Gold of tier 1 by default', () => {
    const tierTwo = new Set(SEEDS.map((seed) => drawCombatGold(2, seedRandom(seed), 125).value));

    expect(tierTwo).toEqual(new Set([10, 11, 12, 13, 15]));
    expect(drawCombatGold(2, seedRandom(9))).toEqual(drawCombatGold(2, seedRandom(9), 100));
  });

  it('gives the Elite 25, 31 and 37 Gold, the boss 40, 50 and 60', () => {
    expect([1, 2, 3].map((tier) => eliteGold(tier as 1))).toEqual([25, 31, 37]);
    expect([1, 2, 3].map((tier) => bossGold(tier as 1))).toEqual([40, 50, 60]);
  });
});

describe('the Elites and the bosses of each tier (#38)', () => {
  it('draws the First pilgrim or the Stone saint at tier 3, evenly', () => {
    const drawn = SEEDS.map((seed) => drawElite(TIERS[3].elites, seedRandom(seed)).value);

    expect(new Set(drawn)).toEqual(new Set(['firstPilgrim', 'stoneSaint']));
    expect(drawn.filter((elite) => elite === 'firstPilgrim').length).toBeGreaterThan(120);
  });

  it('does not draw the Scarecrow, alone at tier 2: the random state stays', () => {
    const random = seedRandom(4);

    expect(drawElite(TIERS[2].elites, random)).toEqual({ value: 'scarecrow', random });
  });

  it('draws the Hour ringer or the Wish granter at tier 3, evenly', () => {
    const drawn = SEEDS.map((seed) => drawBoss(seedRandom(seed), TIERS[3].bosses).value);

    expect(new Set(drawn)).toEqual(new Set(['hourRinger', 'wishGranter']));
    expect(drawn.filter((boss) => boss === 'hourRinger').length).toBeGreaterThan(120);
  });

  it('meets the Ash gardener at tier 2, and the bosses of tier 1 by default', () => {
    expect(drawBoss(seedRandom(4), TIERS[2].bosses).value).toBe('ashGardener');
    expect(drawBoss(seedRandom(4))).toEqual(drawBoss(seedRandom(4), TIERS[1].bosses));
  });
});
