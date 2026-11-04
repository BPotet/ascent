import { abandonAscent, chooseBlessing, startAscent } from '../../domain/ascent/Ascent';
import { Day } from '../../domain/day/Day';
import { beginAscentLog } from '../../domain/ascentLog/AscentLog';
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
});
