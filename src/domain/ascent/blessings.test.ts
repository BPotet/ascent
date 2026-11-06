import { Day } from '../day/Day';
import { nextRandom, seedRandom, type RandomState } from '../battle/SeededRandom';
import {
  BLESSING_EFFECTS,
  BLESSING_FAMILIES,
  blessingKeys,
  blessingModifiers,
  blessingRarities,
  drawBlessingOffer,
  heroMaxHp,
  vigorPercent,
} from './blessings';

/** L'offre de la graine 1 sans Vigueur ni Hâte, à 6 familles (#226). */
const OFFER_AFTER_VIGOR_AND_HASTE = ['momentum', 'protection', 'fortune'];

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
      new Set(OFFER_AFTER_VIGOR_AND_HASTE),
    );
    expect(BLESSING_FAMILIES).toHaveLength(6);
  });

  it('gives the Edge as an Attack bonus in %, added to the items before rounding (#152)', () => {
    expect(
      (['common', 'rare', 'epic'] as const).map(
        (rarity) =>
          blessingModifiers([{ family: 'edge', rarity }], { firstBattle: false })
            .attackBonusPercent,
      ),
    ).toEqual([10, 20, 30]);
  });
});

describe('the Fortune family (#226)', () => {
  /** L'état du flux après `count` tirages. */
  const after = (random: RandomState, count: number): RandomState =>
    count === 0 ? random : after(nextRandom(random).state, count - 1);

  it('is the sixth family, the last one, and Purse is never one', () => {
    expect(BLESSING_FAMILIES).toEqual([
      'vigor',
      'momentum',
      'edge',
      'protection',
      'haste',
      'fortune',
    ]);
    expect(BLESSING_FAMILIES as readonly string[]).not.toContain('purse');
  });

  it('can be offered, never twice, never once taken', () => {
    const offers = Array.from({ length: 60 }, (_, seed) => drawBlessingOffer([], seedRandom(seed)));
    expect(offers.some(({ value }) => value.includes('fortune'))).toBe(true);
    for (let seed = 0; seed < 60; seed += 1) {
      expect(drawBlessingOffer(['fortune'], seedRandom(seed)).value).not.toContain('fortune');
    }
  });

  it('gives 1, 2 and 3 keys, as in the Codex of the Workshop, and none for the other families', () => {
    expect(BLESSING_EFFECTS.fortune).toEqual({ common: 1, rare: 2, epic: 3 });
    expect(
      (['common', 'rare', 'epic'] as const).map((rarity) =>
        blessingKeys({ family: 'fortune', rarity }),
      ),
    ).toEqual([1, 2, 3]);
    for (const family of BLESSING_FAMILIES.filter((each) => each !== 'fortune')) {
      expect(blessingKeys({ family, rarity: 'epic' })).toBe(0);
    }
  });

  it('changes nothing in battle nor in the maximum HP (F4)', () => {
    const fortune = [{ family: 'fortune', rarity: 'epic' }] as const;
    expect(blessingModifiers(fortune, { firstBattle: true })).toEqual(
      blessingModifiers([], { firstBattle: true }),
    );
    expect(vigorPercent(fortune)).toBe(0);
  });

  it('keeps 3 draws per offer: the stream is where it was with 5 families', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const random = seedRandom(seed);
      const first = drawBlessingOffer([], random);
      expect(first.random).toBe(after(random, 3));
      const second = drawBlessingOffer([first.value[0]!], first.random);
      expect(second.random).toBe(after(random, 6));
      const third = drawBlessingOffer([first.value[0]!, second.value[0]!], second.random);
      expect(third.random).toBe(after(random, 9));
    }
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
    expect(blessingModifiers(all('rare'), { firstBattle: false })).toMatchObject({
      attackBonusPercent: 20,
      damageReductionPoints: 10,
      initiative: 2,
      startingMomentum: 1,
    });
    expect(blessingModifiers(all('epic'), { firstBattle: false })).toMatchObject({
      startingMomentum: 2,
    });
    expect(
      (['common', 'rare', 'epic'] as const).map(
        (rarity) =>
          blessingModifiers([{ family: 'protection', rarity }], {
            firstBattle: false,
          }).damageReductionPoints,
      ),
    ).toEqual([5, 10, 15]);
  });

  it('changes nothing without blessings', () => {
    expect(blessingModifiers([], { firstBattle: true })).toEqual({
      attackBonusPercent: 0,
      damageReductionPoints: 0,
      initiative: 0,
      startingMomentum: 0,
    });
  });

  it('gives the Common Momentum to the first battle only', () => {
    expect(blessingModifiers(all('common'), { firstBattle: true }).startingMomentum).toBe(1);
    expect(blessingModifiers(all('common'), { firstBattle: false }).startingMomentum).toBe(0);
  });
});
