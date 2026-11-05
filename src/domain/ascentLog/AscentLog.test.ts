import {
  abandonAscent,
  acknowledgeBossVictory,
  chooseBlessing,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  equipItem,
  leaveItem,
  startAscent,
  type Ascent,
} from '../ascent/Ascent';
import { blessingRarities } from '../ascent/blessings';
import { BASE_BOON_KINDS } from '../ascent/boons';
import type { FateGauge } from '../ascent/fateGauge';
import { Day } from '../day/Day';
import {
  ASCENT_LOG_FORMAT_VERSION,
  beginAscentLog,
  recordAscentStep,
  recordBattlePlace,
  resumeAscentLog,
  type AscentLog,
  type AscentLogV1,
  type AscentStep,
  type HeroVitals,
} from './AscentLog';

const DAY = Day.of(2026, 11, 3);
const vitals = (ascent: Ascent, momentum: number | null = 2): HeroVitals => ({
  hp: ascent.hero.hp,
  maxHp: ascent.hero.maxHp,
  momentum,
});

/** Un journal qui suit l'ascension : chaque transition est enregistrée avec son état avant et après. */
class Walk {
  log: AscentLog;
  constructor(public ascent: Ascent) {
    this.log = beginAscentLog(ascent, DAY);
  }
  private apply(kind: AscentStep['kind'], after: Ascent, hero?: HeroVitals): this {
    const step = (
      hero === undefined
        ? { kind, before: this.ascent, after }
        : { kind, hero, before: this.ascent, after }
    ) as AscentStep;
    this.log = recordAscentStep(this.log, step);
    this.ascent = after;
    return this;
  }
  blessing(index = 0) {
    return this.apply('blessingChosen', chooseBlessing(this.ascent, index));
  }
  battle(outcome: 'victory' | 'defeat' = 'victory', heroHp = this.ascent.hero.hp - 5) {
    this.apply('battleStarted', this.ascent, vitals(this.ascent, 2));
    const after = endFloorBattle(this.ascent, { outcome, heroHp });
    return this.apply('battleEnded', after, {
      hp: heroHp,
      maxHp: this.ascent.hero.maxHp,
      momentum: 4,
    });
  }
  boon(index = 0) {
    return this.apply('boonChosen', chooseBoon(this.ascent, index));
  }
  equip() {
    return this.apply('itemEquipped', equipItem(this.ascent));
  }
  leave() {
    return this.apply('itemLeft', leaveItem(this.ascent));
  }
  exit(index: number) {
    return this.apply('exitChosen', chooseExit(this.ascent, index));
  }
  exitTo(kind: 'combat' | 'elite' | 'campfire' | 'boss') {
    const index = this.ascent.exits.findIndex((exit) => exit.kind === kind);
    if (index < 0) throw new Error(`no ${kind} exit`);
    return this.exit(index);
  }
  abandon() {
    return this.apply('abandoned', abandonAscent(this.ascent));
  }
  acknowledge() {
    return this.apply('bossAcknowledged', acknowledgeBossVictory(this.ascent));
  }
  enterTier() {
    return this.apply('tierEntered', enterNextTier(this.ascent));
  }
  /** Gagne le combat, prend le bienfait s'il y en a, laisse l'objet. */
  clear() {
    this.battle();
    if (this.ascent.boonOffer !== null) this.boon();
    return this;
  }
}

/** Une ascension posée devant `floor` du palier `tier`, avec une graine fixe. */
function seeded(seed = 7, gauge: FateGauge = 1): Ascent {
  return startAscent(seed, { hero: 'sentinel', gauge, blessings: ['rare', 'common'] });
}

/** Une graine dont les sorties de l'étage 1 proposent `kind`. */
function seedWithExit(kind: 'combat' | 'elite' | 'campfire'): number {
  for (let seed = 1; seed < 500; seed += 1) {
    const ascent = endFloorBattle(startAscent(seed), { outcome: 'victory', heroHp: 60 });
    if (ascent.exits.some((exit) => exit.kind === kind)) return seed;
  }
  throw new Error(`no seed with a ${kind} exit`);
}

describe('beginAscentLog', () => {
  it('records the date, the ascent seed, the hero, the gauge state and the starting equipment', () => {
    const ascent = seeded(11, 1);
    const log = beginAscentLog(ascent, DAY);
    expect(log).toMatchObject({
      formatVersion: ASCENT_LOG_FORMAT_VERSION,
      id: null,
      ascentSeed: 11,
      startedOn: '2026-11-03',
      hero: 'sentinel',
      gauge: 'favor',
      startingEquipment: { weapon: null, armor: null, accessory: null },
      blessings: [],
      tierPassages: [],
      status: 'inProgress',
      end: null,
    });
    expect(log.floors).toEqual([
      {
        tier: 1,
        floor: 1,
        exitsOffered: [],
        exitTaken: null,
        encounter: { kind: 'combat', enemies: ascent.encounter!.enemies },
        entry: { hp: ascent.hero.hp, maxHp: ascent.hero.maxHp, momentum: null },
        exit: null,
        gold: 0,
        boonsOffered: [],
        boonChosen: null,
        itemFound: null,
        itemOutcome: null,
        shards: 0,
      },
    ]);
  });

  it.each([
    [2, 'fullFavor'],
    [1, 'favor'],
    [0, 'neutral'],
    [-1, 'curse'],
    [-2, 'strongCurse'],
  ] as const)('translates the gauge %d into %s', (gauge, state) => {
    expect(beginAscentLog(startAscent(1, { gauge }), DAY).gauge).toBe(state);
  });
});

describe('recordAscentStep', () => {
  it('records each starting blessing by its offered families, its family and its rarity', () => {
    const walk = new Walk(seeded());
    const offered = walk.ascent.blessingOffer!;
    walk.blessing(1);
    const second = walk.ascent.blessingOffer!;
    walk.blessing(0);
    expect(walk.log.blessings).toEqual([
      { offered, chosen: { family: offered[1], rarity: 'rare' } },
      { offered: second, chosen: { family: second[0], rarity: 'common' } },
    ]);
  });

  it('records the HP and Momentum at the start and at the end of the floor battle', () => {
    const walk = new Walk(startAscent(3));
    const start = walk.ascent;
    walk.battle('victory', 50);
    expect(walk.log.floors[0]).toMatchObject({
      entry: { hp: start.hero.hp, maxHp: start.hero.maxHp, momentum: 2 },
      exit: { hp: 50, maxHp: start.hero.maxHp, momentum: 4 },
      gold: walk.ascent.lastGold,
    });
  });

  it('records the boons offered and the boon chosen', () => {
    const walk = new Walk(startAscent(3));
    walk.battle();
    const offer = walk.ascent.boonOffer ?? [];
    expect(walk.log.floors[0]!.boonsOffered).toEqual(offer);
    if (offer.length > 0) {
      walk.boon(0);
      expect(walk.log.floors[0]!.boonChosen).toBe(offer[0]);
    }
  });

  it('records Second souffle chosen beside a boon, not the boon owned before (#212)', () => {
    const ascent = startAscent(3);
    const owned = BASE_BOON_KINDS.slice(0, 6);
    const walk = new Walk({ ...ascent, hero: { ...ascent.hero, boons: owned } });
    walk.battle();
    expect(walk.log.floors[0]!.boonsOffered).toEqual(['winterVigil', 'secondBreath']);

    walk.boon(1);

    expect(walk.ascent.hero.boons).toEqual(owned);
    expect(walk.log.floors[0]!.boonChosen).toBe('secondBreath');
  });

  it('records Second souffle chosen at full HP, alone in the offer (#212)', () => {
    const ascent = startAscent(3);
    const walk = new Walk({ ...ascent, hero: { ...ascent.hero, boons: BASE_BOON_KINDS } });
    walk.battle('victory', ascent.hero.maxHp);
    expect(walk.ascent.hero.hp).toBe(walk.ascent.hero.maxHp);

    walk.boon(0);

    expect(walk.ascent.boonOffer).toBeNull();
    expect(walk.log.floors[0]).toMatchObject({
      boonsOffered: ['secondBreath'],
      boonChosen: 'secondBreath',
    });
  });

  it('records the exits offered, the exit taken with its group size, and the next floor entry', () => {
    const walk = new Walk(startAscent(seedWithExit('combat'))).clear();
    const offered = walk.ascent.exits;
    walk.exitTo('combat');
    const taken = offered.find((exit) => exit.kind === 'combat')!;
    expect(walk.log.floors[1]).toMatchObject({
      tier: 1,
      floor: 2,
      exitsOffered: offered,
      exitTaken: { kind: 'combat', groupSize: taken.groupSize },
      encounter: { kind: 'combat', enemies: walk.ascent.encounter!.enemies },
      entry: { hp: walk.ascent.hero.hp, momentum: null },
    });
  });

  it('records the Elite exit taken without group size', () => {
    const walk = new Walk(startAscent(seedWithExit('elite'))).clear().exitTo('elite');
    expect(walk.log.floors[1]).toMatchObject({
      exitTaken: { kind: 'elite', groupSize: null },
      encounter: { kind: 'elite' },
    });
  });

  it('records a campfire floor without battle nor Momentum, healed between entry and exit', () => {
    const walk = new Walk(startAscent(seedWithExit('campfire')));
    walk.battle('victory', 30);
    if (walk.ascent.boonOffer !== null) walk.boon();
    const before = walk.ascent;
    walk.exitTo('campfire');
    expect(walk.log.floors[1]).toMatchObject({
      floor: 2,
      exitTaken: { kind: 'campfire', groupSize: null },
      encounter: null,
      entry: { hp: before.hero.hp, maxHp: before.hero.maxHp, momentum: null },
      exit: { hp: walk.ascent.hero.hp, maxHp: walk.ascent.hero.maxHp, momentum: null },
      gold: 0,
    });
    expect(walk.ascent.hero.hp).toBeGreaterThan(before.hero.hp);
  });

  it('records an item found and equipped, or left', () => {
    const found = (ascent: Ascent) => ({ ...ascent, foundItem: 'axe' as const });
    const equipped = new Walk(startAscent(3)).clear();
    equipped.ascent = found(equipped.ascent);
    equipped.log = recordAscentStep(equipped.log, {
      kind: 'battleEnded',
      hero: vitals(equipped.ascent),
      before: { ...equipped.ascent, foundItem: null },
      after: equipped.ascent,
    });
    expect(equipped.log.floors[0]!.itemFound).toBe('axe');
    equipped.equip();
    expect(equipped.log.floors[0]!.itemOutcome).toBe('equipped');

    const left = new Walk(found(startAscent(3)));
    left.log = { ...left.log, floors: [{ ...left.log.floors[0]!, itemFound: 'axe' }] };
    left.leave();
    expect(left.log.floors[0]!.itemOutcome).toBe('left');
  });

  it('counts an item still pending when a door is taken as left', () => {
    const walk = new Walk(startAscent(seedWithExit('combat'))).clear();
    walk.ascent = { ...walk.ascent, foundItem: 'axe' };
    walk.log = { ...walk.log, floors: [{ ...walk.log.floors[0]!, itemFound: 'axe' }] };
    walk.exitTo('combat');
    expect(walk.log.floors[0]!.itemOutcome).toBe('left');
  });

  it('records the Shards won on the floor', () => {
    const ascent: Ascent = {
      ...startAscent(3),
      floor: 3,
      encounter: { kind: 'elite', enemies: ['fallenKnight'], battleSeed: 3 },
    };
    const walk = new Walk(ascent).battle();
    expect(walk.log.floors[0]!.shards).toBe(2);
  });

  it('records a tier passage and the first floor of the next tier', () => {
    const boss: Ascent = {
      ...startAscent(3),
      floor: 6,
      encounter: { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 3 },
    };
    const walk = new Walk(boss).battle('victory', 40).acknowledge().enterTier();
    expect(walk.log.tierPassages).toEqual([{ from: 1, to: 2, heroHp: walk.ascent.hero.hp }]);
    expect(walk.log.floors.at(-1)).toMatchObject({
      tier: 2,
      floor: 1,
      exitTaken: null,
      encounter: { kind: walk.ascent.encounter!.kind },
    });
    expect(walk.log.status).toBe('inProgress');
  });

  it('ends on the Summit after the boss of tier 3', () => {
    const boss: Ascent = {
      ...startAscent(3),
      tier: 3,
      floor: 6,
      encounter: { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 3 },
    };
    const walk = new Walk(boss).battle();
    expect(walk.log).toMatchObject({
      status: 'ended',
      end: { kind: 'summit', tier: 3, floor: 6 },
    });
  });

  it('ends on a fall with the tier, the floor and the floor battle of the fall', () => {
    const ascent: Ascent = { ...startAscent(3), tier: 2, floor: 4 };
    const walk = new Walk(ascent).battle('defeat', 0);
    expect(walk.log).toMatchObject({
      status: 'ended',
      end: {
        kind: 'fall',
        tier: 2,
        floor: 4,
        encounter: { kind: 'combat', enemies: ascent.encounter!.enemies },
      },
    });
  });

  it('ends on an abandon, distinct from a fall', () => {
    const walk = new Walk({ ...startAscent(3), floor: 2 }).abandon();
    expect(walk.log).toMatchObject({
      status: 'ended',
      end: { kind: 'abandon', tier: 1, floor: 2 },
    });
  });

  it('keeps the log unchanged when the step changes nothing, or once the log has ended', () => {
    const walk = new Walk(startAscent(3));
    const log = walk.log;
    walk.equip();
    walk.acknowledge();
    walk.enterTier();
    expect(walk.log).toBe(log);
    walk.abandon();
    const ended = walk.log;
    walk.abandon();
    expect(walk.log).toBe(ended);
  });

  it('leaves the log unchanged when the floor of the step is missing from it', () => {
    const ascent = startAscent(3);
    const log = { ...beginAscentLog(ascent, DAY), floors: [] };
    const started = recordAscentStep(log, {
      kind: 'battleStarted',
      hero: vitals(ascent),
      before: ascent,
      after: ascent,
    });
    expect(started).toBe(log);
  });

  it('contains no habit data: no habit name, no check-in, no experience', () => {
    const rarities = blessingRarities([
      { name: 'Me faire à manger', difficulty: 'medium', createdOn: Day.of(2026, 1, 1) },
    ]);
    const walk = new Walk(startAscent(5, { gauge: 2, blessings: rarities })).blessing().clear();
    const json = JSON.stringify(walk.log);
    expect(json).not.toMatch(/manger|habit|checkIn|experience|xp/iu);
    expect(walk.log.blessings[0]!.chosen.rarity).toBe('rare');
    expect(Object.keys(walk.log.blessings[0]!.chosen).sort()).toEqual(['family', 'rarity']);
  });
});

describe('resumeAscentLog', () => {
  it('keeps the log when the current floor is already there: never a duplicate floor', () => {
    const walk = new Walk(startAscent(seedWithExit('combat'))).clear().exitTo('combat');
    const resumed = resumeAscentLog(walk.log, walk.ascent);
    expect(resumed).toBe(walk.log);
    expect(resumed.floors.map((floor) => `${floor.tier}-${floor.floor}`)).toEqual(['1-1', '1-2']);
  });

  it('adds the current floor when the last choice was not written', () => {
    const walk = new Walk(startAscent(seedWithExit('combat'))).clear();
    const log = walk.log;
    walk.exitTo('combat');
    const resumed = resumeAscentLog(log, walk.ascent);
    expect(resumed.floors.map((floor) => `${floor.tier}-${floor.floor}`)).toEqual(['1-1', '1-2']);
    expect(resumed.floors[1]).toMatchObject({
      exitTaken: null,
      encounter: { kind: 'combat' },
      entry: { hp: walk.ascent.hero.hp, momentum: null },
    });
  });
});

describe('the format version 2', () => {
  it('begins a log in version 2, without battles', () => {
    const log = beginAscentLog(startAscent(3), DAY);
    expect(ASCENT_LOG_FORMAT_VERSION).toBe(2);
    expect(log).toMatchObject({ formatVersion: 2, battles: [] });
  });

  it('lists each battle written apart, by its tier and floor, at its start and never twice', () => {
    const log = beginAscentLog(startAscent(3), DAY);
    const first = recordBattlePlace(log, { tier: 1, floor: 1 });
    const again = recordBattlePlace(first, { tier: 1, floor: 1 });
    const next = recordBattlePlace(again, { tier: 2, floor: 1 });

    expect(again).toBe(first);
    expect(next.battles).toEqual([
      { tier: 1, floor: 1 },
      { tier: 2, floor: 1 },
    ]);
  });

  it('goes on with a log of version 1 in progress, still in version 1, without battles', () => {
    const ascent = startAscent(3);
    const { battles: _, ...body } = beginAscentLog(ascent, DAY);
    const old: AscentLogV1 = { ...body, formatVersion: 1 };
    const ended = recordAscentStep(old, {
      kind: 'abandoned',
      before: ascent,
      after: abandonAscent(ascent),
    });

    expect(ended).toMatchObject({ formatVersion: 1, status: 'ended' });
    expect(ended).not.toHaveProperty('battles');
    expect(resumeAscentLog(old, ascent)).toBe(old);
  });
});
