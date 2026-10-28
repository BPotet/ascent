import {
  TOP_FLOOR,
  abandonAscent,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from './Ascent';
import { ELITES, drawElite } from './elites';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761 + 11);

/** Le combat gagné, puis le 1er bienfait de l'offre pris (#92). */
const won = (ascent: Ascent, heroHp = ascent.hero.hp) => {
  const ended = endFloorBattle(ascent, { outcome: 'victory', heroHp });
  return ended.boonOffer === null ? ended : chooseBoon(ended, 0);
};

/** Une ascension aux sorties de l'étage, prises par `pick` jusqu'à l'étage `floor`. */
function climbTo(seed: number, floor: number, pick: (ascent: Ascent) => number = () => 0): Ascent {
  let ascent = startAscent(seed);
  while (ascent.floor < floor) {
    ascent = ascent.encounter === null ? chooseExit(ascent, pick(ascent)) : won(ascent);
  }
  return ascent;
}

describe('startAscent (P1, P3, P9)', () => {
  it('starts at floor 1 with the Sentinel at max HP, no Gold, and a battle of 1 to 3 enemies', () => {
    for (const seed of SEEDS) {
      const ascent = startAscent(seed);
      expect(ascent).toMatchObject({
        floor: 1,
        hero: { hp: 80, maxHp: 80 },
        gold: 0,
        outcome: null,
      });
      expect(ascent.encounter?.kind).toBe('combat');
      expect(ascent.encounter!.enemies.length).toBeGreaterThanOrEqual(1);
      expect(ascent.encounter!.enemies.length).toBeLessThanOrEqual(3);
    }
  });

  it('gives the same ascent for the same seed, and another for another seed', () => {
    expect(climbTo(5, 6)).toEqual(climbTo(5, 6));
    expect(startAscent(5)).not.toEqual(startAscent(6));
  });

  it('draws a battle seed for each battle', () => {
    const first = startAscent(5);
    const second = chooseExit(won(first), 0);
    expect(second.encounter?.battleSeed ?? 1).not.toBe(first.encounter!.battleSeed);
  });
});

describe('endFloorBattle and chooseExit (P1, P2, P7)', () => {
  it('earns the Gold of the battle, then offers 2 doors of distinct types', () => {
    const ascent = startAscent(9);
    const size = ascent.encounter!.enemies.length;

    const after = won(ascent, 60);

    expect(after.gold).toBeGreaterThanOrEqual(3 * size + 2);
    expect(after.gold).toBeLessThanOrEqual(3 * size + 6);
    expect(after.lastGold).toBe(after.gold);
    expect(after.hero.hp).toBe(60);
    expect(after.encounter).toBeNull();
    expect(after.exits).toHaveLength(2);
    expect(after.exits[0]!.kind).not.toBe(after.exits[1]!.kind);
  });

  it('announces the group size on a Combat door, and fights a group of that size behind it', () => {
    for (const seed of SEEDS) {
      const ascent = won(startAscent(seed));
      const index = ascent.exits.findIndex((exit) => exit.kind === 'combat');
      if (index < 0) continue;
      const entered = chooseExit(ascent, index);
      expect(entered.floor).toBe(2);
      expect(entered.encounter?.kind).toBe('combat');
      expect(entered.encounter!.enemies).toHaveLength(ascent.exits[index]!.groupSize!);
    }
  });

  it('fights the Elite drawn with the seed of the ascent behind an Elite door, for 25 Gold (K8)', () => {
    const ascent = SEEDS.map((seed) => won(startAscent(seed))).find((candidate) =>
      candidate.exits.some((exit) => exit.kind === 'elite'),
    )!;
    const entered = chooseExit(
      ascent,
      ascent.exits.findIndex((exit) => exit.kind === 'elite'),
    );

    const elite = drawElite(ELITES, ascent.random);
    expect(entered.encounter).toMatchObject({ kind: 'elite', enemies: [elite.value] });
    expect(won(entered).gold - ascent.gold).toBe(25);
  });

  it('heals at a Campfire, without Gold, and offers the next doors', () => {
    const ascent = SEEDS.map((seed) => won(startAscent(seed), 30)).find((candidate) =>
      candidate.exits.some((exit) => exit.kind === 'campfire'),
    )!;

    const rested = chooseExit(
      ascent,
      ascent.exits.findIndex((exit) => exit.kind === 'campfire'),
    );

    expect(rested).toMatchObject({
      floor: 2,
      hero: { hp: 62 },
      gold: ascent.gold,
      encounter: null,
    });
    expect(rested.lastGold).toBe(0);
    expect(rested.exits).toHaveLength(2);
  });

  it('guarantees a Campfire door at floor 3 when floor 2 offered none', () => {
    for (const seed of SEEDS) {
      const atTwo = won(startAscent(seed));
      if (atTwo.exits.some((exit) => exit.kind === 'campfire')) continue;
      const atThree = won(chooseExit(atTwo, 0));
      expect(atThree.exits.map((exit) => exit.kind)).toContain('campfire');
    }
  });

  it('meets at most one group of 5 per ascent', () => {
    for (const seed of SEEDS) {
      let ascent = startAscent(seed);
      let fives = 0;
      while (ascent.floor < TOP_FLOOR) {
        if (ascent.encounter === null) {
          const combat = ascent.exits.findIndex((exit) => exit.kind === 'combat');
          ascent = chooseExit(ascent, Math.max(0, combat));
          if (ascent.encounter?.enemies.length === 5) fives += 1;
        } else {
          ascent = won(ascent);
        }
      }
      expect(fives).toBeLessThanOrEqual(1);
    }
  });

  it('reaches the boss at floor 6, through a single boss door after floor 5', () => {
    const atFive = climbTo(3, 5);
    const beforeBoss = atFive.encounter === null ? atFive : won(atFive);

    expect(beforeBoss.exits).toEqual([{ kind: 'boss', groupSize: null }]);
    const boss = chooseExit(beforeBoss, 0);
    expect(boss.floor).toBe(TOP_FLOOR);
    expect(boss.encounter?.kind).toBe('boss');
    expect(['ossuaryWarden', 'facelessPrior']).toContain(boss.encounter!.enemies[0]);
  });

  it('ignores a door that does not exist, or a choice during a battle', () => {
    const ascent = won(startAscent(3));
    expect(chooseExit(ascent, 2)).toBe(ascent);
    const inBattle = startAscent(3);
    expect(chooseExit(inBattle, 0)).toBe(inBattle);
  });
});

describe('End of the ascent (P8, P33)', () => {
  it('ends in victory when the boss is beaten, with its 40 Gold', () => {
    const boss = climbTo(3, TOP_FLOOR);
    const before = boss.gold;

    const ended = won(boss);

    expect(ended.outcome).toBe('victory');
    expect(ended.gold).toBe(before + 40);
    expect(ended.exits).toEqual([]);
  });

  it('ends in a fall when the hero falls to 0 HP', () => {
    const ascent = won(startAscent(4));
    const entered = chooseExit(ascent, 0);
    const next = entered.encounter === null ? chooseExit(entered, 0) : entered;

    const fallen = endFloorBattle(next, { outcome: 'defeat', heroHp: 0 });

    expect(fallen).toMatchObject({ outcome: 'fall', hero: { hp: 0 }, gold: ascent.gold });
  });

  it('ends an abandon as a fall', () => {
    expect(abandonAscent(startAscent(4)).outcome).toBe('fall');
  });

  it('ignores a battle end once the ascent is over, or between battles', () => {
    const between = won(startAscent(4));
    expect(won(between)).toBe(between);
    const over = abandonAscent(startAscent(4));
    expect(won(over)).toBe(over);
  });
});
