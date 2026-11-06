// Les pouvoirs équipés de l'ascension (#235) : fixés au départ, dans l'ordre de l'arbre, gardés
// jusqu'à sa fin. Aucun tirage nouveau : les flux de hasard ne bougent pas.
import {
  abandonAscent,
  acknowledgeBossVictory,
  chooseBlessing,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
} from './Ascent';
import { loadoutOf } from './loadout';

describe('the equipped powers of an ascent (#235)', () => {
  it('equips the base power alone by default', () => {
    expect(startAscent(5).powers).toEqual(['bulwark']);
    expect(startAscent(5, { hero: 'wanderer' }).powers).toEqual(['shadowStep']);
  });

  it('keeps the given powers in the order of the tree, the powers of the hero only', () => {
    const ascent = startAscent(5, {
      hero: 'wanderer',
      powers: ['mist', 'shadowStep', 'rend', 'bulwark'],
    });

    expect(ascent.powers).toEqual(['shadowStep', 'rend', 'mist']);
  });

  it('draws nothing more: the same ascent apart from its powers', () => {
    for (const seed of [1, 5, 42, 9_001]) {
      const { powers: _, ...plain } = startAscent(seed, { hero: 'sentinel', gauge: 2 });
      const { powers: __, ...given } = startAscent(seed, {
        hero: 'sentinel',
        gauge: 2,
        powers: ['bulwark', 'retaliation', 'holdFast'],
      });
      expect(given).toEqual(plain);
    }
  });

  it('keeps its powers through the transitions, until its end', () => {
    const powers = ['bulwark', 'retaliation'] as const;
    let ascent = startAscent(7, { blessings: ['rare'], powers: [...powers] });
    ascent = chooseBlessing(ascent, 0);
    expect(ascent.powers).toEqual(powers);
    const won = endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
    expect(won.powers).toEqual(powers);
    if (won.exits.length > 0) expect(chooseExit(won, 0).powers).toEqual(powers);
    expect(abandonAscent(won).powers).toEqual(powers);
    const passed = { ...won, passage: null };
    expect(acknowledgeBossVictory(passed).powers).toEqual(powers);
    expect(enterNextTier(passed).powers).toEqual(powers);
  });

  it('shows the equipped powers in the Loadout', () => {
    const ascent = startAscent(5, { hero: 'wanderer', powers: ['shadowStep', 'rend', 'mist'] });

    expect(loadoutOf(ascent).powers).toEqual(['shadowStep', 'rend', 'mist']);
  });
});
