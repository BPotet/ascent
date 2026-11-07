// L'ascension sur trois paliers (#38) : le Passage de palier après le boss du palier 1 ou 2, les
// Éclats gagnés, le Sommet après le boss du palier 3, l'Or et les tirages de chaque palier, et
// les bienfaits épuisés.
import {
  TOP_FLOOR,
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from './Ascent';
import { BASE_BOON_KINDS, type BoonKind } from './boons';
import { drawElite } from './elites';
import { TIERS, type Tier } from './tiers';

const SEEDS = Array.from({ length: 120 }, (_, index) => index * 2_654_435_761 + 11);

/** Le combat gagné à `heroHp` PV, puis le 1er bienfait de l'offre pris. */
const won = (ascent: Ascent, heroHp = ascent.hero.hp) => {
  const ended = endFloorBattle(ascent, { outcome: 'victory', heroHp });
  return ended.boonOffer === null ? ended : chooseBoon(ended, 0);
};

/** L'ascension menée, par la 1re porte (ou celle que `pick` choisit), jusqu'au boss de son palier. */
function toBoss(ascent: Ascent, pick: (current: Ascent) => number = () => 0): Ascent {
  let current = ascent;
  while (current.encounter?.kind !== 'boss') {
    current = current.encounter === null ? chooseExit(current, pick(current)) : won(current);
  }
  return current;
}

/** Le boss battu, l'écran de transition, puis le combat imposé de l'étage 1 du palier suivant. */
function nextTier(ascent: Ascent): Ascent {
  return enterNextTier(acknowledgeBossVictory(won(toBoss(ascent))));
}

/** L'ascension au combat imposé de l'étage 1 du palier `tier`. */
function atTier(tier: Tier, seed = 3, launch: AscentLaunch = {}): Ascent {
  let ascent = startAscent(seed, launch);
  while (ascent.tier < tier) ascent = nextTier(ascent);
  return ascent;
}

/** Le palier en cours, avec un combat ordinaire de `enemies` à l'étage 2. */
function withCombat(ascent: Ascent, enemies: number): Ascent {
  return {
    ...ascent,
    floor: 2,
    encounter: { kind: 'combat', enemies: Array(enemies).fill('skeleton'), battleSeed: 1 },
  };
}

describe('beating the boss of tier 1 no longer ends the ascent (#38)', () => {
  it('gives 8 Shards, its 40 Gold, then the Tier transition to tier 2, without exits nor boon', () => {
    const boss = toBoss(startAscent(3));

    const beaten = won(boss);

    expect(beaten.outcome).toBeNull();
    expect(beaten.shardAwards).toEqual([{ id: '3:1:6:boss', amount: 8 }]);
    expect(beaten.gold).toBe(boss.gold + 40);
    expect(beaten.passage).toEqual({ to: 2, step: 'bossDefeated' });
    expect(beaten).toMatchObject({ encounter: null, exits: [], boonOffer: null, tier: 1 });
  });

  it('heals 30 % of the max HP in the Tier transition: 40 + 24 = 64 of 80', () => {
    expect(won(toBoss(startAscent(3)), 40).hero).toMatchObject({ hp: 64, maxHp: 80 });
  });

  it('never heals above the max HP: 75 of 80 gives 80', () => {
    expect(won(toBoss(startAscent(3)), 75).hero.hp).toBe(80);
  });

  it('goes from the defeated boss screen to the transition screen, then to tier 2', () => {
    const beaten = won(toBoss(startAscent(3)));
    const announced = acknowledgeBossVictory(beaten);

    expect(announced.passage).toEqual({ to: 2, step: 'announce' });
    expect(acknowledgeBossVictory(announced)).toBe(announced);
    expect(enterNextTier(beaten)).toBe(beaten);
  });

  it('goes on at floor 1 of tier 2, on a forced battle of 2 to 4 enemies of tier 2', () => {
    const tierTwo = enterNextTier(acknowledgeBossVictory(won(toBoss(startAscent(3)))));

    expect(tierTwo).toMatchObject({ tier: 2, floor: 1, passage: null, exits: [] });
    expect(tierTwo.encounter?.kind).toBe('combat');
    expect([2, 3, 4]).toContain(tierTwo.encounter!.enemies.length);
    const kinds = TIERS[2].enemies.map((draw) => draw.kind);
    for (const kind of tierTwo.encounter!.enemies) expect(kinds).toContain(kind);
  });

  it('keeps the HP, the items, the boons, the blessings, the fatigue, the Gold and the Shards', () => {
    const launch: AscentLaunch = { hero: 'wanderer', gauge: -2, blessings: ['common'] };
    const start = startAscent(5, launch);
    const blessed = {
      ...start,
      blessingOffer: null,
      blessings: [{ family: 'vigor' as const, rarity: 'common' as const }],
    };
    const beaten = acknowledgeBossVictory(won(toBoss(blessed), 30));

    const tierTwo = enterNextTier(beaten);

    expect(tierTwo.hero).toEqual(beaten.hero);
    expect(tierTwo).toMatchObject({
      equipment: beaten.equipment,
      blessings: beaten.blessings,
      gauge: beaten.gauge,
      gold: beaten.gold,
      shardAwards: beaten.shardAwards,
    });
  });

  it('ignores the transition screens without a Tier transition in progress', () => {
    const climbing = startAscent(3);

    expect(acknowledgeBossVictory(climbing)).toBe(climbing);
    expect(enterNextTier(climbing)).toBe(climbing);
  });

  it('ignores the choice of a door or a battle end during the Tier transition', () => {
    const beaten = won(toBoss(startAscent(3)));

    expect(chooseExit(beaten, 0)).toBe(beaten);
    expect(endFloorBattle(beaten, { outcome: 'victory', heroHp: 1 })).toBe(beaten);
  });

  it('offers the Campfire again by floor 3 of each tier', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const atTwo = won(atTier(2, seed));
      expect(atTwo.campfireOffered).toBe(atTwo.exits.some((exit) => exit.kind === 'campfire'));
      if (atTwo.exits.some((exit) => exit.kind === 'campfire')) continue;
      const atThree = won(chooseExit(atTwo, 0));
      expect(atThree.exits.map((exit) => exit.kind)).toContain('campfire');
    }
  });
});

describe('the battles of tiers 2 and 3 (#38)', () => {
  it('draws 3 or 4 enemies of tier 3 for the forced battle of tier 3', () => {
    const kinds = TIERS[3].enemies.map((draw) => draw.kind);
    for (const seed of SEEDS.slice(0, 30)) {
      const { encounter } = atTier(3, seed);
      expect([3, 4]).toContain(encounter!.enemies.length);
      for (const kind of encounter!.enemies) expect(kinds).toContain(kind);
    }
  });

  it('draws the group size of a Combat door with the weights of the tier', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const doors = won(atTier(3, seed)).exits.filter((exit) => exit.kind === 'combat');
      for (const door of doors) expect([3, 4]).toContain(door.groupSize);
    }
  });

  it('meets the Elite and the bosses of the tier', () => {
    const elites = new Set<string>();
    const bosses = new Set<string>();
    for (const seed of SEEDS.slice(0, 40)) {
      const tierThree = atTier(3, seed);
      const elite = (current: Ascent) =>
        Math.max(
          0,
          current.exits.findIndex((exit) => exit.kind === 'elite'),
        );
      const boss = toBoss(tierThree, elite);
      bosses.add(boss.encounter!.enemies[0]!);
      let current = won(tierThree);
      while (current.encounter?.kind !== 'boss') {
        if (current.encounter?.kind === 'elite') elites.add(current.encounter.enemies[0]!);
        current = current.encounter === null ? chooseExit(current, elite(current)) : won(current);
      }
    }

    expect(elites).toEqual(new Set(['firstPilgrim', 'stoneSaint']));
    expect(bosses).toEqual(new Set(['hourRinger', 'wishGranter']));
    expect(['ashGardener', 'mothQueen']).toContain(toBoss(atTier(2)).encounter!.enemies[0]);
    expect(toBoss(atTier(2)).encounter!.enemies).toHaveLength(1);
  });

  it('gives 2 Shards and 31 Gold for an Elite of tier 2, 37 Gold at tier 3', () => {
    for (const [tier, gold] of [
      [2, 31],
      [3, 37],
    ] as const) {
      const ascent = {
        ...atTier(tier),
        floor: 3,
        encounter: {
          kind: 'elite' as const,
          enemies: TIERS[tier].elites.slice(0, 1),
          battleSeed: 1,
        },
      };

      const beaten = endFloorBattle(ascent, { outcome: 'victory', heroHp: 40 });

      expect(beaten.lastGold).toBe(gold);
      expect(beaten.shardAwards.slice(-1)).toEqual([{ id: `3:${tier}:3:elite`, amount: 2 }]);
    }
  });

  it('gives 16 to 22 Gold for an ordinary battle of 3 enemies at tier 3', () => {
    const golds = new Set(
      SEEDS.map((seed) => {
        const ascent = withCombat({ ...atTier(3, 3), random: atTier(1, seed).random }, 3);
        return endFloorBattle(ascent, { outcome: 'victory', heroHp: 40 }).lastGold;
      }),
    );

    expect(golds).toEqual(new Set([16, 18, 19, 21, 22]));
  });
});

describe('the boss of tier 2 and the Summit (#38)', () => {
  it('gives 12 Shards and 50 Gold for the boss of tier 2, then the transition to tier 3', () => {
    const boss = toBoss(atTier(2));

    const beaten = won(boss);

    expect(beaten.shardAwards.slice(-1)).toEqual([{ id: '3:2:6:boss', amount: 12 }]);
    expect(beaten.lastGold).toBe(50);
    expect(beaten.passage).toEqual({ to: 3, step: 'bossDefeated' });
  });

  it('reaches the Summit when the boss of tier 3 is beaten: 18 + 10 Shards, a victory', () => {
    const boss = toBoss(atTier(3));
    expect(boss.floor).toBe(TOP_FLOOR);

    const summit = won(boss);

    expect(summit.outcome).toBe('victory');
    expect(summit.passage).toBeNull();
    expect(summit.lastGold).toBe(60);
    expect(summit.shardAwards.slice(-2)).toEqual([
      { id: '3:3:6:boss', amount: 18 },
      { id: '3:summit', amount: 10 },
    ]);
  });

  it('gives Shards that depend on the victories only, never on the gauge, the hero or the blessings', () => {
    const plain = won(toBoss(atTier(2, 3)));
    const other = won(toBoss(atTier(2, 3, { hero: 'wanderer', gauge: 2, blessings: ['rare'] })));

    expect(plain.shardAwards.at(-1)).toEqual({ id: '3:2:6:boss', amount: 12 });
    expect(other.shardAwards.at(-1)).toEqual({ id: '3:2:6:boss', amount: 12 });
  });

  it('keeps the Shards of the ascent after a fall', () => {
    const beaten = atTier(2);
    const fallen = endFloorBattle(beaten, { outcome: 'defeat', heroHp: 0 });

    expect(fallen.outcome).toBe('fall');
    expect(fallen.shardAwards).toEqual(beaten.shardAwards);
    expect(fallen.shardAwards).toContainEqual({ id: '3:1:6:boss', amount: 8 });
  });
});

describe('exhausted boons (#38)', () => {
  const owning = (boons: readonly BoonKind[]) => {
    const ascent = startAscent(3);
    return { ...ascent, hero: { ...ascent.hero, boons } };
  };

  it('offers the 2 boons left to a hero who owns 5 of the 7, then Second souffle (#212)', () => {
    const owned = BASE_BOON_KINDS.slice(0, 5);

    const offered = endFloorBattle(owning(owned), { outcome: 'victory', heroHp: 40 });

    expect([...offered.boonOffer!.slice(0, 2)].sort()).toEqual(
      [...BASE_BOON_KINDS.slice(5)].sort(),
    );
    expect(offered.boonOffer![2]).toBe('secondBreath');
  });

  it('offers Second souffle alone to a hero who owns the 7, and the ascent goes on (#212)', () => {
    const offered = endFloorBattle(owning(BASE_BOON_KINDS), { outcome: 'victory', heroHp: 40 });

    expect(offered.boonOffer).toEqual(['secondBreath']);
    expect(offered.exits.length).toBeGreaterThan(0);
  });
});

describe('the non-repeated Elite (#244, R5)', () => {
  /** L'ascension entre deux étages, la seule porte Élite proposée. */
  const atEliteDoor = (ascent: Ascent): Ascent => ({
    ...ascent,
    encounter: null,
    boonOffer: null,
    exits: [{ kind: 'elite', groupSize: null }],
  });

  it('draws the first Elite of a tier as before, and remembers it', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const tierThree = atEliteDoor(atTier(3, seed));
      const entered = chooseExit(tierThree, 0);
      const elite = entered.encounter!.enemies[0]!;

      expect(drawElite(TIERS[3].elites, tierThree.random).value).toBe(elite);
      expect(entered.lastElite).toBe(elite);
    }
  });

  it('meets the other Elite at the next Elite door of the tier, without a draw', () => {
    const tierThree = { ...atEliteDoor(atTier(3)), lastElite: 'stoneSaint' as const };
    const entered = chooseExit(tierThree, 0);
    const plain = chooseExit({ ...tierThree, lastElite: 'firstPilgrim' as const }, 0);

    expect(entered.encounter!.enemies).toEqual(['firstPilgrim']);
    expect(entered.lastElite).toBe('firstPilgrim');
    expect(plain.encounter!.enemies).toEqual(['stoneSaint']);
    // Un seul candidat : aucun tirage, le générateur part du même état pour la graine du combat.
    expect(entered.encounter!.battleSeed).toBe(plain.encounter!.battleSeed);
  });

  it('alternates the two Elites of a tier, door after door', () => {
    let current = atEliteDoor(atTier(2, 7));
    const met: string[] = [];
    for (let door = 0; door < 4; door += 1) {
      current = chooseExit(current, 0);
      met.push(current.encounter!.enemies[0]!);
      current = atEliteDoor({ ...won(current), floor: 1 });
    }

    expect(new Set(met).size).toBe(2);
    met.slice(1).forEach((elite, index) => expect(elite).not.toBe(met[index]));
  });

  it('forgets the last Elite at the Tier transition', () => {
    const boss = { ...toBoss(atTier(1)), lastElite: 'twins' as const };
    const next = enterNextTier(acknowledgeBossVictory(won(boss)));

    expect(next.tier).toBe(2);
    expect(next).not.toHaveProperty('lastElite');
  });

  it('draws the next Elite door as before for an ascent saved before #244, without lastElite', () => {
    const saved = atEliteDoor(atTier(1));

    expect(saved).not.toHaveProperty('lastElite');
    expect(chooseExit(saved, 0).encounter!.enemies[0]).toBe(
      drawElite(TIERS[1].elites, saved.random).value,
    );
  });
});
