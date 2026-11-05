// Les relances de la faveur dans l'ascension (#42) : données au lancement selon la jauge, sur un
// flux de hasard à elles ; les autres tirages de l'ascension ne bougent pas.
import { nextRandom, type RandomState } from '../battle/SeededRandom';
import {
  abandonAscent,
  canReroll,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  rerollBoonOffer,
  rerollStream,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from './Ascent';
import { boonPool, drawBoonOffer, type BoonKind } from './boons';
import type { FateGauge } from './fateGauge';
import { drawLoot } from './items';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** L'offre après le premier combat, à la jauge `gauge`. */
const offered = (seed = 9, gauge: FateGauge = 2) => won(startAscent(seed, { gauge }));

/** L'ascension devant un combat ordinaire du palier `tier`, le héros avec `boons`, en faveur. */
function before(tier: 1 | 2 | 3, boons: readonly BoonKind[]): Ascent {
  const ascent = startAscent(11, { gauge: 2 });
  return {
    ...ascent,
    tier,
    floor: 2,
    hero: { ...ascent.hero, boons },
    encounter: { kind: 'combat', enemies: ['ghoul'], battleSeed: 1 },
  };
}

describe('the rerolls given at the start of the ascent (#42)', () => {
  it.each([
    [2, 2],
    [1, 1],
    [0, 0],
    [-1, 0],
    [-2, 0],
  ] as const)('at a gauge of %p, gives %p rerolls', (gauge, rerolls) => {
    const ascent = startAscent(5, { gauge });

    expect(ascent.rerolls).toBe(rerolls);
    expect(ascent.rerollRandom).toEqual(rerollStream(5));
  });

  it('derives the stream of the rerolls from the seed, apart from the other streams', () => {
    expect(rerollStream(5)).not.toEqual(rerollStream(6));
    expect(rerollStream(5)).not.toEqual(startAscent(5).lootRandom);
  });

  it('gives a new ascent its own rerolls, whatever the last one kept', () => {
    const ended = abandonAscent(offered(9, 2));
    expect(ended.rerolls).toBe(2);

    expect(startAscent(10, { gauge: 1 }).rerolls).toBe(1);
    expect(startAscent(10, { gauge: -1 }).rerolls).toBe(0);
  });
});

describe('canReroll (#42)', () => {
  it('is possible with a reroll and an offer showing fewer than all the boons left', () => {
    expect(canReroll(offered())).toBe(true);
  });

  it('is not possible without reroll, nor without offer', () => {
    expect(canReroll(offered(9, 0))).toBe(false);
    expect(canReroll({ ...offered(), rerolls: 0 })).toBe(false);
    expect(canReroll(startAscent(9, { gauge: 2 }))).toBe(false);
  });

  it('is not possible when the offer carries Second souffle: it already shows all the boons left', () => {
    const tierOne = won(before(1, boonPool(1).slice(0, 5)));
    expect(tierOne.boonOffer).toContain('secondBreath');
    expect(canReroll(tierOne)).toBe(false);

    const tierTwo = won(before(2, boonPool(2).slice(1)));
    expect(tierTwo.boonOffer).toEqual([boonPool(2)[0], 'secondBreath']);
    expect(canReroll(tierTwo)).toBe(false);
  });

  it('is not possible when every boon not owned is already in the offer, and keeps the rerolls', () => {
    const ascent = won(before(1, boonPool(1).slice(0, 4)));
    expect(ascent.boonOffer).toHaveLength(3);

    expect(canReroll(ascent)).toBe(false);
    expect(rerollBoonOffer(ascent)).toBe(ascent);
  });
});

describe('rerollBoonOffer (#42)', () => {
  it('replaces the offer, spends a reroll, and touches nothing else', () => {
    const ascent = offered();

    const rerolled = rerollBoonOffer(ascent);

    expect(rerolled.rerolls).toBe(1);
    expect(rerolled.boonOffer).toHaveLength(3);
    expect(rerolled.boonOffer!.some((card) => ascent.boonOffer!.includes(card))).toBe(false);
    expect(rerolled).toEqual({
      ...ascent,
      boonOffer: rerolled.boonOffer,
      rerolls: 1,
      rerollRandom: rerolled.rerollRandom,
    });
    expect(rerolled.rerollRandom).not.toEqual(ascent.rerollRandom);
  });

  it('rerolls the same offer twice, then no more', () => {
    const once = rerollBoonOffer(offered());

    const twice = rerollBoonOffer(once);

    expect(twice.rerolls).toBe(0);
    expect(twice.boonOffer!.some((card) => once.boonOffer!.includes(card))).toBe(false);
    expect(canReroll(twice)).toBe(false);
    expect(rerollBoonOffer(twice)).toBe(twice);
  });

  it('gives the same new offer for the same seed and the same choices', () => {
    expect(rerollBoonOffer(offered(21))).toEqual(rerollBoonOffer(offered(21)));
  });

  it('lets the player take a boon of the new offer', () => {
    const rerolled = rerollBoonOffer(offered());

    expect(chooseBoon(rerolled, 0).hero.boons).toEqual([rerolled.boonOffer![0]]);
  });

  it('keeps the doors, the Gold, the loot and the battle seeds of the walk without reroll', () => {
    /** Les tirages des étages suivants, la 1re carte et la 1re porte prises, jusqu'au boss. */
    const walk = (first: Ascent) => {
      const draws: unknown[] = [];
      let ascent = chooseExit(chooseBoon(first, 0), 0);
      while (ascent.floor < 6 && ascent.outcome === null) {
        if (ascent.encounter !== null) ascent = won(ascent);
        draws.push([ascent.exits, ascent.gold, ascent.foundItem, ascent.random, ascent.lootRandom]);
        ascent = chooseExit(ascent.boonOffer === null ? ascent : chooseBoon(ascent, 0), 0);
        draws.push(ascent.encounter);
      }
      return draws;
    };
    for (const seed of [3, 9, 21, 40]) {
      const ascent = offered(seed);
      expect(walk(rerollBoonOffer(ascent))).toEqual(walk(ascent));
    }
  });

  it('keeps its rerolls over the tier passages', () => {
    const ascent = { ...offered(), boonOffer: null, rerolls: 1 };

    const entered = enterNextTier({ ...ascent, passage: { to: 2, step: 'announce' } });

    expect(entered.rerolls).toBe(1);
    expect(entered.rerollRandom).toBe(ascent.rerollRandom);
  });
});

describe('the rerolls and Cœur de braise after an Elite (#42, #195)', () => {
  const HEART: AscentLaunch = { gauge: 2, unlocks: ['emberHeart'] };

  /** L'ascension devant l'Élite, le flux du butin à `lootRandom`. */
  const atElite = (lootRandom: RandomState): Ascent => {
    const ascent = startAscent(3, HEART);
    return {
      ...ascent,
      floor: 3,
      lootRandom,
      encounter: { kind: 'elite', enemies: ['twins'], battleSeed: 1 },
    };
  };
  /** Le tirage de Cœur de braise, × 100, après le butin et l'offre. */
  const heartPercent = (ascent: Ascent) => {
    const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
    return nextRandom(drawBoonOffer([], loot.random, 1).random).value * 100;
  };
  const states = (test: (percent: number) => boolean, count: number) => {
    const found: number[] = [];
    for (let state = 0; found.length < count; state += 1) {
      if (test(heartPercent(atElite(state)))) found.push(state);
    }
    return found;
  };

  it('never draws Cœur de braise again when its draw did not come out', () => {
    for (const state of states((percent) => percent >= 10, 30)) {
      const ended = won(atElite(state));
      expect(ended.boonOffer).not.toContain('emberHeart');

      const rerolled = rerollBoonOffer(ended);

      expect(rerolled.boonOffer).not.toContain('emberHeart');
      expect(rerollBoonOffer(rerolled).boonOffer).not.toContain('emberHeart');
      expect(rerolled.emberHeartOffered).toBe(false);
    }
  });

  it('keeps Cœur de braise at its place after one, then two rerolls', () => {
    for (const state of states((percent) => percent < 10, 5)) {
      const ended = won(atElite(state));
      expect(ended.boonOffer![2]).toBe('emberHeart');

      const once = rerollBoonOffer(ended);
      const twice = rerollBoonOffer(once);

      expect(once.boonOffer![2]).toBe('emberHeart');
      expect(once.boonOffer!.slice(0, 2).some((card) => ended.boonOffer!.includes(card))).toBe(
        false,
      );
      expect(twice.boonOffer![2]).toBe('emberHeart');
      expect(twice.emberHeartOffered).toBe(true);
      expect(chooseBoon(twice, 2).hero.boons).toEqual(['emberHeart']);
    }
  });
});
