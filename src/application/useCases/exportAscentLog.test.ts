import { startAscent } from '../../domain/ascent/Ascent';
import { beginAscentLog } from '../../domain/ascentLog/AscentLog';
import type { AscentLogExport, ExportedAscentLog } from '../../domain/ascentLog/AscentLogExport';
import { startBattle } from '../../domain/battle/Battle';
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
    expect(file!.contents).toContain('\n  "formatVersion": 2');
    const parsed = JSON.parse(file!.contents) as AscentLogExport;
    expect(parsed).toMatchObject({
      formatVersion: 2,
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

  it('puts the battle in progress in the file, up to its last save, marked in progress', async () => {
    const { store, recorder, shared, logExport } = setUp([logJson(1, 1)]);
    const { battle, events } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['ghoul'],
    });
    recorder.begin(startAscent(4));
    recorder.beginBattle({ tier: 1, floor: 1, encounterKind: 'combat' }, battle, 0);
    recorder.recordBattle(battle, events);
    recorder.flush();
    // Après la dernière sauvegarde : pas encore écrit.
    recorder.recordBattle(battle, [{ type: 'momentumChanged', at: 100, momentum: 3 }]);
    await logExport.export();

    const { ascents } = JSON.parse(shared[0]!.contents) as AscentLogExport;
    expect(ascents[0]).toMatchObject({ battles: [] });
    const current = ascents[1] as ExportedAscentLog;
    expect(current.battles).toEqual([
      expect.objectContaining({ tier: 1, floor: 1, status: 'inProgress' }),
    ]);
    expect(current.battles[0]!.rounds[0]!.effects).toEqual([]);
    expect(store.battleWrites).toHaveLength(1);
  });

  it('changes nothing when the share menu is closed without an app, and exports again', async () => {
    const { store, recorder, shared, logExport } = setUp();
    const { battle, events } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['ghoul'],
    });
    recorder.begin(startAscent(4));
    recorder.beginBattle({ tier: 1, floor: 1, encounterKind: 'combat' }, battle, 0);
    recorder.recordBattle(battle, events);
    recorder.flush();
    await logExport.export();
    const writes = [store.writes.length, store.battleWrites.length];
    await logExport.export();

    expect([store.writes.length, store.battleWrites.length]).toEqual(writes);
    expect(shared[1]!.contents).toBe(shared[0]!.contents);
  });
});
