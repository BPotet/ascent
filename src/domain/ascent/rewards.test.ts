import { seedRandom } from '../battle/SeededRandom';
import { BOSS_GOLD, ELITE_GOLD, campfireHeal, drawBoss, drawCombatGold } from './rewards';

const SEEDS = Array.from({ length: 300 }, (_, index) => index * 2_654_435_761);

describe('Gold (P7)', () => {
  const golds = (size: number) =>
    new Set(SEEDS.map((seed) => drawCombatGold(size, seedRandom(seed)).value));

  it('gives 3 Gold per enemy + 2 to 6 for an ordinary battle', () => {
    expect(golds(1)).toEqual(new Set([5, 6, 7, 8, 9]));
    expect(golds(5)).toEqual(new Set([17, 18, 19, 20, 21]));
  });

  it('gives 25 Gold for the Elite and 40 for the boss', () => {
    expect(ELITE_GOLD).toBe(25);
    expect(BOSS_GOLD).toBe(40);
  });
});

describe('Campfire (P5)', () => {
  it('heals 40 % of the max HP, rounded down', () => {
    expect(campfireHeal({ hp: 30, maxHp: 80 })).toBe(62);
  });

  it('never heals above the max HP', () => {
    expect(campfireHeal({ hp: 70, maxHp: 80 })).toBe(80);
  });
});

describe('Boss (P6)', () => {
  it('draws one of the two bosses', () => {
    expect(new Set(SEEDS.map((seed) => drawBoss(seedRandom(seed)).value))).toEqual(
      new Set(['ossuaryWarden', 'facelessPrior']),
    );
  });
});
