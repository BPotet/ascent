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
  it('draws the First pilgrim, the Stone saint or the Beadle at tier 3, a third each (#259)', () => {
    const drawn = SEEDS.map((seed) => drawElite(TIERS[3].elites, seedRandom(seed)).value);

    expect(new Set(drawn)).toEqual(new Set(['firstPilgrim', 'stoneSaint', 'beadle']));
    for (const elite of TIERS[3].elites) {
      expect(drawn.filter((each) => each === elite).length).toBeGreaterThan(70);
      expect(drawn.filter((each) => each === elite).length).toBeLessThan(130);
    }
  });

  it('draws the Scarecrow, the Bramble burner or the Bramble mother at tier 2, a third each (#171, #259)', () => {
    const drawn = SEEDS.map((seed) => drawElite(TIERS[2].elites, seedRandom(seed)).value);

    expect(new Set(drawn)).toEqual(new Set(['scarecrow', 'brambleBurner', 'brambleMother']));
    for (const elite of TIERS[2].elites) {
      expect(drawn.filter((each) => each === elite).length).toBeGreaterThan(70);
      expect(drawn.filter((each) => each === elite).length).toBeLessThan(130);
    }
  });

  it('draws the Hour ringer or the Wish granter at tier 3, evenly', () => {
    const drawn = SEEDS.map((seed) => drawBoss(seedRandom(seed), TIERS[3].bosses).value);

    expect(new Set(drawn)).toEqual(new Set(['hourRinger', 'wishGranter']));
    expect(drawn.filter((boss) => boss === 'hourRinger').length).toBeGreaterThan(120);
  });

  it('draws the Ash gardener or the Moth queen at tier 2, evenly (#172)', () => {
    const drawn = SEEDS.map((seed) => drawBoss(seedRandom(seed), TIERS[2].bosses).value);

    expect(new Set(drawn)).toEqual(new Set(['ashGardener', 'mothQueen']));
    expect(drawn.filter((boss) => boss === 'mothQueen').length).toBeGreaterThan(120);
    expect(drawn.filter((boss) => boss === 'mothQueen').length).toBeLessThan(180);
  });

  it('draws the bosses of tier 1 by default', () => {
    expect(drawBoss(seedRandom(4))).toEqual(drawBoss(seedRandom(4), TIERS[1].bosses));
  });
});
