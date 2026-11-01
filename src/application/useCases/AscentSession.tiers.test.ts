// La session d'ascension sur trois paliers (#38, ADR 0012) : le Total d'Éclats crédité et sauvegardé
// avant l'écran qui suit la victoire, jamais deux fois, gardé après une chute ou un abandon ; le
// Passage de palier sauvegardé et repris ; le multiplicateur de palier des seuls combats ordinaires.
import {
  startAscent,
  type Ascent,
  type Encounter,
  type TierPassage,
} from '../../domain/ascent/Ascent';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import type { EnemyKind } from '../../domain/battle/combatants';
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

/** Un stockage en mémoire ; `hold` retient l'écriture d'une clé jusqu'à `release`. */
function mapStore() {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  const held = new Map<string, () => void>();
  const failing = new Map<string, number>();
  return {
    values,
    hold: (key: string) => held.set(key, () => undefined),
    release: (key: string) => {
      const resume = held.get(key);
      held.delete(key);
      resume?.();
    },
    failTimes: (key: string, times: number) => failing.set(key, times),
    get: async (key: string) => values.get(key) ?? null,
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

  it('never multiplies an Elite nor a boss', async () => {
    const store = mapStore();
    const { session } = await loaded(store, ascentAt(2, 'elite', ['scarecrow']), null);
    const battleSession = session.battleSession();

    await battleSession.start();

    expect(battleSession.current()!.battle.tierMultiplier).toBeUndefined();
    expect(battleSession.current()!.battle.enemies[0]).toMatchObject({ maxHp: 190, maxGuard: 35 });
  });

  it('plays the Common Momentum blessing at floor 1 of tier 1 only, not at floor 1 of tier 2', async () => {
    const momentumAt = async (tier: 1 | 2) => {
      const ascent: Ascent = {
        ...ascentAt(tier, 'combat', ['ghoul']),
        floor: 1,
        blessings: [{ family: 'momentum', rarity: 'common' }],
      };
      const { session } = await loaded(mapStore(), ascent, null);
      const battleSession = session.battleSession();
      await battleSession.start();
      return battleSession.current()!.battle.modifiers?.startingMomentum;
    };

    expect(await momentumAt(1)).toBe(1);
    expect(await momentumAt(2)).toBe(0);
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
