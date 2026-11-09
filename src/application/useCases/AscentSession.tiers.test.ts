// La session d'ascension sur trois paliers (#38, ADR 0012) : le Total d'Éclats crédité et sauvegardé
// avant l'écran qui suit la victoire, jamais deux fois, gardé après une chute ou un abandon ; le
// Passage de palier sauvegardé et repris ; le multiplicateur de palier des combats ordinaires et celui
// d'Élite et de boss (#244).
import {
  startAscent,
  type Ascent,
  type Encounter,
  type TierPassage,
} from '../../domain/ascent/Ascent';
import { drawElite, eliteCandidates } from '../../domain/ascent/elites';
import { TIERS, encounterMultipliers } from '../../domain/ascent/tiers';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import { ENEMIES, type EnemyKind } from '../../domain/battle/combatants';
import { scaleByPercent } from '../../domain/battle/tierMultiplier';
import { ELITE_BATTLE_BEFORE_257 } from '../testing/eliteBattleBefore257';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import {
  ASCENT_KEY,
  AscentSession,
  SHARD_TOTAL_KEY,
  UNREADABLE_SHARD_TOTAL_KEY,
} from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import type { BattleSession } from './BattleSession';

/**
 * Un stockage en mémoire ; `hold` retient l'écriture d'une clé jusqu'à `release`, `failReads` fait
 * échouer sa lecture.
 */
function mapStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  const held = new Map<string, () => void>();
  const failing = new Map<string, number>();
  const unreadable = new Set<string>();
  return {
    values,
    hold: (key: string) => held.set(key, () => undefined),
    release: (key: string) => {
      const resume = held.get(key);
      held.delete(key);
      resume?.();
    },
    failTimes: (key: string, times: number) => failing.set(key, times),
    failReads: (key: string) => unreadable.add(key),
    get: async (key: string) => {
      if (unreadable.has(key)) throw new Error('The store failed');
      return values.get(key) ?? null;
    },
    set: async (key: string, value: string) => {
      const failures = failing.get(key) ?? 0;
      if (failures > 0) {
        failing.set(key, failures - 1);
        throw new Error('The store failed');
      }
      if (held.has(key)) {
        await new Promise<void>((resolve) => held.set(key, resolve));
      }
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

type Store = ReturnType<typeof mapStore>;

function setUp(store: Store = mapStore(), seed = 42) {
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

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

const savedAscent = (store: Store) =>
  (JSON.parse(store.values.get(ASCENT_KEY)!) as { ascent: Ascent }).ascent;
const savedShards = (store: Store) => JSON.parse(store.values.get(SHARD_TOTAL_KEY)!) as unknown;

/** Une ascension de graine 3 au palier `tier`, à l'étage 6 ou 3, devant `enemies`. */
function ascentAt(tier: 1 | 2 | 3, kind: Encounter['kind'], enemies: readonly EnemyKind[]): Ascent {
  return {
    ...startAscent(3),
    tier,
    floor: kind === 'boss' ? 6 : 3,
    encounter: { kind, enemies, battleSeed: 3 },
  };
}

/** Le combat sauvegardé de l'ascension, le premier ennemi à `enemyHp` PV. */
function battleOf(ascent: Ascent, enemyHp = 1, heroHp = 70): Battle {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp,
    enemies: ascent.encounter!.enemies,
  });
  return { ...battle, enemies: [{ ...battle.enemies[0]!, hp: enemyHp }] };
}

async function loaded(store: Store, ascent: Ascent, battle: Battle | null = battleOf(ascent)) {
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
  const set = setUp(store);
  await set.session.load();
  return set;
}

async function playToTheEnd(battleSession: BattleSession, clock: ManualBattleClock) {
  await battleSession.start();
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

async function beat(store: Store, ascent: Ascent) {
  const set = await loaded(store, ascent);
  await playToTheEnd(set.session.battleSession(), set.clock);
  await flush();
  return set;
}

const BOSS_OF_TIER_1 = ascentAt(1, 'boss', ['ossuaryWarden']);
const BOSS_AWARD = { id: '3:1:6:boss', amount: 8 };

describe('the Shard total of the session (#38)', () => {
  it('reads 0 Shards when none was ever won', async () => {
    const { session } = setUp();

    await session.load();

    expect(session.shardTotal()).toBe(0);
  });

  it('reads the Shard total, with or without an ascent in progress', async () => {
    const store = mapStore();
    store.values.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: 22, seed: 1, awarded: [] }),
    );
    const { session } = setUp(store);

    await session.load();

    expect(session.shardTotal()).toBe(22);
  });

  it('credits and saves the 8 Shards of the boss of tier 1 before the defeated boss screen', async () => {
    const store = mapStore();
    store.hold(SHARD_TOTAL_KEY);
    const { session, clock } = await loaded(store, BOSS_OF_TIER_1);
    const published: (TierPassage | null)[] = [];
    session.subscribe((ascent) => published.push(ascent?.passage ?? null));

    await playToTheEnd(session.battleSession(), clock);
    await flush();

    expect(published).toEqual([]);
    expect(savedAscent(store).passage).toBeNull();
    store.release(SHARD_TOTAL_KEY);
    await flush();
    expect(savedShards(store)).toEqual({ version: 1, total: 8, seed: 3, awarded: [BOSS_AWARD.id] });
    expect(published).toEqual([{ to: 2, step: 'bossDefeated' }]);
    expect(savedAscent(store).passage).toEqual({ to: 2, step: 'bossDefeated' });
    expect(session.shardTotal()).toBe(8);
  });

  it('tells its subscribers of each credit', async () => {
    const store = mapStore();
    const { session, clock } = await loaded(store, BOSS_OF_TIER_1);
    const totals: number[] = [];
    session.subscribeShards((total) => totals.push(total));

    await playToTheEnd(session.battleSession(), clock);
    await flush();

    expect(totals).toEqual([8]);
  });

  it('no longer tells a subscriber gone, and still tells the others', async () => {
    const store = mapStore();
    const { session, clock } = await loaded(store, BOSS_OF_TIER_1);
    const gone: number[] = [];
    const staying: number[] = [];
    const unsubscribe = session.subscribeShards((total) => gone.push(total));
    session.subscribeShards((total) => staying.push(total));

    unsubscribe();
    await playToTheEnd(session.battleSession(), clock);
    await flush();

    expect(gone).toEqual([]);
    expect(staying).toEqual([8]);
  });

  it('credits 2 Shards for an Elite before the loot screen', async () => {
    const store = mapStore();

    const { session } = await beat(store, ascentAt(2, 'elite', ['scarecrow']));

    expect(session.shardTotal()).toBe(2);
    expect(session.current()?.shardAwards).toContainEqual({ id: '3:2:3:elite', amount: 2 });
  });

  it('credits 28 Shards at once for the boss of tier 3 and the Summit, and ends the ascent', async () => {
    const store = mapStore();

    const { session } = await beat(store, ascentAt(3, 'boss', ['wishGranter']));

    expect(session.shardTotal()).toBe(28);
    expect(session.current()?.outcome).toBe('victory');
    expect(store.values.has(ASCENT_KEY)).toBe(false);
  });

  it('keeps the Shards after a fall, an abandon and the return to the tower foot', async () => {
    const store = mapStore();
    const { session } = await beat(store, BOSS_OF_TIER_1);
    session.acknowledgeBossVictory();
    session.enterNextTier();

    session.abandon();
    session.leave();
    await flush();

    expect(session.shardTotal()).toBe(8);
    expect(savedShards(store)).toMatchObject({ total: 8 });
  });

  it('never credits twice a boss beaten again after a forced close', async () => {
    const store = mapStore();
    store.values.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: 8, seed: 3, awarded: [BOSS_AWARD.id] }),
    );

    const { session } = await beat(store, BOSS_OF_TIER_1);

    expect(session.shardTotal()).toBe(8);
    expect(savedShards(store)).toMatchObject({ total: 8 });
  });

  it('credits on loading the Shards of the ascent that the total misses', async () => {
    const store = mapStore();
    const ascent = { ...startAscent(3), shardAwards: [BOSS_AWARD] };
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: null }));
    const { session } = setUp(store);

    await session.load();
    await flush();

    expect(session.shardTotal()).toBe(8);
    expect(savedShards(store)).toMatchObject({ total: 8, awarded: [BOSS_AWARD.id] });
  });

  it('goes on when the Shard total cannot be written, and writes it with a next save', async () => {
    const store = mapStore();
    // L'écriture de la victoire, puis celle de la sauvegarde de l'ascension qui suit, échouent.
    store.failTimes(SHARD_TOTAL_KEY, 2);

    const { session } = await beat(store, BOSS_OF_TIER_1);

    expect(session.current()?.passage).toEqual({ to: 2, step: 'bossDefeated' });
    expect(store.values.has(SHARD_TOTAL_KEY)).toBe(false);
    session.pause();
    await flush();
    expect(savedShards(store)).toMatchObject({ total: 8 });
  });

  it('keeps an unreadable Shard total aside, never erased in silence, and starts again from 0', async () => {
    const store = mapStore();
    store.values.set(SHARD_TOTAL_KEY, '{oops');
    const { session } = setUp(store);

    await session.load();
    await flush();

    expect(session.shardTotal()).toBe(0);
    expect(store.values.get(UNREADABLE_SHARD_TOTAL_KEY)).toBe('{oops');
    expect(savedShards(store)).toEqual({ version: 1, total: 0, seed: null, awarded: [] });
  });
});

describe('an unreadable Shard total that cannot be kept aside (#38)', () => {
  it('never overwrites the stored value, even after a credit, and shows the Shards of the session', async () => {
    const store = mapStore();
    store.values.set(SHARD_TOTAL_KEY, '{oops');
    store.failTimes(UNREADABLE_SHARD_TOTAL_KEY, 1);

    const { session } = await beat(store, BOSS_OF_TIER_1);
    session.pause();
    await flush();

    expect(store.values.get(SHARD_TOTAL_KEY)).toBe('{oops');
    expect(store.values.has(UNREADABLE_SHARD_TOTAL_KEY)).toBe(false);
    expect(session.shardTotal()).toBe(8);
    expect(session.current()?.passage).toEqual({ to: 2, step: 'bossDefeated' });
  });
});

describe('the end of a battle in the session (#38)', () => {
  it('shows the next screen at once after an ordinary battle won, without writing any Shard', async () => {
    const store = mapStore();
    store.hold(SHARD_TOTAL_KEY);
    const { session, clock } = await loaded(store, ascentAt(1, 'combat', ['ghoul']));
    const gold = session.current()!.gold;
    const published: (Ascent | null)[] = [];
    session.subscribe((ascent) => published.push(ascent));

    await playToTheEnd(session.battleSession(), clock);

    expect(published).toHaveLength(1);
    expect(session.current()!.gold).toBeGreaterThan(gold);
    expect(store.values.has(SHARD_TOTAL_KEY)).toBe(false);
  });

  it('stays on the battle while the Shards are written, and ends it only once', async () => {
    const store = mapStore();
    store.hold(SHARD_TOTAL_KEY);
    const { session, clock } = await loaded(store, BOSS_OF_TIER_1);
    const gold = session.current()!.gold;
    const published: (TierPassage | null)[] = [];
    session.subscribe((ascent) => published.push(ascent?.passage ?? null));
    const battleSession = session.battleSession();
    await playToTheEnd(battleSession, clock);

    // Le combat terminé est publié une deuxième fois pendant l'écriture.
    battleSession.dismissHint('hero');
    await flush();

    expect(session.current()).toMatchObject({ passage: null, encounter: { kind: 'boss' } });
    store.release(SHARD_TOTAL_KEY);
    await flush();
    expect(published).toEqual([{ to: 2, step: 'bossDefeated' }]);
    expect(session.shardTotal()).toBe(8);
    expect(session.current()!.gold).toBeGreaterThan(gold);
    expect(savedShards(store)).toMatchObject({ total: 8 });

    // Le même combat, terminé une fois de plus sur l'écran du boss vaincu, est ignoré.
    const shown = session.current();
    const saved = store.values.get(ASCENT_KEY);
    battleSession.dismissHint('hero');
    await flush();
    expect(session.current()).toBe(shown);
    expect(store.values.get(ASCENT_KEY)).toBe(saved);
    expect(published).toEqual([{ to: 2, step: 'bossDefeated' }]);
  });

  it('ignores a battle published again after the return to the tower foot', async () => {
    const store = mapStore();
    const { session, clock } = await loaded(store, ascentAt(1, 'combat', ['ghoul']));
    const battleSession = session.battleSession();
    await playToTheEnd(battleSession, clock);
    await flush();
    session.leave();
    const saved = store.values.get(ASCENT_KEY);

    expect(() => battleSession.dismissHint('hero')).not.toThrow();
    await flush();

    expect(session.current()).toBeNull();
    expect(store.values.get(ASCENT_KEY)).toBe(saved);
  });

  it('plays the next battle once the Shards are written', async () => {
    const store = mapStore();
    const { session, clock } = await beat(store, BOSS_OF_TIER_1);
    session.acknowledgeBossVictory();
    session.enterNextTier();
    const before = session.current()!;

    await playToTheEnd(session.battleSession(), clock);
    await flush();

    expect(before).toMatchObject({ tier: 2, floor: 1, encounter: { kind: 'combat' } });
    expect(session.current()).not.toBe(before);
    expect(session.current()!.encounter).toBeNull();
  });
});

describe('the keys of the Shard total (#38, ADR 0012)', () => {
  it('reads the total under "shards.total" and keeps an unreadable one under "shards.total.unreadable"', async () => {
    const store = mapStore();
    store.values.set('shards.total', '{oops');
    const { session } = setUp(store);

    await session.load();
    await flush();

    expect(store.values.get('shards.total.unreadable')).toBe('{oops');
    expect(JSON.parse(store.values.get('shards.total')!)).toMatchObject({ total: 0 });
  });

  it('never keeps aside nor writes again a readable Shard total', async () => {
    const store = mapStore();
    const stored = JSON.stringify({ version: 1, total: 22, seed: 1, awarded: [] });
    store.values.set('shards.total', stored);
    const { session } = setUp(store);

    await session.load();
    await flush();

    expect(session.shardTotal()).toBe(22);
    expect(store.values.has('shards.total.unreadable')).toBe(false);
    expect(store.values.get('shards.total')).toBe(stored);
  });

  it('starts from 0 when the total cannot be read, without keeping nor writing anything', async () => {
    const store = mapStore();
    const stored = JSON.stringify({ version: 1, total: 22, seed: 1, awarded: [] });
    store.values.set(SHARD_TOTAL_KEY, stored);
    store.failReads(SHARD_TOTAL_KEY);
    const { session } = setUp(store);

    await session.load();
    await flush();

    expect(session.shardTotal()).toBe(0);
    expect(store.values.has(UNREADABLE_SHARD_TOTAL_KEY)).toBe(false);
    expect(store.values.get(SHARD_TOTAL_KEY)).toBe(stored);
  });
});

describe('the Tier transition in the session (#38)', () => {
  it('saves the defeated boss screen and resumes on it, without a battle to resume', async () => {
    const store = mapStore();
    const { session } = await beat(store, BOSS_OF_TIER_1);
    session.pause();
    await flush();

    const reopened = setUp(store).session;
    const ascent = await reopened.load();

    expect(ascent?.passage).toEqual({ to: 2, step: 'bossDefeated' });
    expect(reopened.resuming()).toBe(false);
  });

  it('saves the transition screen to tier 2 and resumes on it', async () => {
    const store = mapStore();
    const { session } = await beat(store, BOSS_OF_TIER_1);

    session.acknowledgeBossVictory();
    await flush();

    expect(await setUp(store).session.load()).toMatchObject({
      passage: { to: 2, step: 'announce' },
    });
  });

  it('goes on at floor 1 of tier 2, saved, on an ordinary battle multiplied by the tier', async () => {
    const store = mapStore();
    const { session } = await beat(store, BOSS_OF_TIER_1);
    session.acknowledgeBossVictory();

    session.enterNextTier();
    await flush();
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(savedAscent(store)).toMatchObject({ tier: 2, floor: 1, passage: null });
    const { battle } = battleSession.current()!;
    expect(battle.tierMultiplier).toEqual({ hpPercent: 135, guardPercent: 125 });
  });

  it('multiplies an Elite by the Elite and boss multiplier of its tier (#244)', async () => {
    const store = mapStore();
    const { session } = await loaded(store, ascentAt(2, 'elite', ['scarecrow']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.tierMultiplier).toEqual(TIERS[2].eliteMultiplier);
    expect(battle.summonMultiplier).toEqual(TIERS[2].multiplier);
    // #257 : la colonne PV et dégâts des Élites à 80 % au palier 2 (190 → 152).
    expect(battle.enemies[0]).toMatchObject({ maxHp: 152, maxGuard: 70 });
  });

  it('multiplies a boss by the Elite and boss multiplier of its tier (#244)', async () => {
    const store = mapStore();
    const { session } = await loaded(store, ascentAt(3, 'boss', ['hourRinger']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.tierMultiplier).toEqual(TIERS[3].bossMultiplier);
    expect(battle.enemies[0]).toMatchObject({ maxHp: 650, maxGuard: 130 });
  });

  it.each([
    [1, 10],
    [2, 5],
    [3, 5],
  ] as const)('gives a battle of tier %i its respite of %i % (#244)', async (tier, percent) => {
    const { session } = await loaded(mapStore(), ascentAt(tier, 'combat', ['ghoul']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    expect(battleSession.current()!.battle.respitePercent).toBe(percent);
  });

  it('resumes an Elite battle of tier 3 saved before #244 with its values of before', async () => {
    // Écrit avant #244 : ni multiplicateur, ni répit, ni plafond, ni dernière Élite.
    const ascent = ascentAt(3, 'elite', ['firstPilgrim']);
    const before = battleOf(ascent, 200);
    expect(before).not.toHaveProperty('tierMultiplier');
    expect(before).not.toHaveProperty('respitePercent');
    const { session } = await loaded(mapStore(), ascent, before);
    const battleSession = session.battleSession();

    await battleSession.start();
    const { battle } = battleSession.current()!;
    expect(battle.enemies[0]).toMatchObject({ hp: 200, maxHp: 270, guard: 55, maxGuard: 55 });
    // Sans multiplicateur, les dégâts de ses coups restent ceux d'avant (100 %).
    expect(battle).not.toHaveProperty('tierMultiplier');
    expect(battle).not.toHaveProperty('respitePercent');
  });

  it('keeps the recorded guards of an ordinary battle saved before #244', async () => {
    const ascent = ascentAt(1, 'combat', ['ghoul', 'specter']);
    const started = battleOf(ascent, 30);
    const before: Battle = {
      ...started,
      enemies: [{ ...started.enemies[0]!, guard: 9, maxGuard: 15 }],
    };
    const { session } = await loaded(mapStore(), ascent, before);
    const battleSession = session.battleSession();

    await battleSession.start();

    expect(battleSession.current()!.battle.enemies[0]).toMatchObject({ guard: 9, maxGuard: 15 });
  });

  it('saves the perfect parry heals of the battle, and reads them back (#244, R4)', async () => {
    const store = mapStore();
    const ascent = ascentAt(2, 'combat', ['thornPilgrim']);
    const started = battleOf(ascent, 30);
    const healed: Battle = { ...started, hero: { ...started.hero, parryHealed: 7 } };
    const { session } = await loaded(store, ascent, healed);
    const battleSession = session.battleSession();
    await battleSession.start();
    session.pause();
    await flush();

    const again = setUp(store).session;
    await again.load();
    const resumed = again.battleSession();
    await resumed.start();

    expect(resumed.current()!.battle.hero.parryHealed).toBe(7);
  });

  it('plays the Common Momentum blessing at floor 1 of tier 1 only, not at floor 1 of tier 2', async () => {
    const momentumAt = async (tier: 1 | 2, floor = 1) => {
      const ascent: Ascent = {
        ...ascentAt(tier, 'combat', ['ghoul']),
        floor,
        blessings: [{ family: 'momentum', rarity: 'common' }],
      };
      const { session } = await loaded(mapStore(), ascent, null);
      const battleSession = session.battleSession();
      await battleSession.start();
      return battleSession.current()!.battle.modifiers?.startingMomentum;
    };

    expect(await momentumAt(1)).toBe(1);
    expect(await momentumAt(2)).toBe(0);
    expect(await momentumAt(1, 2)).toBe(0);
  });

  it('reads an ascent saved before #38 at tier 1, without Shards nor transition', async () => {
    const store = mapStore();
    const { tier: _, shardAwards: __, passage: ___, ...before } = startAscent(7);
    store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: before, battle: null }));

    const ascent = await setUp(store).session.load();

    expect(ascent).toMatchObject({ tier: 1, shardAwards: [], passage: null });
  });

  it('ignores the transition without an ascent', () => {
    const { session } = setUp();

    session.acknowledgeBossVictory();
    session.enterNextTier();

    expect(session.current()).toBeNull();
  });
});

describe('the enemies of tier 2 in a resumed ascent (#213)', () => {
  it('keeps the Ghoul of a floor battle already drawn, and draws none in the next battle', async () => {
    const store = mapStore();
    const { session, clock } = await loaded(
      store,
      ascentAt(2, 'combat', ['ghoul', 'thornPilgrim']),
    );
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(session.current()!.encounter!.enemies).toEqual(['ghoul', 'thornPilgrim']);
    expect(battleSession.current()!.battle.enemies.map(({ kind }) => kind)).toEqual(['ghoul']);

    await playToTheEnd(battleSession, clock);
    await flush();
    for (let guard = 0; guard < 20 && session.current()!.encounter === null; guard += 1) {
      const ascent = session.current()!;
      if (ascent.blessingOffer !== null) session.chooseBlessing(0);
      else if (ascent.boonOffer !== null) session.chooseBoon(0);
      else if (ascent.foundItem !== null) session.leaveItem();
      else
        session.chooseExit(
          Math.max(
            0,
            ascent.exits.findIndex(({ kind }) => kind === 'combat'),
          ),
        );
      await flush();
    }
    const next = session.current()!.encounter!;

    expect(next.kind).toBe('combat');
    expect(next.enemies).not.toContain('ghoul');
    expect(next.enemies).not.toContain('madVillager');
  });
});

describe('the enemies of tier 3 in a resumed ascent (#214)', () => {
  it('keeps the Skeleton of a floor battle already drawn, and draws none in the next battle', async () => {
    const store = mapStore();
    const ascent = ascentAt(3, 'combat', ['skeleton', 'bronzeWarden']);
    // Le combat sauvegardé de son seul Squelette, à 1 PV, sa relève déjà faite : il tombe pour de bon.
    const { battle } = startBattle({ seed: 3, defenseHint: false, at: 0, enemies: ['skeleton'] });
    const skeleton = { ...battle.enemies[0]!, hp: 1, selfRevives: 1, raised: true };
    const { session, clock } = await loaded(store, ascent, { ...battle, enemies: [skeleton] });
    const battleSession = session.battleSession();
    await battleSession.start();

    expect(session.current()!.encounter!.enemies).toEqual(['skeleton', 'bronzeWarden']);
    expect(battleSession.current()!.battle.enemies.map(({ kind }) => kind)).toEqual(['skeleton']);

    await playToTheEnd(battleSession, clock);
    await flush();
    for (let guard = 0; guard < 20 && session.current()!.encounter === null; guard += 1) {
      const ascent = session.current()!;
      if (ascent.blessingOffer !== null) session.chooseBlessing(0);
      else if (ascent.boonOffer !== null) session.chooseBoon(0);
      else if (ascent.foundItem !== null) session.leaveItem();
      else
        session.chooseExit(
          Math.max(
            0,
            ascent.exits.findIndex(({ kind }) => kind === 'combat'),
          ),
        );
      await flush();
    }
    const next = session.current()!;

    expect(next).toMatchObject({ tier: 3, floor: 4 });
    expect(next.encounter!.kind).toBe('combat');
    for (const kind of ['skeleton', 'specter', 'necromancer', 'mothkin']) {
      expect(next.encounter!.enemies).not.toContain(kind);
    }
  });
});

describe('the escorted Elite in the session (#257)', () => {
  it('starts an Elite of tier 2 at 80 / 140 %, its escort at the multiplier of the tier', async () => {
    const ascent = ascentAt(2, 'elite', ['scarecrow', 'mothkin']);
    const { session } = await loaded(mapStore(), ascent, null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.tierMultiplier).toEqual({ hpPercent: 80, guardPercent: 140 });
    expect(battle.escortMultiplier).toEqual({ hpPercent: 135, guardPercent: 125 });
    expect(battle.summonMultiplier).toEqual(TIERS[2].multiplier);
    expect(battle.enemies.map(({ kind, maxHp, escort }) => ({ kind, maxHp, escort }))).toEqual([
      { kind: 'scarecrow', maxHp: 152, escort: undefined },
      { kind: 'mothkin', maxHp: 33, escort: true },
    ]);
  });

  it('starts the Bramble mother of tier 2 escorted, at 80 / 140 %: 136 HP, guard 63 (#259)', async () => {
    const ascent = ascentAt(2, 'elite', ['brambleMother', 'ashBramble']);
    const { session } = await loaded(mapStore(), ascent, null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.tierMultiplier).toEqual(TIERS[2].eliteMultiplier);
    expect(battle.escortMultiplier).toEqual(TIERS[2].multiplier);
    expect(
      battle.enemies.map(({ kind, maxHp, maxGuard, escort }) => ({
        kind,
        maxHp,
        maxGuard,
        escort,
      })),
    ).toEqual([
      { kind: 'brambleMother', maxHp: 136, maxGuard: 63, escort: undefined },
      { kind: 'ashBramble', maxHp: 40, maxGuard: 25, escort: true },
    ]);
  });

  it('starts the Beadle of tier 3 escorted, at 88 / 150 %: 167 HP, guard 96 (#259)', async () => {
    const ascent = ascentAt(3, 'elite', ['beadle', 'bellNovice', 'clockJack']);
    const { session } = await loaded(mapStore(), ascent, null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle.enemies.map(({ kind, maxHp, maxGuard }) => [kind, maxHp, maxGuard])[0]).toEqual([
      'beadle',
      167,
      96,
    ]);
    expect(battle.enemies.slice(1).every((enemy) => enemy.escort === true)).toBe(true);
  });

  it('starts an Elite of tier 1 alone, without escort multiplier', async () => {
    const { session } = await loaded(mapStore(), ascentAt(1, 'elite', ['twins']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle).not.toHaveProperty('escortMultiplier');
    expect(battle.enemies[0]).toMatchObject({ kind: 'twins', maxHp: 160 });
  });

  it('starts an Elite drawn before #257 alone, at the values of today: 237 HP at tier 3', async () => {
    // La rencontre tirée avant la mise à jour, le combat pas encore commencé (décision 3).
    const { session } = await loaded(mapStore(), ascentAt(3, 'elite', ['firstPilgrim']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    const { battle } = battleSession.current()!;
    expect(battle).not.toHaveProperty('escortMultiplier');
    expect(battle.enemies).toHaveLength(1);
    expect(battle.enemies[0]).toMatchObject({ kind: 'firstPilgrim', maxHp: 237, maxGuard: 82 });
  });

  it('resumes an Elite battle of tier 3 saved before #257 without escort, its strikes at 135 %', async () => {
    const saved = JSON.parse(ELITE_BATTLE_BEFORE_257) as Battle;
    const set = await loaded(mapStore(), ascentAt(3, 'elite', ['firstPilgrim']), saved);
    const battleSession = set.session.battleSession();

    await battleSession.start();
    const resumed = battleSession.current()!.battle;
    expect(resumed.enemies).toEqual(saved.enemies);
    expect(resumed.tierMultiplier).toEqual({ hpPercent: 135, guardPercent: 150 });
    expect(resumed).not.toHaveProperty('escortMultiplier');

    // La manche suivante tire ses coups à 135 %, jamais à 88 %.
    const damages = new Set<number>();
    for (let guard = 0; guard < 200 && damages.size === 0; guard += 1) {
      const battle = battleSession.current()!.battle;
      if (battle.round > 2) {
        const intent = battle.enemies[0]!.intent;
        if (intent?.category === 'attack') damages.add(intent.damage);
      }
      if (battle.phase.kind === 'hero') {
        const at = set.clock.now() + 50;
        set.clock.advanceTo(at);
        battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        set.clock.advanceTo(set.clock.pending()[0]!);
      }
      await flush();
    }
    const at135 = ENEMIES.firstPilgrim.moves.map(({ damage }) => scaleByPercent(damage, 135));
    expect(damages.size).toBe(1);
    expect(at135).toContain([...damages][0]);
  });

  it('gives an escorted Elite won at tier 3 the rewards of a lone Elite, the escort no Gold', async () => {
    const afterVictory = async (enemies: readonly EnemyKind[]) => {
      const ascent = ascentAt(3, 'elite', enemies);
      const { battle } = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        heroHp: 70,
        enemies,
        tierMultiplier: TIERS[3].eliteMultiplier,
        ...(enemies.length > 1 && { escortMultiplier: TIERS[3].multiplier }),
      });
      // L'escorte déjà tombée, l'Élite à 1 PV : le même combat que l'Élite seule.
      const ending = {
        ...battle,
        enemies: battle.enemies.map((enemy, index) => ({ ...enemy, hp: index === 0 ? 1 : 0 })),
      };
      const store = mapStore();
      const set = await loaded(store, ascent, ending);
      await playToTheEnd(set.session.battleSession(), set.clock);
      await flush();
      return set.session.current()!;
    };

    const escorted = await afterVictory(['firstPilgrim', 'bellNovice', 'clockJack']);
    const alone = await afterVictory(['firstPilgrim']);

    expect(escorted.lastGold).toBe(37);
    expect(escorted.sealedChest).not.toBeNull();
    expect(escorted.shardAwards).toContainEqual({ id: '3:3:3:elite', amount: 2 });
    expect(escorted).toEqual(alone);
  });
});

describe('the bag of Elites and the Gravedigger in the session (#258)', () => {
  /** Une ascension entre deux étages du palier 1, la porte Élite seule proposée. */
  const atEliteDoor = (ascent: Ascent): Ascent => ({
    ...ascent,
    encounter: null,
    boonOffer: null,
    exits: [{ kind: 'elite', groupSize: null }],
  });

  /** La sauvegarde écrite à la main, comme avant #258 : `lastElite`, sans `facedElites`. */
  function savedBefore258(lastElite: EnemyKind, faced?: readonly EnemyKind[]): string {
    const { facedElites: _, ...ascent } = atEliteDoor({ ...startAscent(3), floor: 3 });
    return JSON.stringify({
      version: 1,
      ascent: { ...ascent, lastElite, ...(faced && { facedElites: faced }) },
      battle: null,
    });
  }

  it('reads the last Elite of a save before #258 as the faced Elites: the door draws among the others', async () => {
    const store = mapStore();
    store.values.set(ASCENT_KEY, savedBefore258('twins'));
    const { session } = setUp(store);
    const loadedAscent = (await session.load())!;

    expect(loadedAscent.facedElites).toEqual(['twins']);
    expect(loadedAscent).not.toHaveProperty('lastElite');

    session.chooseExit(0);
    const entered = session.current()!;
    const expected = drawElite(eliteCandidates(TIERS[1].elites, ['twins']), loadedAscent.random);
    expect(entered.encounter!.enemies[0]).toBe(expected.value);
    expect(['fallenKnight', 'gravedigger']).toContain(entered.encounter!.enemies[0]);
    expect(entered.facedElites).toEqual(['twins', expected.value]);
    await flush();
    expect(savedAscent(store)).not.toHaveProperty('lastElite');
    expect(savedAscent(store).facedElites).toEqual(['twins', expected.value]);
  });

  it('keeps the faced Elites when a save has both keys', async () => {
    const store = mapStore();
    store.values.set(ASCENT_KEY, savedBefore258('twins', ['gravedigger', 'fallenKnight']));
    const { session } = setUp(store);
    const loadedAscent = (await session.load())!;

    expect(loadedAscent.facedElites).toEqual(['gravedigger', 'fallenKnight']);
    expect(loadedAscent).not.toHaveProperty('lastElite');
  });

  it('reads a save without any Elite faced as before', async () => {
    const store = mapStore();
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: atEliteDoor(startAscent(3)), battle: null }),
    );
    const { session } = setUp(store);

    expect(await session.load()).not.toHaveProperty('facedElites');
  });

  it('saves the battle as soon as the Gravedigger exhumes a Skeleton', async () => {
    const ascent = ascentAt(1, 'elite', ['gravedigger']);
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['gravedigger'],
      ...encounterMultipliers(1, { kind: 'elite', enemies: ['gravedigger'] }),
    });
    // La manche 2 commence : il montre Exhumer, le héros (Initiative 5) a déjà agi.
    const exhuming: Battle = {
      ...battle,
      round: 2,
      enemies: [{ ...battle.enemies[0]!, intent: { category: 'exhume', slot: 1 } }],
      turn: { order: ['hero', 0], position: 1 },
      lastPlayed: 'hero',
      phase: { kind: 'transition', since: 0, until: 800, to: 'enemy' },
    };
    const store = mapStore();
    const { session, clock } = await loaded(store, ascent, exhuming);
    const battleSession = session.battleSession();
    await battleSession.start();
    for (let guard = 0; guard < 20; guard += 1) {
      if (battleSession.current()!.battle.enemies.length > 1) break;
      clock.advanceTo(clock.pending()[0]!);
      await flush();
    }
    await flush();

    const saved = JSON.parse(store.values.get(ASCENT_KEY)!) as { battle: Battle };
    expect(saved.battle.enemies[1]).toMatchObject({ kind: 'skeleton', exhumed: true });
  });
});
