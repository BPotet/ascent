import { Day } from '../day/Day';
import { seedRandom } from '../battle/SeededRandom';
import {
  BLESSING_FAMILIES,
  blessingModifiers,
  blessingRarities,
  drawBlessingOffer,
  edgeAttack,
  heroMaxHp,
  vigorPercent,
} from './blessings';

const habit = (
  name: string,
  difficulty: 'easy' | 'medium' | 'hard',
  createdOn = Day.of(2026, 10, 1),
) => ({
  name,
  difficulty,
  createdOn,
});

describe('starting blessings (P25)', () => {
  it('gives one blessing per habit done yesterday, its rarity from the difficulty', () => {
    expect(blessingRarities([habit('Lire', 'easy'), habit('Courir', 'hard')])).toEqual([
      'epic',
      'common',
    ]);
    expect(blessingRarities([])).toEqual([]);
  });

  it('keeps at most 3: the hardest, then the oldest, then by name', () => {
    expect(
      blessingRarities([
        habit('A', 'easy'),
        habit('B', 'medium'),
        habit('C', 'hard'),
        habit('D', 'medium'),
      ]),
    ).toEqual(['epic', 'rare', 'rare']);
    const old = Day.of(2026, 9, 1);
    expect(
      blessingRarities([
        habit('Zen', 'easy', old),
        habit('Boire', 'easy'),
        habit('Avancer', 'easy'),
        habit('Ranger', 'easy', old),
      ]),
    ).toHaveLength(3);
  });

  it('orders equal habits by age then by name', () => {
    const old = Day.of(2026, 9, 1);
    const habits = [habit('Zen', 'easy'), habit('Boire', 'easy', old), habit('Avancer', 'easy')];
    expect(blessingRarities(habits)).toEqual(['common', 'common', 'common']);
  });

  it('offers 3 distinct families, never one already taken', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const offer = drawBlessingOffer(['vigor'], seedRandom(seed)).value;
      expect(new Set(offer).size).toBe(3);
      expect(offer).not.toContain('vigor');
    }
    expect(new Set(drawBlessingOffer(['vigor', 'haste'], seedRandom(1)).value)).toEqual(
      new Set(['momentum', 'edge', 'protection']),
    );
    expect(BLESSING_FAMILIES).toHaveLength(5);
  });

  it('rounds the Edge Attack to the nearest, at least +1', () => {
    expect(
      [10, 10, 10].map((base, i) => edgeAttack(base, (['common', 'rare', 'epic'] as const)[i]!)),
    ).toEqual([11, 12, 13]);
    expect(edgeAttack(6, 'common')).toBe(7);
    expect(edgeAttack(6, 'rare')).toBe(7);
    expect(edgeAttack(6, 'epic')).toBe(8);
  });
});

describe('maximum HP with Vigor and fatigue (P26)', () => {
  it('rounds once, down', () => {
    expect(heroMaxHp(80, 0, 10)).toBe(72);
    expect(heroMaxHp(80, 0, 20)).toBe(64);
    expect(heroMaxHp(80, 10, 10)).toBe(79);
    expect(heroMaxHp(80, 15, 0)).toBe(92);
  });

  it('reads the Vigor of the blessings', () => {
    expect(
      vigorPercent([
        { family: 'vigor', rarity: 'rare' },
        { family: 'haste', rarity: 'epic' },
      ]),
    ).toBe(10);
    expect(vigorPercent([])).toBe(0);
  });
});

describe('the battle modifiers of the blessings', () => {
  const all = (rarity: 'common' | 'rare' | 'epic') =>
    BLESSING_FAMILIES.map((family) => ({ family, rarity }));

  it('turns Edge, Protection, Haste and Momentum into modifiers', () => {
    expect(blessingModifiers(all('rare'), { firstBattle: false, attackPower: 10 })).toMatchObject({
      attackFlat: 2,
      damageReductionPoints: 10,
      initiative: 2,
      startingMomentum: 1,
    });
    expect(blessingModifiers(all('epic'), { firstBattle: false, attackPower: 10 })).toMatchObject({
      startingMomentum: 2,
    });
    expect(
      (['common', 'rare', 'epic'] as const).map(
        (rarity) =>
          blessingModifiers([{ family: 'protection', rarity }], {
            firstBattle: false,
            attackPower: 10,
          }).damageReductionPoints,
      ),
    ).toEqual([5, 10, 15]);
  });

  it('changes nothing without blessings', () => {
    expect(blessingModifiers([], { firstBattle: true, attackPower: 10 })).toEqual({
      attackFlat: 0,
      damageReductionPoints: 0,
      initiative: 0,
      startingMomentum: 0,
    });
  });

  it('gives the Common Momentum to the first battle only', () => {
    expect(
      blessingModifiers(all('common'), { firstBattle: true, attackPower: 10 }).startingMomentum,
    ).toBe(1);
    expect(
      blessingModifiers(all('common'), { firstBattle: false, attackPower: 10 }).startingMomentum,
    ).toBe(0);
  });
});
