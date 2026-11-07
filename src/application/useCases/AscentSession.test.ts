import {
  endFloorBattle,
  leaveItem,
  rerollStream,
  sealedChestStream,
  startAscent,
  type Ascent,
} from '../../domain/ascent/Ascent';
import { TIERS } from '../../domain/ascent/tiers';
import { ATTACKS } from '../../domain/battle/attacks';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import {
  ASCENT_KEY,
  AscentSession,
  BURN_SMOKE_HOLD_MS,
  SUMMON_FALL_HOLD_MS,
} from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import type { BattleSession } from './BattleSession';
import { UNREADABLE_GAUGE } from './fateGauge';

function mapStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

function setUp(seed = 42) {
  const store = mapStore();
  const clock = new ManualBattleClock(1_000);
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(seed),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: store,
  });
  return { store, clock, session };
}

/** Laisse passer les écritures en attente. */
async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

function saved(store: ReturnType<typeof mapStore>) {
  const raw = store.values.get(ASCENT_KEY);
  return raw === undefined
    ? null
    : (JSON.parse(raw) as { version: number; ascent: Ascent; battle: Battle | null });
}

/** Le combat de la 1re ascension, contre une Goule seule, avec des PV changés. */
function savedBattle(
  ascent: Ascent,
  { heroHp, enemyHp }: { readonly heroHp: number; readonly enemyHp: number },
): Battle {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp,
    enemies: ['ghoul'],
  });
  return { ...battle, enemies: [{ ...battle.enemies[0]!, hp: enemyHp }] };
}

/** Le héros attaque à chaque phase du héros ; l'horloge avance jusqu'à la fin du combat. */
async function playToTheEnd(battleSession: BattleSession, clock: ManualBattleClock) {
  for (let guard = 0; guard < 200; guard += 1) {
    const battle = battleSession.current()!.battle;
    if (battle.phase.kind === 'over') return battle;
    if (battle.phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await flush();
  }
  throw new Error('The battle never ended');
}

/** Le combat joué jusqu'à sa fin, sans rendre la main : rien d'asynchrone ne passe entre-temps. */
function playUntilOver(battleSession: BattleSession, clock: ManualBattleClock): Battle {
  for (let guard = 0; guard < 200; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'over') return battle;
    if (battle.phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
  }
  throw new Error('The battle never ended');
}

describe('AscentSession', () => {
  it('has no ascent before one is begun or loaded', async () => {
    const { session } = setUp();

    expect(session.current()).toBeNull();
    expect(await session.load()).toBeNull();
    expect(session.resuming()).toBe(false);
  });

  it('begins an ascent from the seed source, publishes and saves it', async () => {
    const { session, store } = setUp(42);
    const published: (Ascent | null)[] = [];
    session.subscribe((ascent) => published.push(ascent));

    const ascent = session.begin();
    await flush();

    expect(ascent).toEqual(startAscent(42));
    expect(published).toEqual([ascent]);
    expect(saved(store)).toEqual({ version: 1, ascent, battle: null });
  });

  it('loads the saved ascent, and erases an unreadable or outdated save', async () => {
    const first = setUp(7);
    first.session.begin();
    await flush();
    const second = setUp();
    second.store.values.set(ASCENT_KEY, first.store.values.get(ASCENT_KEY)!);

    expect(await second.session.load()).toEqual(startAscent(7));

    for (const raw of ['{oops', '{"version":2,"ascent":{"floor":1}}', 'null']) {
      const broken = setUp();
      broken.store.values.set(ASCENT_KEY, raw);
      expect(await broken.session.load()).toBeNull();
      expect(broken.store.values.has(ASCENT_KEY)).toBe(false);
    }
  });

  it('starts the floor battle with the hero and the enemies of the ascent, and saves it as it goes', async () => {
    // Une graine où le héros ouvre le combat : la sauvegarde part avec la phase du héros.
    const { session, store } = setUp(1);
    const ascent = session.begin();
    const battleSession = session.battleSession();

    await battleSession.start();
    await flush();

    const { battle } = battleSession.current()!;
    expect(battle.hero).toMatchObject({ hp: 80, maxHp: 80, momentum: 1 });
    expect([...battle.enemies.map((enemy) => enemy.kind), ...battle.reserve]).toEqual(
      ascent.encounter!.enemies,
    );
    expect(saved(store)?.battle).toEqual(battle);
    expect(session.resuming()).toBe(true);
  });

  it('resumes the saved battle at its current action, with the same HP', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    const battle = savedBattle(ascent, { heroHp: 33, enemyHp: 20 });
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    expect(session.resuming()).toBe(true);
    expect(battleSession.current()!.battle).toMatchObject({
      now: clock.now(),
      hero: { hp: 33 },
      phase: { kind: 'hero', since: clock.now() },
    });
    expect(battleSession.current()!.battle.enemies[0]!.hp).toBe(20);
  });

  it('resumes a battle saved with 3 stacks of Burn with its 3 stacks, and saves them again (#171)', async () => {
    const { session, store } = setUp();
    const battle = savedBattle(startAscent(5), { heroHp: 33, enemyHp: 20 });
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: startAscent(5),
        battle: { ...battle, hero: { ...battle.hero, burn: 3 } },
      }),
    );
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();
    await flush();

    expect(battleSession.current()!.battle.hero).toMatchObject({ hp: 33, burn: 3 });
    expect(saved(store)?.battle?.hero.burn).toBe(3);
  });

  it('leaves a battle won while burning once its flames have gone out, 360 ms later (#171)', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    const battle = savedBattle(ascent, { heroHp: 33, enemyHp: 1 });
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent,
        battle: { ...battle, hero: { ...battle.hero, burn: 2 } },
      }),
    );
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    const won = await playToTheEnd(battleSession, clock);
    const endedAt = clock.now();

    expect(won.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(session.current()!.encounter).not.toBeNull();
    clock.advanceTo(endedAt + 359);
    await flush();
    expect(session.current()!.encounter).not.toBeNull();
    clock.advanceTo(endedAt + BURN_SMOKE_HOLD_MS);
    await flush();
    expect(BURN_SMOKE_HOLD_MS).toBe(360);
    expect(session.current()!.encounter).toBeNull();
  });

  it('leaves a battle won without Burn at once (#171)', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    const battle = savedBattle(ascent, { heroHp: 33, enemyHp: 1 });
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    playUntilOver(battleSession, clock);

    // Aussitôt, sans attendre aucune écriture ni aucun minuteur.
    expect(session.current()!.encounter).toBeNull();
  });

  it('leaves an Elite won while burning once its Shards are written and its smoke gone (#171)', async () => {
    const { session, store, clock } = setUp();
    const ascent: Ascent = {
      ...startAscent(5),
      floor: 3,
      encounter: { kind: 'elite', enemies: ['fallenKnight'], battleSeed: 3 },
    };
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 50,
      enemies: ['fallenKnight'],
    });
    const burning: Battle = {
      ...battle,
      hero: { ...battle.hero, burn: 2 },
      enemies: [{ ...battle.enemies[0]!, hp: 1 }],
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: burning }));
    await session.load();
    const totals: number[] = [];
    session.subscribeShards((total) => totals.push(total));
    const battleSession = session.battleSession();
    await battleSession.start();

    playUntilOver(battleSession, clock);
    const endedAt = clock.now();
    await flush();

    expect(session.current()!.encounter).not.toBeNull();
    clock.advanceTo(endedAt + 359);
    await flush();
    expect(session.current()!.encounter).not.toBeNull();
    clock.advanceTo(endedAt + 360);
    await flush();
    expect(session.current()!.encounter).toBeNull();
    expect(session.shardTotal()).toBe(2);
    expect(totals.at(-1)).toBe(2);
  });

  it('shows the fall of a hero who burns once the smoke is gone too, 360 ms later (#171)', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    const battle = savedBattle(ascent, { heroHp: 1, enemyHp: 999 });
    const burning: Battle = {
      ...battle,
      hero: { ...battle.hero, burn: 2 },
      enemies: [{ ...battle.enemies[0]!, guard: 999 }],
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: burning }));
    await session.load();
    const published: (Ascent | null)[] = [];
    session.subscribe((current) => published.push(current));
    const battleSession = session.battleSession();
    await battleSession.start();

    const fallen = playUntilOver(battleSession, clock);
    const endedAt = clock.now();
    await flush();

    expect(fallen.phase).toMatchObject({ kind: 'over', outcome: 'defeat' });
    expect(published).toEqual([]);
    clock.advanceTo(endedAt + 359);
    await flush();
    expect(published).toEqual([]);
    clock.advanceTo(endedAt + 360);
    await flush();
    expect(published).toHaveLength(1);
  });

  it('resumes a battle saved before the Burn without Burn (#171)', async () => {
    const { session, store } = setUp();
    const battle = savedBattle(startAscent(5), { heroHp: 33, enemyHp: 20 });
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: startAscent(5), battle }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle.hero).not.toHaveProperty('burn');
  });

  it('saves when the Skeleton revives, and resumes it as revived (#106, S8)', async () => {
    const { session, store, clock } = setUp();
    const { battle: initial } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['skeleton', 'ghoul'],
    });
    const battle = {
      ...initial,
      enemies: [{ ...initial.enemies[0]!, hp: 1 }, initial.enemies[1]!],
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: startAscent(5), battle }));
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    const at = clock.now() + 50;
    clock.advanceTo(at);
    battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    clock.advanceTo(clock.pending()[0]!);
    await flush();

    expect(saved(store)?.battle?.enemies[0]).toMatchObject({
      hp: 17,
      raised: true,
      selfRevives: 1,
    });
    const resumed = setUp();
    resumed.store.values.set(ASCENT_KEY, store.values.get(ASCENT_KEY)!);
    await resumed.session.load();
    const resumedBattle = resumed.session.battleSession();
    await resumedBattle.start();
    expect(resumedBattle.current()!.battle.enemies[0]).toMatchObject({ selfRevives: 1 });
  });

  it('saves after the Bulwark riposte, with the HP it took (#128)', async () => {
    const { session, store, clock } = setUp();
    const { battle: initial } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 49,
      enemies: ['ghoul'],
    });
    // La Goule a frappé : l'impact a usé le Rempart, la riposte est programmée.
    const battle: Battle = {
      ...initial,
      lastPlayed: 'enemy',
      phase: {
        kind: 'enemy',
        step: {
          kind: 'attack',
          enemy: 0,
          attack: 'basic',
          damage: 5,
          startedAt: 0,
          feintAt: null,
          feintShown: false,
          impacts: [{ at: 1_100, landed: true, lost: false, outcome: 'suffered' }],
          resolvedAt: 1_260,
          counter: { at: 1_260, until: 1_660, done: false, by: 'bulwark' },
        },
      },
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: startAscent(5), battle }));
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();
    await flush();
    const startedAt = clock.now();

    // La reprise repart du début de la préparation : la riposte part 1 260 ms plus tard.
    clock.advanceTo(startedAt + 1_259);
    await flush();
    expect(saved(store)?.battle?.enemies[0]).toMatchObject({ hp: 50, guard: 30 });

    clock.advanceTo(startedAt + 1_260);
    await flush();
    expect(saved(store)?.battle?.enemies[0]).toMatchObject({ hp: 47, guard: 27 });
  });

  it('earns the Gold and offers the exits when the floor battle is won', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent,
        battle: savedBattle(ascent, { heroHp: 70, enemyHp: 1 }),
      }),
    );
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    const battle = await playToTheEnd(battleSession, clock);

    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    const after = session.current()!;
    expect(after).toMatchObject({ floor: 1, encounter: null, hero: { hp: battle.hero.hp } });
    expect(after.gold).toBeGreaterThan(0);
    expect(after.exits).toHaveLength(2);
    expect(session.resuming()).toBe(false);
    await flush();
    expect(saved(store)).toEqual({ version: 1, ascent: after, battle: null });
  });

  it('ends the ascent in a fall and erases the save when the hero falls', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent,
        battle: savedBattle(ascent, { heroHp: 1, enemyHp: 50 }),
      }),
    );
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    await playToTheEnd(battleSession, clock);
    await flush();

    expect(session.current()?.outcome).toBe('fall');
    expect(store.values.has(ASCENT_KEY)).toBe(false);
  });

  it('chooses an exit, saves on pause, abandons as a fall, and leaves to the tower foot', async () => {
    const { session, store } = setUp(9);
    const ascent = startAscent(9);
    const between = { ...ascent, encounter: null, exits: [{ kind: 'campfire', groupSize: null }] };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: between, battle: null }));
    await session.load();

    session.chooseExit(0);
    expect(session.current()).toMatchObject({ floor: 2, hero: { hp: 80 } });
    store.values.delete(ASCENT_KEY);
    session.pause();
    await flush();
    expect(saved(store)?.ascent.floor).toBe(2);

    session.abandon();
    await flush();
    expect(session.current()?.outcome).toBe('fall');
    expect(store.values.has(ASCENT_KEY)).toBe(false);

    const published: (Ascent | null)[] = [];
    session.subscribe((current) => published.push(current));
    session.leave();
    expect(session.current()).toBeNull();
    expect(published).toEqual([null]);
  });

  it('ignores a choice, an abandon or a pause without an ascent', async () => {
    const { session, store } = setUp();

    session.chooseExit(0);
    session.abandon();
    session.pause();
    await flush();

    expect(session.current()).toBeNull();
    expect(store.values.has(ASCENT_KEY)).toBe(false);
  });
});

/**
 * Les durées d'un combat d'étage : le héros attaque, puis l'horloge avance jusqu'à la 1re avancée
 * d'un ennemi. Renvoie la durée de la transition de phase et celle de l'avancée.
 */
async function phaseDurations(battleSession: BattleSession, clock: ManualBattleClock) {
  const events: BattleEvent[] = [];
  battleSession.subscribe((snapshot) => events.push(...snapshot.events));
  const at = clock.now() + 50;
  clock.advanceTo(at);
  battleSession.heroAction({ kind: 'attack' }, at - 20, at);
  for (let guard = 0; guard < 20; guard += 1) {
    const transition = events.find((event) => event.type === 'phaseTransitionStarted');
    const stepIn = events.find((event) => event.type === 'stepInStarted');
    if (transition !== undefined && stepIn !== undefined) {
      return { transition: transition.until - transition.at, stepIn: stepIn.until - stepIn.at };
    }
    clock.advanceTo(clock.pending()[0]!);
    await flush();
  }
  throw new Error('No enemy stepped in');
}

describe('AscentSession: the trial tuning is gone (#121)', () => {
  const TRIAL_TUNING = JSON.stringify({ phaseTransitionMs: 1_200, stepInMs: 100 });

  it('holds 800 ms of phase transition and 400 ms of step-in, whatever the saved trial tuning', async () => {
    const { session, store, clock } = setUp(1);
    store.values.set('battle.trialTuning', TRIAL_TUNING);
    session.begin();
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(await phaseDurations(battleSession, clock)).toEqual({ transition: 800, stepIn: 400 });
  });

  it('resumes a saved battle that still carries a trial tuning at 800 ms and 400 ms', async () => {
    const { session, store, clock } = setUp();
    const ascent = startAscent(5);
    const battle = {
      ...savedBattle(ascent, { heroHp: 70, enemyHp: 50 }),
      tuning: { phaseTransitionMs: 1_200, stepInMs: 100 },
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(await phaseDurations(battleSession, clock)).toEqual({ transition: 800, stepIn: 400 });
  });
});

describe('AscentSession with the gauge, the blessings and the items (#93)', () => {
  it('begins with the sealed gauge and the blessings, and saves each choice', async () => {
    const { session, store } = setUp(42);
    const ascent = session.begin({ gauge: -1, blessings: ['rare'] });
    expect(ascent).toEqual(startAscent(42, { gauge: -1, blessings: ['rare'] }));
    expect(ascent.hero.maxHp).toBe(72);

    session.chooseBlessing(0);
    await flush();

    expect(session.current()!.blessings).toEqual([
      { family: ascent.blessingOffer![0], rarity: 'rare' },
    ]);
    expect(saved(store)?.ascent).toEqual(session.current());
  });

  it('equips or leaves a found item', async () => {
    const { session, store } = setUp();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: { ...startAscent(5), encounter: null, foundItem: 'axe' },
        battle: null,
      }),
    );
    await session.load();

    session.equipItem();
    expect(session.current()).toMatchObject({ foundItem: null, equipment: { weapon: 'axe' } });

    await session.load();
    session.leaveItem();
    expect(session.current()).toMatchObject({ foundItem: null, equipment: { weapon: null } });
  });

  it('fights with the max HP and the modifiers of the blessings and the items', async () => {
    const { session, store } = setUp();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: {
          ...startAscent(5, { gauge: 1 }),
          hero: { hp: 70, maxHp: 79 },
          blessings: [{ family: 'haste', rarity: 'rare' }],
          equipment: { weapon: 'axe', armor: null, accessory: 'hasteAmulet' },
        },
        battle: null,
      }),
    );
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.hero).toMatchObject({ hp: 70, maxHp: 79 });
    expect(battle.modifiers).toMatchObject({ initiative: 3, guardDamagePercents: [110] });
  });

  it('resumes an ascent saved before the gauge, Neutral with the base kit', async () => {
    const { session, store } = setUp();
    const {
      gauge: _gauge,
      blessings: _blessings,
      blessingRarities: _rarities,
      blessingOffer: _offer,
      equipment: _equipment,
      foundItem: _found,
      lootRandom: _loot,
      ...older
    } = startAscent(5);
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: older, battle: null }));

    expect(await session.load()).toEqual(startAscent(5));
  });

  it('ignores the choices without an ascent', () => {
    const { session } = setUp();
    session.chooseBlessing(0);
    session.equipItem();
    session.leaveItem();
    expect(session.current()).toBeNull();
  });
});

describe('AscentSession: the rerolls of the favor (#42)', () => {
  const offered = (gauge: 1 | 2 = 2) =>
    endFloorBattle(startAscent(42, { gauge }), { outcome: 'victory', heroHp: 50 });

  it('rerolls the offer and saves it: a reload gives the same offer and rerolls', async () => {
    const { session, store } = setUp();
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: offered(), battle: null }));
    await session.load();

    session.reroll();
    await flush();

    const rerolled = session.current()!;
    expect(rerolled.rerolls).toBe(1);
    expect(rerolled.boonOffer).not.toEqual(offered().boonOffer);
    expect(saved(store)?.ascent).toEqual(rerolled);
    const reopened = setUp();
    reopened.store.values.set(ASCENT_KEY, store.values.get(ASCENT_KEY)!);
    expect(await reopened.session.load()).toEqual(rerolled);
  });

  it('keeps the rerolls left on a resume, whatever the gauge of the day', async () => {
    const { session, store } = setUp();
    const yesterday = { ...offered(), rerolls: 1 };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: yesterday, battle: null }));

    const resumed = await session.load();

    expect(resumed).toMatchObject({ gauge: 2, rerolls: 1 });
  });

  it.each([
    [2, 2],
    [1, 1],
    [0, 0],
  ] as const)(
    'resumes an ascent saved before the rerolls at a gauge of %p with %p rerolls',
    async (gauge, rerolls) => {
      const { session, store } = setUp();
      const { rerolls: _rerolls, rerollRandom: _random, ...older } = startAscent(5, { gauge });
      store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: older, battle: null }));

      expect(await session.load()).toMatchObject({ rerolls, rerollRandom: rerollStream(5) });
    },
  );

  it('ignores a reroll without an ascent, or without a reroll possible', async () => {
    const { session, store } = setUp();
    session.reroll();
    expect(session.current()).toBeNull();

    const ascent = offered();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: { ...ascent, rerolls: 0 }, battle: null }),
    );
    await session.load();
    session.reroll();
    expect(session.current()).toMatchObject({ boonOffer: ascent.boonOffer, rerolls: 0 });
  });
});

describe('AscentSession: the second chance of the favor (#206)', () => {
  /** Le combat sauvé de l'ascension, contre une Goule seule : la Sentinelle à 80 PV max. */
  function risingBattle({
    heroHp,
    heroMaxHp = 80,
    enemyHp,
    secondChance = true,
  }: {
    readonly heroHp: number;
    readonly heroMaxHp?: number;
    readonly enemyHp: number;
    readonly secondChance?: boolean;
  }): Battle {
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp,
      heroMaxHp,
      enemies: ['ghoul'],
      ...(secondChance && { secondChance }),
    });
    return { ...battle, enemies: [{ ...battle.enemies[0]!, hp: enemyHp }] };
  }

  async function resumed(ascent: Ascent, battle: Battle) {
    const set = setUp();
    set.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await set.session.load();
    const battleSession = set.session.battleSession();
    await battleSession.start();
    return { ...set, battleSession };
  }

  /** Le combat joué jusqu'à ce que le héros se relève. */
  async function playUntilRisen(battleSession: BattleSession, clock: ManualBattleClock) {
    for (let guard = 0; guard < 200; guard += 1) {
      const { battle } = battleSession.current()!;
      if (battle.hero.secondChance === 'used') return battle;
      if (battle.phase.kind === 'hero') {
        const at = clock.now() + 50;
        clock.advanceTo(at);
        battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
      await flush();
    }
    throw new Error('The hero never rose');
  }

  it('fights a new battle with the second chance ready at +2, and none at +1', async () => {
    for (const [gauge, ready] of [
      [2, true],
      [1, false],
    ] as const) {
      const { session } = setUp(42);
      session.begin({ gauge });
      const battleSession = session.battleSession();
      await battleSession.start();

      const { hero } = battleSession.current()!.battle;
      expect(hero.secondChance === 'ready').toBe(ready);
      if (!ready) expect(hero).not.toHaveProperty('secondChance');
    }
  });

  it('saves the rise at once: a reload gives 40 HP and the second chance used', async () => {
    const ascent = startAscent(42, { gauge: 2 });
    const { battleSession, clock, store } = await resumed(
      ascent,
      risingBattle({ heroHp: 1, enemyHp: 50 }),
    );

    const risen = await playUntilRisen(battleSession, clock);
    await flush();

    expect(risen.hero).toMatchObject({ hp: 40, secondChance: 'used' });
    expect(saved(store)?.battle?.hero).toMatchObject({ hp: 40, secondChance: 'used' });
    const reopened = await resumed(saved(store)!.ascent, saved(store)!.battle!);
    expect(reopened.battleSession.current()!.battle.hero).toMatchObject({
      hp: 40,
      secondChance: 'used',
    });
  });

  it('takes it away from the ascent at the end of the battle, and the next battle has none', async () => {
    const ascent = startAscent(42, { gauge: 2 });
    const { battleSession, clock, session } = await resumed(
      ascent,
      risingBattle({ heroHp: 1, enemyHp: 50 }),
    );
    await playUntilRisen(battleSession, clock);

    const ended = await playToTheEnd(battleSession, clock);
    await flush();

    expect(ended.hero.secondChance).toBe('used');
    expect(session.current()).toMatchObject({ outcome: null, secondChance: false });
    session.chooseBoon(0);
    session.chooseExit(session.current()!.exits.findIndex((exit) => exit.kind === 'combat'));
    const next = session.battleSession();
    await next.start();
    expect(next.current()!.battle.hero).not.toHaveProperty('secondChance');
  });

  it('takes it away from the ascent when the hero falls after rising', async () => {
    const ascent = startAscent(42, { gauge: 2 });
    const { battleSession, clock, session } = await resumed(
      ascent,
      risingBattle({ heroHp: 1, heroMaxHp: 2, enemyHp: 50 }),
    );

    const ended = await playToTheEnd(battleSession, clock);
    await flush();

    expect(ended.hero).toMatchObject({ hp: 0, secondChance: 'used' });
    expect(session.current()).toMatchObject({ outcome: 'fall', secondChance: false });
  });

  it('keeps it on a resume, whatever the gauge of the day', async () => {
    const { session, store } = setUp();
    const yesterday = startAscent(5, { gauge: 2 });
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: yesterday, battle: null }));

    expect(await session.load()).toMatchObject({ gauge: 2, secondChance: true });
  });

  it.each([
    [2, true],
    [1, false],
    [-2, false],
  ] as const)(
    'resumes an ascent saved before the second chance at a gauge of %p: %p',
    async (gauge, secondChance) => {
      const { session, store } = setUp();
      const { secondChance: _, ...older } = startAscent(5, { gauge });
      store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: older, battle: null }));

      expect(await session.load()).toMatchObject({ secondChance });
    },
  );

  it('keeps it for the next battles after a battle saved without it', async () => {
    const ascent = startAscent(42, { gauge: 2 });
    const { battleSession, clock, session } = await resumed(
      ascent,
      risingBattle({ heroHp: 60, enemyHp: 1, secondChance: false }),
    );

    await playToTheEnd(battleSession, clock);
    await flush();

    expect(session.current()).toMatchObject({ outcome: null, secondChance: true });
  });
});

describe('AscentSession: cursed enemies (#209)', () => {
  it('fights the cursed enemy drawn for the floor under the curse', async () => {
    const { session } = setUp(42);
    const ascent = session.begin({ gauge: -1 });
    const index = ascent.encounter!.cursed!;
    const battleSession = session.battleSession();
    await battleSession.start();

    const { enemies } = battleSession.current()!.battle;
    expect(enemies[index]).toMatchObject({ cursed: true });
    expect(enemies.filter((enemy) => enemy.cursed)).toHaveLength(1);
  });

  it('fights no cursed enemy when the habits cannot be read, the gauge Neutral', async () => {
    const { session } = setUp(42);
    const ascent = session.begin({ gauge: UNREADABLE_GAUGE.gauge });
    expect(ascent.encounter!.cursed).toBeUndefined();
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle.enemies.some((enemy) => enemy.cursed)).toBe(false);
  });

  it('resumes a saved battle with its cursed enemy', async () => {
    const { session, store } = setUp(42);
    const ascent = startAscent(42, { gauge: -2 });
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ascent.encounter!.enemies,
      cursed: ascent.encounter!.cursed!,
    });
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();

    const curses = (enemies: Battle['enemies']) => enemies.map((enemy) => enemy.cursed === true);
    expect(curses(battle.enemies)).toContain(true);
    expect(curses(battleSession.current()!.battle.enemies)).toEqual(curses(battle.enemies));
  });
});

describe('AscentSession: hero and boons (prototype #92)', () => {
  it('begins the ascent with the chosen hero', async () => {
    const { session, store } = setUp(42);

    const ascent = session.begin({ hero: 'wanderer' });
    await flush();

    expect(ascent).toEqual(startAscent(42, { hero: 'wanderer' }));
    expect(saved(store)?.ascent.hero.kind).toBe('wanderer');
  });

  it('fights with the hero of the ascent and the modifiers of his boons', async () => {
    const { session, store } = setUp();
    const ascent = startAscent(5, { hero: 'wanderer' });
    const withBoons = { ...ascent, hero: { ...ascent.hero, boons: ['perfectEcho'] } };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: withBoons, battle: null }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.heroKind).toBe('wanderer');
    expect(battle.hero.maxHp).toBe(55);
    expect(battle.modifiers?.counterPercents).toEqual([150]);
  });

  it('chooses a boon of the offer, publishes and saves it', async () => {
    const { session, store } = setUp();
    const ascent = { ...startAscent(5), encounter: null, boonOffer: ['frostSkin', 'trueEdge'] };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));
    await session.load();
    const published: (Ascent | null)[] = [];
    session.subscribe((current) => published.push(current));

    session.chooseBoon(1);
    await flush();

    expect(published).toEqual([session.current()]);
    expect(saved(store)?.ascent).toMatchObject({
      hero: { boons: ['trueEdge'] },
      boonOffer: null,
    });
  });

  it('resumes a save with Second souffle in the offer and a tier boon, then heals (#212)', async () => {
    const { session, store } = setUp();
    const start = startAscent(5);
    const ascent = {
      ...start,
      tier: 2,
      encounter: null,
      hero: { ...start.hero, hp: 40, boons: ['ashenBlade'] },
      boonOffer: ['hoarfrost', 'secondBreath'],
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));

    expect((await session.load())?.boonOffer).toEqual(['hoarfrost', 'secondBreath']);
    session.chooseBoon(1);
    await flush();

    expect(saved(store)?.ascent).toMatchObject({
      hero: { hp: 48, boons: ['ashenBlade'] },
      boonOffer: null,
    });
  });

  it('resumes a save of #91 with the Sentinel, without boon nor offer', async () => {
    const { session, store } = setUp();
    const { hero, boonOffer, ...ascent } = startAscent(5);
    const old = { ...ascent, hero: { hp: 41, maxHp: hero.maxHp } };
    expect(boonOffer).toBeNull();
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: old, battle: null }));

    expect(await session.load()).toEqual({
      ...startAscent(5),
      hero: { kind: 'sentinel', hp: 41, maxHp: 80, boons: [] },
    });
    session.chooseBoon(0);
    expect(session.current()?.hero.boons).toEqual([]);
  });

  it('combines the boons with the items in battle: Cuir + Lame juste (P21)', async () => {
    const { session, store } = setUp();
    const ascent = startAscent(5);
    const build = {
      ...ascent,
      hero: { ...ascent.hero, boons: ['trueEdge'] },
      equipment: { ...ascent.equipment, armor: 'leather' },
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: build, battle: null }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle.modifiers?.perfectStrikeBonusPercents).toEqual([20, 50]);
  });

  it('resumes a save with the armor worn: the next battle adds its Attack +5 % to the Edge (#152)', async () => {
    const { session, store } = setUp();
    const ascent = {
      ...startAscent(5),
      blessings: [{ family: 'edge', rarity: 'rare' }],
      blessingRarities: [],
      blessingOffer: null,
      equipment: { weapon: null, armor: 'blackKnightArmor', accessory: null },
    };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));

    expect(await session.load()).toMatchObject({ equipment: { armor: 'blackKnightArmor' } });
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle.modifiers).toMatchObject({
      attackFlat: 0,
      attackBonusPercent: 25,
      damageReductionPoints: 20,
      initiative: -2,
    });
  });

  describe('a save from before the workshop values (#105)', () => {
    /** Écrite à la main, comme avant #105 : Égide (`aegis`) choisie et dans l'offre en cours. */
    const before = (overrides: object = {}) =>
      JSON.stringify({
        version: 1,
        ascent: {
          ...startAscent(5),
          blessings: [{ family: 'aegis', rarity: 'rare' }],
          blessingRarities: ['common'],
          blessingOffer: ['vigor', 'aegis', 'haste'],
          equipment: { weapon: 'axe', armor: null, accessory: null },
          ...overrides,
        },
        battle: null,
      });

    it('reads Aegis as Protection, in the chosen blessings and in the offer', async () => {
      const { session, store } = setUp();
      store.values.set(ASCENT_KEY, before());

      const ascent = await session.load();

      expect(ascent).toMatchObject({
        blessings: [{ family: 'protection', rarity: 'rare' }],
        blessingOffer: ['vigor', 'protection', 'haste'],
        equipment: { weapon: 'axe' },
      });
    });

    it('fights the next battle with the Rusted axe x1.1 and the same Protection reduction', async () => {
      const { session, store } = setUp();
      store.values.set(ASCENT_KEY, before({ blessingRarities: [], blessingOffer: null }));
      await session.load();

      const battleSession = session.battleSession();
      await battleSession.start();

      expect(battleSession.current()!.battle.modifiers).toMatchObject({
        guardDamagePercents: [110],
        damageReductionPoints: 10,
        initiative: -1,
      });
    });

    it('finishes a battle in progress with its starting values, the next one with the new ones', async () => {
      const { session, store, clock } = setUp();
      const ascent = {
        ...startAscent(5),
        equipment: { weapon: 'hammer', armor: null, accessory: null },
      };
      const oldHammer = { guardDamagePercents: [160], attackPercents: [80], initiative: -2 };
      const battle = savedBattle(ascent as Ascent, { heroHp: 70, enemyHp: 1 });
      store.values.set(
        ASCENT_KEY,
        JSON.stringify({
          version: 1,
          ascent,
          battle: { ...battle, modifiers: { ...battle.modifiers, ...oldHammer } },
        }),
      );
      await session.load();
      const resumed = session.battleSession();
      await resumed.start();
      expect(resumed.current()!.battle.modifiers).toMatchObject(oldHammer);

      await playToTheEnd(resumed, clock);
      // La graine 5 : Mailles trouvées (laissées), puis Lame juste, puis la porte Combat.
      expect(session.current()).toMatchObject({
        foundItem: 'chainmail',
        exits: [{ kind: 'combat' }, { kind: 'campfire' }],
      });
      session.leaveItem();
      session.chooseBoon(0);
      session.chooseExit(0);
      const next = session.battleSession();
      await next.start();

      expect(next.current()!.battle.modifiers).toMatchObject({
        guardDamagePercents: [160],
        attackPercents: [],
        initiative: -1,
      });
    });
  });
});

describe('AscentSession: the Summon of the Moth queen (#172)', () => {
  const bossOfTier2: Ascent = {
    ...startAscent(5),
    tier: 2,
    floor: 6,
    encounter: { kind: 'boss', enemies: ['mothQueen'], battleSeed: 3 },
  };

  /** Le combat contre la Reine, son Invocation annoncée : deux Phalénides aux places 1 et 2. */
  function announced(): Battle {
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 60,
      initiative: true,
      enemies: ['mothQueen'],
      summonMultiplier: TIERS[2].multiplier,
    });
    return {
      ...battle,
      enemies: [{ ...battle.enemies[0]!, hp: 190, phase2: true }],
      summon: { summoner: 0, kind: 'mothkin', slots: [1, 2] },
    };
  }

  it('saves the summon called by the riposte of the Bulwark with the riposte itself', async () => {
    const { session, store, clock } = setUp();
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 60,
      initiative: true,
      enemies: ['mothQueen'],
      summonMultiplier: TIERS[2].multiplier,
    });
    // La Reine agit avant la Sentinelle : elle porte un coup simple de 5 sur le Rempart levé.
    const riposting: Battle = {
      ...battle,
      hero: { ...battle.hero, bulwark: true },
      enemies: [
        {
          ...battle.enemies[0]!,
          hp: 202,
          guard: 60,
          intent: {
            category: 'attack',
            attack: 'basic',
            damage: 5,
            windUpMs: ATTACKS.basic.windUpMs,
            feintFraction: 0.5,
          },
        },
      ],
    };
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: bossOfTier2, battle: riposting }),
    );
    await session.load();
    const battleSession = session.battleSession();
    const events: BattleEvent[] = [];
    battleSession.subscribe((snapshot) => events.push(...snapshot.events));
    await battleSession.start();

    for (let guard = 0; guard < 50; guard += 1) {
      if (events.some((event) => event.type === 'summonCalled')) break;
      clock.advanceTo(clock.pending()[0]!);
      await flush();
    }

    const called = events.findIndex((event) => event.type === 'summonCalled');
    expect(events[called - 2]?.type).toBe('bulwarkCountered');
    expect(saved(store)?.battle?.summon).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
  });

  it('gives every floor battle the multiplier of the tier for its summoned enemies, and the boss its own (#244)', async () => {
    const { session, store } = setUp();
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: bossOfTier2, battle: null }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.summonMultiplier).toEqual(TIERS[2].multiplier);
    expect(battle.tierMultiplier).toEqual(TIERS[2].bossMultiplier);
    expect(battle.enemies[0]).toMatchObject({ kind: 'mothQueen', maxHp: 400, maxGuard: 87 });
  });

  it('resumes an announced summon, and saves the battle when the Mothkin enter', async () => {
    const { session, store, clock } = setUp();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: bossOfTier2, battle: announced() }),
    );
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();
    expect(battleSession.current()!.battle.summon).toEqual({
      summoner: 0,
      kind: 'mothkin',
      slots: [1, 2],
    });

    for (let guard = 0; guard < 100 && battleSession.current()!.battle.enemies.length < 3;) {
      guard += 1;
      const { battle } = battleSession.current()!;
      if (battle.phase.kind === 'hero') {
        const at = clock.now() + 50;
        clock.advanceTo(at);
        battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
      await flush();
    }

    const { battle } = battleSession.current()!;
    expect(battle.enemies.slice(1).map((enemy) => [enemy.kind, enemy.hp])).toEqual([
      ['mothkin', 33],
      ['mothkin', 33],
    ]);
    expect(saved(store)?.battle?.enemies).toHaveLength(3);
    expect(saved(store)?.battle?.summon).toBeUndefined();
  });

  it('leaves a battle won over the Moth queen once her Mothkin have fallen, 780 ms later', async () => {
    const { session, store, clock } = setUp();
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 50,
      enemies: ['mothQueen', 'mothkin'],
    });
    const nearlyWon: Battle = {
      ...battle,
      enemies: [
        { ...battle.enemies[0]!, hp: 1, phase2: true },
        { ...battle.enemies[1]!, summoned: true, stun: { actionLost: false, heroAction: 999 } },
      ],
    };
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: startAscent(5), battle: nearlyWon }),
    );
    await session.load();
    const published: (Ascent | null)[] = [];
    session.subscribe((current) => published.push(current));
    const battleSession = session.battleSession();
    await battleSession.start();

    const events: BattleEvent[] = [];
    battleSession.subscribe((snapshot) => events.push(...snapshot.events));
    const won = playUntilOver(battleSession, clock);
    await flush();
    const fellAt = events.find((event) => event.type === 'summonedFell')!.at;

    expect(won.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(won.enemies[1]!.hp).toBe(0);
    expect(SUMMON_FALL_HOLD_MS).toBe(780);
    expect(clock.now()).toBeLessThan(fellAt + 779);
    clock.advanceTo(fellAt + 779);
    await flush();
    expect(published).toEqual([]);
    clock.advanceTo(fellAt + SUMMON_FALL_HOLD_MS);
    await flush();
    expect(published).toHaveLength(1);
  });
});

describe('AscentSession: the keys and the sealed chest (#226)', () => {
  /** L'Élite gagnée à l'étage 3, son objet garanti laissé : le coffre scellé attend. */
  const waiting = (keys = 2): Ascent => {
    const ascent: Ascent = {
      ...startAscent(42, { gauge: 1 }),
      floor: 3,
      keys,
      encounter: { kind: 'elite', enemies: ['twins'], battleSeed: 1 },
    };
    return leaveItem(endFloorBattle(ascent, { outcome: 'victory', heroHp: 50 }));
  };

  async function resumed(ascent: Ascent) {
    const story = setUp();
    story.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));
    await story.session.load();
    return story;
  }

  it('opens the chest and saves it: a reload gives the same item and keys (CH10)', async () => {
    const { session, store } = await resumed(waiting());

    session.openSealedChest();
    await flush();

    const opened = session.current()!;
    expect(opened).toMatchObject({ keys: 1, sealedChest: { opened: true } });
    expect(opened.foundItem).not.toBeNull();
    expect(saved(store)?.ascent).toEqual(opened);
    const reopened = setUp();
    reopened.store.values.set(ASCENT_KEY, store.values.get(ASCENT_KEY)!);
    expect(await reopened.session.load()).toEqual(opened);
  });

  it('keeps a closed chest waiting after a reload', async () => {
    const { session } = await resumed(waiting());

    expect(session.current()).toMatchObject({ keys: 2, sealedChest: { opened: false } });
  });

  it('leaves the chest closed and saves it, keys kept', async () => {
    const { session, store } = await resumed(waiting());

    session.leaveSealedChest();
    await flush();

    expect(session.current()).toMatchObject({ keys: 2, sealedChest: null });
    expect(saved(store)?.ascent).toEqual(session.current());
  });

  it('ignores an opening or a leaving without an ascent', () => {
    const { session } = setUp();

    session.openSealedChest();
    session.leaveSealedChest();

    expect(session.current()).toBeNull();
  });

  it('keeps the keys left on a resume, whatever the gauge of the day (K4)', async () => {
    const { session } = await resumed({ ...startAscent(5, { gauge: 1 }), keys: 1 });

    expect(session.current()).toMatchObject({ gauge: 1, keys: 1 });
  });

  it.each([
    [2, 1],
    [1, 1],
    [0, 0],
    [-2, 0],
  ] as const)(
    'resumes an ascent saved before the keys at a gauge of %p with %p key, without chest',
    async (gauge, keys) => {
      const {
        keys: _keys,
        sealedChest: _chest,
        sealedChestRandom: _random,
        ...older
      } = startAscent(5, { gauge });
      const { session } = await resumed(older as Ascent);

      expect(session.current()).toMatchObject({
        keys,
        sealedChest: null,
        sealedChestRandom: sealedChestStream(5),
      });
    },
  );

  describe('the keys at the entry into the tower (F4)', () => {
    it('are told after the start with a key, until acknowledged', () => {
      const { session } = setUp();

      session.begin({ gauge: 2 });

      expect(session.keysEntry()).toEqual({ favor: 1, fortune: 0 });
      session.acknowledgeKeysEntry();
      expect(session.keysEntry()).toBeNull();
    });

    it('are told once the blessings are chosen', () => {
      const { session } = setUp();
      session.begin({ gauge: 1, blessings: ['rare'] });

      expect(session.keysEntry()).toBeNull();
      session.chooseBlessing(0);
      expect(session.keysEntry()).toEqual({ favor: 1, fortune: 0 });
    });

    it('are told with the keys of Fortune, apart from those of the favor', () => {
      const seed = Array.from({ length: 100 }, (_, each) => each).find((each) =>
        startAscent(each, { blessings: ['rare'] }).blessingOffer!.includes('fortune'),
      )!;
      const { session } = setUp(seed);
      session.begin({ gauge: 2, blessings: ['rare'] });

      session.chooseBlessing(session.current()!.blessingOffer!.indexOf('fortune'));

      expect(session.current()!.keys).toBe(3);
      expect(session.keysEntry()).toEqual({ favor: 1, fortune: 2 });
    });

    it('are never told without key, after the battle starts, nor after a reload', async () => {
      const without = setUp();
      without.session.begin({ gauge: 0 });
      expect(without.session.keysEntry()).toBeNull();

      const started = setUp();
      started.session.begin({ gauge: 1 });
      started.session.battleSession();
      expect(started.session.keysEntry()).toBeNull();

      const { session } = await resumed(startAscent(5, { gauge: 1 }));
      expect(session.keysEntry()).toBeNull();
    });
  });
});

describe('AscentSession: the equipped powers (#235)', () => {
  async function reloaded(ascent: unknown, battle: Battle | null = null) {
    const set = setUp();
    set.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
    await set.session.load();
    return set;
  }

  it('saves the equipped powers with the ascent, and reads them back unchanged', async () => {
    const { session, store } = setUp();
    session.begin({ hero: 'sentinel', powers: ['bulwark', 'retaliation'] });
    await flush();

    expect(saved(store)?.ascent.powers).toEqual(['bulwark', 'retaliation']);
    const again = await reloaded(saved(store)!.ascent);
    expect(again.session.current()?.powers).toEqual(['bulwark', 'retaliation']);
  });

  it('gives an ascent saved before the update its base power alone', async () => {
    const { powers: _, ...before } = startAscent(42, { hero: 'wanderer' });

    const { session } = await reloaded(before);

    expect(session.current()?.powers).toEqual(['shadowStep']);
  });

  it('fights its battles with its equipped powers', async () => {
    const { session } = setUp();
    session.begin({ hero: 'wanderer', powers: ['shadowStep', 'rend', 'mist'] });
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle.powers).toEqual(['shadowStep', 'rend', 'mist']);
  });

  it('resumes a battle saved before the update with its base power alone', async () => {
    const ascent = startAscent(42, { powers: ['bulwark', 'retaliation'] });
    const { battle } = startBattle({ seed: 3, defenseHint: false, at: 0, enemies: ['ghoul'] });

    const { session } = await reloaded(ascent, battle);
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(battleSession.current()!.battle).not.toHaveProperty('powers');
  });
});
