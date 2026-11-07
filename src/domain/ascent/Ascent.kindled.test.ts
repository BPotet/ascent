// Les pouvoirs attisés de l'ascension (#237) : figés au départ, parmi les pouvoirs équipés de 2 Élan
// ou plus, gardés jusqu'à sa fin ; aucun tirage nouveau.
import {
  abandonAscent,
  chooseBlessing,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  kindledOf,
  startAscent,
} from './Ascent';
import { loadoutOf } from './loadout';

describe('the kindled powers of an ascent (#237)', () => {
  it('kindles nothing by default', () => {
    expect(startAscent(5).kindled).toEqual([]);
    expect(kindledOf(startAscent(5))).toEqual([]);
  });

  it('keeps the kindled powers among the equipped ones of 2 Momentum or more, once each', () => {
    const ascent = startAscent(5, {
      hero: 'sentinel',
      powers: ['bulwark', 'retaliation'],
      kindled: [
        { power: 'retaliation', habit: 12 },
        { power: 'holdFast', habit: 13 },
        { power: 'bulwark', habit: 14 },
        { power: 'retaliation', habit: 15 },
      ],
    });

    expect(ascent.kindled).toEqual([{ power: 'retaliation', habit: 12 }]);
    expect(kindledOf(ascent)).toEqual(['retaliation']);
  });

  it('draws nothing more: the same ascent apart from its kindled powers', () => {
    for (const seed of [1, 5, 42, 9_001]) {
      const launch = {
        hero: 'wanderer' as const,
        gauge: 2 as const,
        powers: ['shadowStep' as const],
      };
      const { kindled: _, ...plain } = startAscent(seed, launch);
      const { kindled: __, ...kindled } = startAscent(seed, {
        ...launch,
        kindled: [{ power: 'shadowStep', habit: 1 }],
      });
      expect(kindled).toEqual(plain);
    }
  });

  it('keeps them through the transitions, until its end', () => {
    const kindled = [{ power: 'retaliation' as const, habit: 3 }];
    let ascent = startAscent(7, {
      blessings: ['rare'],
      powers: ['bulwark', 'retaliation'],
      kindled,
    });
    ascent = chooseBlessing(ascent, 0);
    const won = endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
    expect(won.kindled).toEqual(kindled);
    if (won.exits.length > 0) expect(chooseExit(won, 0).kindled).toEqual(kindled);
    expect(abandonAscent(won).kindled).toEqual(kindled);
    expect(enterNextTier({ ...won, passage: null }).kindled).toEqual(kindled);
  });

  it('shows the kindled powers in the Loadout', () => {
    const ascent = startAscent(5, {
      powers: ['bulwark', 'retaliation'],
      kindled: [{ power: 'retaliation', habit: 3 }],
    });

    expect(loadoutOf(ascent).kindled).toEqual([{ power: 'retaliation', habit: 3 }]);
    expect(loadoutOf(startAscent(5)).kindled).toEqual([]);
  });
});
