// La seconde chance de la faveur dans l'ascension (#206) : donnée au lancement par la faveur
// pleine, gardée jusqu'à la fin de l'ascension ; elle disparaît quand un combat dit qu'elle a servi.
import {
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  rerollBoonOffer,
  startAscent,
  type Ascent,
} from './Ascent';
import { shardSum } from './shards';

const won = (ascent: Ascent, secondChanceUsed?: boolean) =>
  endFloorBattle(ascent, {
    outcome: 'victory',
    heroHp: 40,
    ...(secondChanceUsed !== undefined && { secondChanceUsed }),
  });

/** L'ascension devant le boss du palier 1. */
function beforeBoss(gauge: 0 | 2): Ascent {
  const ascent = startAscent(11, { gauge });
  return {
    ...ascent,
    floor: 6,
    encounter: { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 },
  };
}

describe('the second chance given at the start of the ascent (#206)', () => {
  it.each([
    [2, true],
    [1, false],
    [0, false],
    [-1, false],
    [-2, false],
  ] as const)('at a gauge of %p, is %p', (gauge, secondChance) => {
    expect(startAscent(5, { gauge }).secondChance).toBe(secondChance);
  });

  it('draws nothing: the streams of the ascent are those of a gauge of +1', () => {
    const full = startAscent(5, { gauge: 2 });
    const favor = startAscent(5, { gauge: 1 });

    expect([full.random, full.lootRandom, full.rerollRandom]).toEqual([
      favor.random,
      favor.lootRandom,
      favor.rerollRandom,
    ]);
    expect(full.encounter).toEqual(favor.encounter);
  });
});

describe('endFloorBattle with the second chance (#206)', () => {
  it('takes it away when it was used in a won battle', () => {
    expect(won(startAscent(5, { gauge: 2 }), true).secondChance).toBe(false);
  });

  it('takes it away when the hero falls after rising', () => {
    const fallen = endFloorBattle(startAscent(5, { gauge: 2 }), {
      outcome: 'defeat',
      heroHp: 0,
      secondChanceUsed: true,
    });

    expect(fallen).toMatchObject({ outcome: 'fall', secondChance: false });
  });

  it('keeps it when the battle does not say it was used', () => {
    expect(won(startAscent(5, { gauge: 2 })).secondChance).toBe(true);
    expect(won(startAscent(5, { gauge: 2 }), false).secondChance).toBe(true);
  });

  it('never gives it back', () => {
    const used = won(startAscent(5, { gauge: 2 }), true);
    const next = chooseExit(chooseBoon(used, 0), 0);

    expect(won(next).secondChance).toBe(false);
  });

  it('changes no draw: the same ascent with and without it used', () => {
    const ascent = startAscent(5, { gauge: 2 });
    const { secondChance: _, ...used } = won(ascent, true);
    const { secondChance: __, ...kept } = won(ascent);

    expect(used).toEqual(kept);
  });

  it('gives the same 8 Shards for the boss of tier 1, with or without it used', () => {
    const shards = (gauge: 0 | 2, used: boolean) =>
      shardSum(won(beforeBoss(gauge), used).shardAwards);

    expect(shards(2, true)).toBe(8);
    expect(shards(0, false)).toBe(8);
  });
});

describe('the second chance through the ascent (#206)', () => {
  it('crosses the tier passage', () => {
    const passed = enterNextTier(acknowledgeBossVictory(won(beforeBoss(2))));

    expect(passed).toMatchObject({ tier: 2, floor: 1, secondChance: true });
  });

  it('is untouched by a reroll and a boon', () => {
    const offered = won(startAscent(9, { gauge: 2 }));

    expect(chooseBoon(rerollBoonOffer(offered), 0).secondChance).toBe(true);
  });
});
