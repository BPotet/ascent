import { startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { TIERS } from '../../domain/ascent/tiers';
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
    expect(saved(store)?.battle?.enemies[0]).toMatchObject({ hp: 50, guard: 15 });

    clock.advanceTo(startedAt + 1_260);
    await flush();
    expect(saved(store)?.battle?.enemies[0]).toMatchObject({ hp: 47, guard: 12 });
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

  it('gives every floor battle the multiplier of the tier for its summoned enemies, never to the boss', async () => {
    const { session, store } = setUp();
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: bossOfTier2, battle: null }));
    await session.load();

    const battleSession = session.battleSession();
    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.summonMultiplier).toEqual(TIERS[2].multiplier);
    expect(battle.tierMultiplier).toBeUndefined();
    expect(battle.enemies[0]).toMatchObject({ kind: 'mothQueen', maxHp: 400 });
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
