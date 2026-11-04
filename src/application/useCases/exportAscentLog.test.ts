import { startAscent } from '../../domain/ascent/Ascent';
import { beginAscentLog } from '../../domain/ascentLog/AscentLog';
import type { AscentLogExport } from '../../domain/ascentLog/AscentLogExport';
import { Day } from '../../domain/day/Day';
import type { SharedFile } from '../ports/FileShare';
import { memoryAscentLogStore } from '../testing/memoryAscentLogStore';
import { settableClock } from '../testing/settableClock';
import { AscentLogRecorder } from './AscentLogRecorder';
import { ascentLogExport } from './exportAscentLog';

const DAY = Day.of(2026, 11, 3);

function setUp(initial: readonly string[] = []) {
  const store = memoryAscentLogStore(initial);
  const clock = settableClock(DAY);
  const recorder = new AscentLogRecorder({ store, clock });
  const shared: SharedFile[] = [];
  const share = { share: jest.fn(async (file: SharedFile) => void shared.push(file)) };
  const logExport = ascentLogExport({
    recorder,
    store,
    share,
    clock,
    appVersion: '0.3.0',
    buildChannel: 'preview',
  });
  return { store, recorder, share, shared, logExport };
}

const logJson = (seed: number, id: number) =>
  JSON.stringify({ ...beginAscentLog(startAscent(seed), DAY), id });

describe('ascentLogExport', () => {
  it('does not open the share menu when the log is empty', async () => {
    const { share, logExport } = setUp();
    await expect(logExport.export()).resolves.toEqual({ result: 'empty', ignoredLogs: 0 });
    expect(share.share).not.toHaveBeenCalled();
  });

  it('shares a readable JSON file with the format and app versions', async () => {
    const { shared, logExport } = setUp([logJson(1, 1), logJson(2, 2)]);
    await expect(logExport.export()).resolves.toEqual({ result: 'shared', ignoredLogs: 0 });
    expect(shared).toHaveLength(1);
    const [file] = shared;
    expect(file).toMatchObject({
      name: 'ascent-journal-2026-11-03.json',
      mimeType: 'application/json',
    });
    expect(file!.contents).toContain('\n  "formatVersion": 1');
    const parsed = JSON.parse(file!.contents) as AscentLogExport;
    expect(parsed).toMatchObject({
      formatVersion: 1,
      appVersion: '0.3.0',
      buildChannel: 'preview',
      exportedOn: '2026-11-03',
      ascentCount: 2,
    });
  });

  it('waits for the log of the ascent in progress before reading the logs', async () => {
    const { store, recorder, shared, logExport } = setUp();
    recorder.begin(startAscent(4));
    store.hold();
    recorder.flush();
    const exported = logExport.export();
    store.release();
    await exported;
    expect((JSON.parse(shared[0]!.contents) as AscentLogExport).ascentCount).toBe(1);
  });

  it('counts the unreadable logs left out', async () => {
    const { logExport } = setUp(['{oops', logJson(1, 1)]);
    await expect(logExport.export()).resolves.toEqual({ result: 'shared', ignoredLogs: 1 });
  });

  it('rejects when the file cannot be shared, and leaves the log unchanged', async () => {
    const { store, share, logExport } = setUp([logJson(1, 1)]);
    share.share.mockRejectedValueOnce(new Error('No share menu'));
    await expect(logExport.export()).rejects.toThrow('No share menu');
    expect(store.writes).toEqual([]);
    await expect(logExport.export()).resolves.toMatchObject({ result: 'shared' });
  });

  it('gives the number of logs kept, and whether the ascent in progress has one', async () => {
    const { recorder, logExport } = setUp([logJson(1, 1)]);
    await expect(logExport.status()).resolves.toEqual({ count: 1, inProgress: false });
    recorder.begin(startAscent(4));
    recorder.flush();
    await expect(logExport.status()).resolves.toEqual({ count: 2, inProgress: true });
  });
});
