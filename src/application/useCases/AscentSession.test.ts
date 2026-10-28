import { startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import { DEFAULT_TRIAL_TUNING } from '../../domain/battle/TrialTuning';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import { ASCENT_KEY, AscentSession } from './AscentSession';
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
    tuning: DEFAULT_TRIAL_TUNING,
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
    const { session, store } = setUp(42);
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
    expect(battle.modifiers).toMatchObject({ initiative: 3, guardDamagePercents: [130] });
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
    expect(battle.hero.maxHp).toBe(60);
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
});
