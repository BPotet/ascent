import { startAscent, type Ascent } from './Ascent';
import { loadoutOf, loadoutSize } from './loadout';

/** Une ascension avec ces bénédictions de départ et ces bienfaits. */
function ascentWith(blessings: Ascent['blessings'], boons: Ascent['hero']['boons']): Ascent {
  const ascent = startAscent(42);
  return { ...ascent, blessings, hero: { ...ascent.hero, boons } };
}

describe('loadout (#159)', () => {
  it('holds the starting blessings first, then the boons in the order they were won', () => {
    const ascent = ascentWith(
      [
        { family: 'protection', rarity: 'epic' },
        { family: 'haste', rarity: 'rare' },
      ],
      ['perfectEcho', 'lingeringFrost', 'shatteringEmber'],
    );

    const loadout = loadoutOf(ascent);

    expect(loadout).toEqual({
      blessings: [
        { family: 'protection', rarity: 'epic' },
        { family: 'haste', rarity: 'rare' },
      ],
      boons: ['perfectEcho', 'lingeringFrost', 'shatteringEmber'],
      reserves: { gold: 0, keys: 0 },
      powers: ['bulwark'],
    });
    expect(loadout.blessings).toBe(ascent.blessings);
    expect(loadout.boons).toBe(ascent.hero.boons);
  });

  it('counts the starting blessings and the boons together', () => {
    const loadout = loadoutOf(
      ascentWith(
        [
          { family: 'protection', rarity: 'epic' },
          { family: 'haste', rarity: 'rare' },
          { family: 'vigor', rarity: 'common' },
        ],
        ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
      ),
    );

    expect(loadoutSize(loadout)).toBe(8);
  });

  it('is empty at the start of an ascent without blessing (Neutral gauge)', () => {
    const loadout = loadoutOf(startAscent(42));

    expect(loadout).toEqual({
      blessings: [],
      boons: [],
      reserves: { gold: 0, keys: 0 },
      powers: ['bulwark'],
    });
    expect(loadoutSize(loadout)).toBe(0);
  });

  it('holds only the boons of an ascent without blessing', () => {
    const loadout = loadoutOf(ascentWith([], ['frostSkin', 'trueEdge']));

    expect(loadout).toEqual({
      blessings: [],
      boons: ['frostSkin', 'trueEdge'],
      reserves: { gold: 0, keys: 0 },
      powers: ['bulwark'],
    });
    expect(loadoutSize(loadout)).toBe(2);
  });

  it('holds only the blessings before the first boon', () => {
    const loadout = loadoutOf(ascentWith([{ family: 'haste', rarity: 'rare' }], []));

    expect(loadoutSize(loadout)).toBe(1);
    expect(loadout.boons).toEqual([]);
  });
});

describe('the favor of the ascent in the loadout (#42)', () => {
  it.each([1, 2] as const)(
    'holds the rerolls left of %p given at the start under the favor',
    (gauge) => {
      const ascent = { ...startAscent(42, { gauge }), rerolls: gauge - 1 };

      expect(loadoutOf(ascent).favor).toMatchObject({
        gauge,
        rerollsLeft: gauge - 1,
        rerollsGranted: gauge,
      });
    },
  );

  it.each([0, -1, -2] as const)('has no favor at a gauge of %p', (gauge) => {
    expect(loadoutOf(startAscent(42, { gauge }))).not.toHaveProperty('favor');
  });
});

describe('the second chance of the favor in the loadout (#206)', () => {
  it('is ready, then used, under the full favor', () => {
    const ascent = startAscent(42, { gauge: 2 });

    expect(loadoutOf(ascent).favor).toEqual({
      gauge: 2,
      rerollsLeft: 2,
      rerollsGranted: 2,
      secondChance: 'ready',
    });
    expect(loadoutOf({ ...ascent, secondChance: false }).favor?.secondChance).toBe('used');
  });

  it('is absent under the favor of +1', () => {
    expect(loadoutOf(startAscent(42, { gauge: 1 })).favor).not.toHaveProperty('secondChance');
  });
});

describe('the reserves of the ascent in the loadout (#226)', () => {
  it.each([2, 1, 0, -1, -2] as const)(
    'always holds the Gold and the keys, at a gauge of %p',
    (gauge) => {
      const ascent = { ...startAscent(42, { gauge }), gold: 35, keys: 2 };

      expect(loadoutOf(ascent).reserves).toEqual({ gold: 35, keys: 2 });
    },
  );

  it('never counts the keys in the favor of the ascent', () => {
    expect(loadoutOf(startAscent(42, { gauge: 1 })).favor).not.toHaveProperty('keys');
  });

  it('counts neither the Gold nor the keys in the size of the loadout', () => {
    expect(loadoutSize(loadoutOf({ ...startAscent(42), gold: 35, keys: 2 }))).toBe(0);
  });
});
