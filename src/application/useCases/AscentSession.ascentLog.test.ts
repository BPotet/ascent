// La session d'ascension avec le Journal d'ascension (#196, ADR 0014) : le journal observe chaque
// transition, s'écrit par sa propre file juste après la sauvegarde de l'ascension, reprend après une
// fermeture sans doublon d'étage, et ne bloque jamais ni la sauvegarde ni le Total d'Éclats.
import { endFloorBattle, startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { beginAscentLog, type AscentLog } from '../../domain/ascentLog/AscentLog';
import { startBattle } from '../../domain/battle/Battle';
import { Day } from '../../domain/day/Day';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { memoryAscentLogStore, type MemoryAscentLogStore } from '../testing/memoryAscentLogStore';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import { settableClock } from '../testing/settableClock';
import { AscentLogRecorder } from './AscentLogRecorder';
import { ASCENT_KEY, AscentSession, SHARD_TOTAL_KEY } from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import type { BattleSession } from './BattleSession';

function keyValues() {
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

type KeyValues = ReturnType<typeof keyValues>;

function setUp(
  values: KeyValues = keyValues(),
  logs: MemoryAscentLogStore = memoryAscentLogStore(),
) {
  const clock = new ManualBattleClock(1_000);
  const ascentLog = new AscentLogRecorder({
    store: logs,
    clock: settableClock(Day.of(2026, 11, 3)),
  });
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(7),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: values,
    ascentLog,
  });
  return { values, logs, clock, ascentLog, session };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

async function playToTheEnd(battleSession: BattleSession, clock: ManualBattleClock) {
  await battleSession.start();
  for (let guard = 0; guard < 300; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'over') {
      await flush();
      return;
    }
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

const lastLog = (logs: MemoryAscentLogStore): AscentLog =>
  JSON.parse([...logs.logs.values()].at(-1)!) as AscentLog;

describe('AscentSession with the ascent log', () => {
  it('starts the log with the ascent, and records each choice at its save', async () => {
    const { logs, session, ascentLog } = setUp();
    session.begin({ hero: 'sentinel', gauge: 1, blessings: ['rare'] });
    await ascentLog.settled();
    expect(lastLog(logs)).toMatchObject({ id: 1, ascentSeed: 7, gauge: 'favor', blessings: [] });
    session.chooseBlessing(0);
    await ascentLog.settled();
    expect(lastLog(logs).blessings).toEqual([
      expect.objectContaining({ chosen: expect.objectContaining({ rarity: 'rare' }) }),
    ]);
  });

  it('records the fall with the floor battle, at the start and at the end of a fresh battle', async () => {
    const begun = startAscent(7);
    const weak: Ascent = { ...begun, hero: { ...begun.hero, hp: 1 } };
    const values = keyValues();
    const logs = memoryAscentLogStore([
      JSON.stringify({ ...beginAscentLog(weak, Day.of(2026, 11, 3)), id: 1 }),
    ]);
    // Une ascension sauvegardée sans combat : le combat de l'étage est neuf.
    values.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: weak, battle: null }));
    const { session, clock, ascentLog } = setUp(values, logs);
    await session.load();
    await playToTheEnd(session.battleSession(), clock);
    await ascentLog.settled();
    expect(session.current()?.outcome).toBe('fall');
    const log = lastLog(logs);
    expect(log.floors).toHaveLength(1);
    expect(log.floors[0]).toMatchObject({
      entry: { hp: 1, momentum: expect.any(Number) },
      exit: { hp: 0, momentum: expect.any(Number) },
    });
    expect(log.end).toEqual({
      kind: 'fall',
      tier: 1,
      floor: 1,
      encounter: { kind: 'combat', enemies: weak.encounter!.enemies },
    });
  });

  it('writes the log once during a battle: its entry HP and Momentum, then nothing until its end', async () => {
    const { logs, session, clock, ascentLog } = setUp();
    session.begin();
    await ascentLog.settled();
    const battle = session.battleSession();
    await battle.start();
    for (let action = 0; action < 2; action += 1) {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battle.heroAction({ kind: 'attack' }, at - 20, at);
      await flush();
    }
    session.pause();
    await ascentLog.settled();
    expect(logs.writes).toHaveLength(2);
    expect(logs.writes[1]!.floors[0]!.entry.momentum).toEqual(expect.any(Number));
  });

  describe('records each transition through the session', () => {
    /** La session reprend `ascent` (avec `battle`), et son journal commencé à cet étage. */
    async function resumed(ascent: Ascent, battle: unknown = null) {
      const values = keyValues();
      values.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
      const logs = memoryAscentLogStore([
        JSON.stringify({ ...beginAscentLog(ascent, Day.of(2026, 11, 3)), id: 1 }),
      ]);
      const story = setUp(values, logs);
      await story.session.load();
      return story;
    }

    const won = (ascent: Ascent) => endFloorBattle(ascent, { outcome: 'victory', heroHp: 40 });

    it.each([
      ['equipped', (session: AscentSession) => session.equipItem()],
      ['left', (session: AscentSession) => session.leaveItem()],
    ] as const)('records an item %s', async (outcome, act) => {
      const { session, logs, ascentLog } = await resumed({
        ...won(startAscent(7)),
        boonOffer: null,
        foundItem: 'axe',
      });
      act(session);
      await ascentLog.settled();
      expect(lastLog(logs).floors[0]!.itemOutcome).toBe(outcome);
    });

    it('records the boon chosen', async () => {
      const { session, logs, ascentLog } = await resumed({
        ...won(startAscent(7)),
        boonOffer: ['frostSkin', 'trueEdge'],
      });
      session.chooseBoon(1);
      await ascentLog.settled();
      expect(lastLog(logs).floors[0]!.boonChosen).toBe('trueEdge');
    });

    it('records the exit chosen and the floor it leads to', async () => {
      const ascent: Ascent = { ...won(startAscent(7)), boonOffer: null };
      const { session, logs, ascentLog } = await resumed(ascent);
      session.chooseExit(0);
      await ascentLog.settled();
      expect(lastLog(logs).floors.map((floor) => floor.floor)).toEqual([1, 2]);
      expect(lastLog(logs).floors[1]).toMatchObject({
        exitsOffered: ascent.exits,
        exitTaken: { kind: ascent.exits[0]!.kind },
      });
    });

    it('records nothing at the boss defeated screen, then the tier passage', async () => {
      const boss: Ascent = {
        ...startAscent(7),
        floor: 6,
        encounter: null,
        passage: { to: 2, step: 'bossDefeated' },
      };
      const { session, logs, ascentLog } = await resumed(boss);
      session.acknowledgeBossVictory();
      await ascentLog.settled();
      expect(logs.writes).toEqual([]);
      session.enterNextTier();
      await ascentLog.settled();
      expect(lastLog(logs).tierPassages).toEqual([
        { from: 1, to: 2, heroHp: session.current()!.hero.hp },
      ]);
      expect(lastLog(logs).floors.at(-1)).toMatchObject({ tier: 2, floor: 1, exitTaken: null });
    });

    it('ends the log on the Summit', async () => {
      const ascent: Ascent = {
        ...startAscent(7),
        tier: 3,
        floor: 6,
        encounter: { kind: 'boss', enemies: ['hourRinger'], battleSeed: 3 },
      };
      const { battle } = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        heroHp: 50,
        enemies: ['hourRinger'],
      });
      const nearlyWon = { ...battle, enemies: [{ ...battle.enemies[0]!, hp: 1 }], reserve: [] };
      const { session, logs, clock, ascentLog } = await resumed(ascent, nearlyWon);
      await playToTheEnd(session.battleSession(), clock);
      await flush();
      await ascentLog.settled();
      expect(session.current()?.outcome).toBe('victory');
      expect(lastLog(logs)).toMatchObject({
        status: 'ended',
        end: { kind: 'summit', tier: 3, floor: 6 },
      });
    });
  });

  it('records an abandon, distinct from a fall', async () => {
    const { logs, session, ascentLog } = setUp();
    session.begin();
    session.abandon();
    await ascentLog.settled();
    expect(lastLog(logs).end).toEqual({ kind: 'abandon', tier: 1, floor: 1 });
  });

  it('resumes the log after the app is closed, and keeps writing it', async () => {
    const first = setUp();
    first.session.begin();
    await first.ascentLog.settled();
    const second = setUp(first.values, first.logs);
    await second.session.load();
    second.session.abandon();
    await second.ascentLog.settled();
    expect(first.logs.logs.size).toBe(1);
    expect(lastLog(first.logs)).toMatchObject({ id: 1, status: 'ended', floors: [{ floor: 1 }] });
  });

  it('never blocks the save of the ascent nor the Shard total on a log write', async () => {
    const { values, logs } = setUp();
    logs.hold();
    const ascent: Ascent = {
      ...startAscent(7),
      floor: 3,
      encounter: { kind: 'elite', enemies: ['fallenKnight'], battleSeed: 3 },
    };
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 50,
      enemies: ascent.encounter!.enemies,
    });
    values.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent,
        battle: { ...battle, enemies: [{ ...battle.enemies[0]!, hp: 1 }] },
      }),
    );
    const again = setUp(values, logs);
    await again.session.load();
    await playToTheEnd(again.session.battleSession(), again.clock);
    await flush();
    expect(JSON.parse(values.values.get(SHARD_TOTAL_KEY)!)).toMatchObject({ total: 2 });
    expect(JSON.parse(values.values.get(ASCENT_KEY)!)).toMatchObject({
      ascent: { floor: 3, encounter: null },
    });
  });
});
