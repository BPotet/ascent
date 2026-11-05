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

    expect(loadout).toEqual({ blessings: [], boons: [] });
    expect(loadoutSize(loadout)).toBe(0);
  });

  it('holds only the boons of an ascent without blessing', () => {
    const loadout = loadoutOf(ascentWith([], ['frostSkin', 'trueEdge']));

    expect(loadout).toEqual({ blessings: [], boons: ['frostSkin', 'trueEdge'] });
    expect(loadoutSize(loadout)).toBe(2);
  });

  it('holds only the blessings before the first boon', () => {
    const loadout = loadoutOf(ascentWith([{ family: 'haste', rarity: 'rare' }], []));

    expect(loadoutSize(loadout)).toBe(1);
    expect(loadout.boons).toEqual([]);
  });
});
