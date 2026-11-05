import {
  abandonAscent,
  chooseBlessing,
  chooseExit,
  endFloorBattle,
  startAscent,
} from '../../domain/ascent/Ascent';
import { Day } from '../../domain/day/Day';
import {
  beginAscentLog,
  recordAscentStep,
  recordBattlePlace,
  type AscentLogV1,
} from '../../domain/ascentLog/AscentLog';
import { beginBattleLog, type BattlePlace } from '../../domain/ascentLog/BattleLog';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { memoryAscentLogStore } from '../testing/memoryAscentLogStore';
import { settableClock } from '../testing/settableClock';
import { AscentLogRecorder } from './AscentLogRecorder';

const DAY = Day.of(2026, 11, 3);
const launch = { gauge: 1 as const, blessings: ['rare' as const, 'common' as const] };

function setUp(initial: readonly string[] = []) {
  const store = memoryAscentLogStore(initial);
  const recorder = new AscentLogRecorder({ store, clock: settableClock(DAY) });
  return { store, recorder };
}

describe('AscentLogRecorder', () => {
  it('starts the log of a new ascent, then saves it under its id', async () => {
    const { store, recorder } = setUp();
    const ascent = startAscent(5, launch);
    recorder.begin(ascent);
    recorder.flush();
    await recorder.settled();
    expect(store.writes.map((log) => log.id)).toEqual([1]);
    const chosen = chooseBlessing(ascent, 0);
    recorder.record({ kind: 'blessingChosen', before: ascent, after: chosen });
    recorder.flush();
    await recorder.settled();
    expect(store.writes.map((log) => [log.id, log.blessings.length])).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(recorder.current()).toMatchObject({ id: 1, startedOn: '2026-11-03' });
  });

  it('writes nothing when the log has not changed', async () => {
    const { store, recorder } = setUp();
    recorder.flush();
    recorder.begin(startAscent(5));
    recorder.flush();
    await recorder.settled();
    recorder.flush();
    recorder.flush();
    await recorder.settled();
    expect(store.writes).toHaveLength(1);
  });

  it('keeps one write at a time and one pending: the last one wins', async () => {
    const { store, recorder } = setUp();
    const ascent = startAscent(5, launch);
    recorder.begin(ascent);
    store.hold();
    recorder.flush();
    const once = chooseBlessing(ascent, 0);
    recorder.record({ kind: 'blessingChosen', before: ascent, after: once });
    recorder.flush();
    recorder.record({ kind: 'blessingChosen', before: once, after: chooseBlessing(once, 0) });
    recorder.flush();
    store.release();
    await recorder.settled();
    expect(store.writes.map((log) => log.blessings.length)).toEqual([0, 2]);
    expect(store.logs.size).toBe(1);
  });

  it('writes the end of an ascent before the start of the next one', async () => {
    const { store, recorder } = setUp();
    const first = startAscent(5);
    recorder.begin(first);
    store.hold();
    recorder.flush();
    recorder.record({ kind: 'abandoned', before: first, after: abandonAscent(first) });
    recorder.flush();
    recorder.begin(startAscent(6));
    recorder.flush();
    store.release();
    await recorder.settled();
    expect(store.writes.map((log) => [log.ascentSeed, log.status])).toEqual([
      [5, 'inProgress'],
      [5, 'ended'],
      [6, 'inProgress'],
    ]);
    expect(store.writes.map((log) => log.id)).toEqual([1, 1, 2]);
  });

  it('swallows a failed write, and the next flush retries it', async () => {
    const { store, recorder } = setUp();
    recorder.begin(startAscent(5));
    store.failNext();
    recorder.flush();
    await recorder.settled();
    expect(store.logs.size).toBe(0);
    recorder.flush();
    await recorder.settled();
    expect(store.logs.size).toBe(1);
  });

  it('resumes the latest log of the same ascent, without a duplicate floor', async () => {
    const ascent = startAscent(5);
    const saved = { ...beginAscentLog(ascent, DAY), id: 1 };
    const { store, recorder } = setUp([JSON.stringify(saved)]);
    await recorder.resume(ascent);
    expect(recorder.current()).toEqual(saved);
    recorder.flush();
    await recorder.settled();
    expect(store.writes).toEqual([]);
    recorder.record({ kind: 'abandoned', before: ascent, after: abandonAscent(ascent) });
    recorder.flush();
    await recorder.settled();
    expect(store.writes.map((log) => [log.id, log.status, log.floors.length])).toEqual([
      [1, 'ended', 1],
    ]);
  });

  it('completes the missing current floor at the resume, without a duplicate floor', async () => {
    let ascent = startAscent(5);
    let log = beginAscentLog(ascent, DAY);
    // Le journal écrit jusqu'à l'étage 2 ; l'ascension sauvegardée à l'étage 3.
    for (const floor of [2, 3]) {
      const won = endFloorBattle(ascent, { outcome: 'victory', heroHp: 50 });
      const next = chooseExit({ ...won, boonOffer: null }, 0);
      if (floor === 2)
        log = recordAscentStep(log, { kind: 'exitChosen', before: won, after: next });
      ascent = next;
    }
    const { store, recorder } = setUp([JSON.stringify({ ...log, id: 1 })]);
    await recorder.resume(ascent);
    recorder.flush();
    await recorder.settled();
    expect(store.writes.map((each) => each.id)).toEqual([1]);
    expect(store.writes[0]!.floors.map((floor) => `${floor.tier}-${floor.floor}`)).toEqual([
      '1-1',
      '1-2',
      '1-3',
    ]);
    expect(store.logs.size).toBe(1);
  });

  it.each([
    ['no log', []],
    ['the log of another ascent', [JSON.stringify(beginAscentLog(startAscent(9), DAY))]],
    [
      'an ended log',
      [JSON.stringify({ ...beginAscentLog(startAscent(5), DAY), status: 'ended', id: 1 })],
    ],
    ['an unreadable log', ['{oops']],
  ])('keeps no log for an ascent resumed with %s', async (_, initial) => {
    const { recorder } = setUp(initial);
    await recorder.resume(startAscent(5));
    expect(recorder.current()).toBeNull();
  });

  it('keeps no log when the store cannot be read at the resume', async () => {
    const { store, recorder } = setUp();
    store.latest = () => Promise.reject(new Error('The store failed'));
    await recorder.resume(startAscent(5));
    expect(recorder.current()).toBeNull();
    recorder.record({
      kind: 'abandoned',
      before: startAscent(5),
      after: abandonAscent(startAscent(5)),
    });
    expect(recorder.current()).toBeNull();
  });

  it('tells whether the log of an ascent in progress is kept', () => {
    const { recorder } = setUp();
    expect(recorder.inProgress()).toBe(false);
    const ascent = startAscent(5);
    recorder.begin(ascent);
    expect(recorder.inProgress()).toBe(true);
    recorder.record({ kind: 'abandoned', before: ascent, after: abandonAscent(ascent) });
    expect(recorder.inProgress()).toBe(false);
  });

  describe('the battles (#197)', () => {
    const PLACE: BattlePlace = { tier: 1, floor: 1, encounterKind: 'combat' };
    const battle: Battle = startBattle({
      seed: 3,
      defenseHint: false,
      at: 1_000,
      enemies: ['ghoul'],
    }).battle;
    const momentum = (at: number, value: number): BattleEvent => ({
      type: 'momentumChanged',
      at,
      momentum: value,
    });
    const round = (at: number, number: number): BattleEvent => ({
      type: 'roundStarted',
      at,
      round: number,
      intents: [null],
    });

    /** Une ascension commencée, son journal écrit, et le combat de l'étage commencé. */
    async function fighting() {
      const story = setUp();
      const ascent = startAscent(5);
      story.recorder.begin(ascent);
      story.recorder.flush();
      await story.recorder.settled();
      story.recorder.beginBattle(PLACE, battle, 1_000);
      story.recorder.recordBattle(battle, [round(1_000, 1)]);
      return { ...story, ascent };
    }

    it('lists the battle in the log, and writes it only after the log has its id', async () => {
      const { store, recorder } = setUp();
      recorder.begin(startAscent(5));
      recorder.beginBattle(PLACE, battle, 1_000);
      store.hold();
      recorder.flush();
      store.release();
      await recorder.settled();
      expect(store.writes.map((log) => log.formatVersion === 2 && log.battles)).toEqual([
        [{ tier: 1, floor: 1 }],
      ]);
      expect(store.battleWrites.map(({ logId, battle: each }) => [logId, each.floor])).toEqual([
        [1, 1],
      ]);
    });

    it('never writes a battle while its log has no id: the next flush writes both', async () => {
      const { store, recorder } = setUp();
      recorder.begin(startAscent(5));
      recorder.beginBattle(PLACE, battle, 1_000);
      store.failNext();
      recorder.flush();
      await recorder.settled();
      expect(store.battleWrites).toEqual([]);
      recorder.flush();
      await recorder.settled();
      expect(store.writes).toHaveLength(1);
      expect(store.battleWrites).toHaveLength(1);
    });

    it('groups the writes: one at a time, one pending, and the last battle wins', async () => {
      const { store, recorder } = await fighting();
      store.hold();
      recorder.flush();
      recorder.recordBattle(battle, [momentum(1_100, 2)]);
      recorder.flush();
      recorder.recordBattle(battle, [momentum(1_200, 3)]);
      recorder.flush();
      store.release();
      await recorder.settled();
      expect(store.battleWrites.map(({ battle: each }) => each.rounds[0]!.effects.length)).toEqual([
        0, 2,
      ]);
    });

    it('never loses the end of a battle when the next one starts behind it', async () => {
      const { store, recorder } = await fighting();
      store.hold();
      recorder.flush();
      recorder.recordBattle(battle, [{ type: 'battleEnded', at: 1_500, outcome: 'victory' }]);
      recorder.flush();
      recorder.beginBattle({ ...PLACE, floor: 2 }, battle, 2_000);
      recorder.flush();
      store.release();
      await recorder.settled();
      expect(store.battleWrites.map(({ battle: each }) => [each.floor, each.status])).toEqual([
        [1, 'inProgress'],
        [1, 'won'],
        [2, 'inProgress'],
      ]);
    });

    it('swallows a failed battle write, and the next flush retries it', async () => {
      const { store, recorder } = await fighting();
      store.failNext();
      recorder.flush();
      await recorder.settled();
      expect(store.battles.size).toBe(0);
      recorder.flush();
      await recorder.settled();
      expect(store.battles.size).toBe(1);
    });

    it('serializes nothing while the battle is recorded and flushed: only after an await', async () => {
      const { store, recorder } = await fighting();
      const stringify = jest.spyOn(JSON, 'stringify');
      try {
        recorder.recordBattle(battle, [momentum(1_100, 2)]);
        recorder.flush();
        expect(stringify).not.toHaveBeenCalled();
        expect(store.battleWrites).toEqual([]);
        await recorder.settled();
        expect(stringify).toHaveBeenCalled();
        expect(store.battleWrites).toHaveLength(1);
      } finally {
        stringify.mockRestore();
      }
    });

    it('notes a pause and its resume, and only the battle in progress', async () => {
      const { recorder } = await fighting();
      recorder.pauseBattle(6_000);
      recorder.resumeBattle(36_000);
      recorder.recordBattle(battle, [round(40_000, 2)]);
      expect(recorder.currentBattle()).toMatchObject({
        resumes: [{ t: 5_000, cause: 'pause' }],
        rounds: [{ durationMs: 9_000 }, { t: 9_000 }],
      });
      const { recorder: idle } = setUp();
      idle.recordBattle(battle, [round(1_000, 1)]);
      idle.pauseBattle(2_000);
      idle.resumeBattle(3_000);
      expect(idle.currentBattle()).toBeNull();
    });

    it('begins no battle without a log in progress', () => {
      const { recorder } = setUp();
      recorder.beginBattle(PLACE, battle, 1_000);
      expect(recorder.currentBattle()).toBeNull();
      const ascent = startAscent(5);
      recorder.begin(ascent);
      recorder.record({ kind: 'abandoned', before: ascent, after: abandonAscent(ascent) });
      recorder.beginBattle(PLACE, battle, 1_000);
      expect(recorder.currentBattle()).toBeNull();
    });

    /** Le journal écrit avec son combat en cours, comme avant une fermeture forcée. */
    function closedDuringBattle() {
      const ascent = startAscent(5);
      const log = { ...recordBattlePlace(beginAscentLog(ascent, DAY), PLACE), id: 1 };
      const written = beginBattleLog(PLACE, battle, 1_000);
      const story = setUp([JSON.stringify(log)]);
      story.store.battles.set('1:1-1', JSON.stringify(written));
      return { ...story, ascent, written };
    }

    it('reads back the battle in progress at the resume, then notes the resume as a reopening', async () => {
      const { recorder, ascent, written } = closedDuringBattle();
      await recorder.resume(ascent);
      await recorder.settled();
      expect(recorder.currentBattle()).toEqual(written);
      recorder.resumeBattle(50);
      recorder.pauseBattle(80);
      recorder.resumeBattle(90);
      expect(recorder.currentBattle()!.resumes).toEqual([
        { t: 0, cause: 'reopen' },
        { t: 30, cause: 'pause' },
      ]);
    });

    it('never waits for the battle at the resume, and catches up with it once read', async () => {
      const { store, recorder, ascent } = closedDuringBattle();
      let answer: () => void = () => undefined;
      const read = store.readBattles;
      store.readBattles = (...args) =>
        new Promise((resolve) => {
          answer = () => resolve(read(...args));
        });
      await recorder.resume(ascent);
      expect(recorder.currentBattle()).toBeNull();
      recorder.resumeBattle(50);
      recorder.recordBattle(battle, [round(60, 2)]);
      answer();
      await recorder.settled();
      expect(recorder.currentBattle()).toMatchObject({
        resumes: [{ t: 0, cause: 'reopen' }],
        rounds: [{ round: 2, t: 10 }],
      });
    });

    it('keeps no battle when the battle in progress cannot be read', async () => {
      const { store, recorder, ascent } = closedDuringBattle();
      store.readBattles = () => Promise.reject(new Error('The store failed'));
      await recorder.resume(ascent);
      recorder.resumeBattle(50);
      await recorder.settled();
      expect(recorder.currentBattle()).toBeNull();
    });

    it('forgets the battle being read when a new battle begins', async () => {
      const { store, recorder, ascent } = closedDuringBattle();
      let answer: () => void = () => undefined;
      const read = store.readBattles;
      store.readBattles = (...args) =>
        new Promise((resolve) => {
          answer = () => resolve(read(...args));
        });
      await recorder.resume(ascent);
      recorder.beginBattle(PLACE, battle, 5_000);
      answer();
      await recorder.settled();
      expect(recorder.currentBattle()).toMatchObject({ resumes: [], segment: { at: 5_000 } });
    });

    it('reads no battle when the last one listed is not on the current floor', async () => {
      const { store, recorder } = closedDuringBattle();
      const elsewhere = { ...startAscent(5), floor: 2 };
      await recorder.resume(elsewhere);
      await recorder.settled();
      expect(recorder.currentBattle()).toBeNull();
      expect(store.writes).toEqual([]);
    });

    it('goes on with a log of version 1 in progress in version 1, without battles', async () => {
      const ascent = startAscent(5);
      const { battles: _, ...body } = { ...beginAscentLog(ascent, DAY), id: 1 };
      const old: AscentLogV1 = { ...body, formatVersion: 1 };
      const { store, recorder } = setUp([JSON.stringify(old)]);
      await recorder.resume(ascent);
      recorder.beginBattle(PLACE, battle, 1_000);
      recorder.recordBattle(battle, [round(1_000, 1)]);
      recorder.record({ kind: 'abandoned', before: ascent, after: abandonAscent(ascent) });
      recorder.flush();
      await recorder.settled();
      expect(store.writes).toEqual([
        expect.objectContaining({ formatVersion: 1, status: 'ended' }),
      ]);
      expect(store.writes[0]).not.toHaveProperty('battles');
      expect(store.battleWrites).toEqual([]);
    });
  });
});
