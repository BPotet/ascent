import { startAscent } from '../ascent/Ascent';
import { Day } from '../day/Day';
import { beginAscentLog, type AscentLog } from './AscentLog';
import {
  ASCENT_LOG_KEPT,
  buildAscentLogExport,
  exportFileName,
  keepLatest,
  parseAscentLog,
} from './AscentLogExport';

const DAY = Day.of(2026, 11, 3);
const logOf = (seed: number, id: number): AscentLog => ({
  ...beginAscentLog(startAscent(seed), DAY),
  id,
});
const OPTIONS = { appVersion: '0.3.0', buildChannel: 'preview', exportedOn: DAY } as const;

describe('parseAscentLog', () => {
  it('reads back a log written as JSON', () => {
    const log = logOf(4, 1);
    expect(parseAscentLog(JSON.stringify(log))).toEqual(log);
  });

  it.each([
    ['an unknown format version', JSON.stringify({ ...logOf(4, 1), formatVersion: 2 })],
    ['a damaged JSON', '{"formatVersion":1,'],
    ['null', 'null'],
    ['a log without floors', JSON.stringify({ ...logOf(4, 1), floors: 'none' })],
    ['a log without seed', JSON.stringify({ ...logOf(4, 1), ascentSeed: '4' })],
    ['a log with an unknown status', JSON.stringify({ ...logOf(4, 1), status: 'lost' })],
  ])('gives null for %s', (_, raw) => {
    expect(parseAscentLog(raw)).toBeNull();
  });
});

describe('buildAscentLogExport', () => {
  it('gathers the logs from oldest to newest, with the format and app versions', () => {
    const logs = [logOf(1, 1), logOf(2, 2)];
    const built = buildAscentLogExport(
      logs.map((log) => JSON.stringify(log)),
      OPTIONS,
    );
    expect(built).toEqual({
      formatVersion: 1,
      appVersion: '0.3.0',
      buildChannel: 'preview',
      exportedOn: '2026-11-03',
      ascentCount: 2,
      ignoredLogs: 0,
      ascents: logs,
    });
  });

  it('leaves out the unreadable logs and counts them', () => {
    const built = buildAscentLogExport(
      ['{oops', JSON.stringify(logOf(1, 1)), JSON.stringify({ formatVersion: 9 })],
      OPTIONS,
    );
    expect(built).toMatchObject({ ascentCount: 1, ignoredLogs: 2 });
    expect(built.ascents.map((log) => log.id)).toEqual([1]);
  });
});

describe('keepLatest', () => {
  const ids = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

  it('keeps the 20 latest logs', () => {
    expect(ASCENT_LOG_KEPT).toBe(20);
    expect(keepLatest(ids(19), 20)).toEqual({ kept: ids(19), evicted: [] });
    expect(keepLatest(ids(20), 20)).toEqual({ kept: ids(20), evicted: [] });
    expect(keepLatest(ids(21), 20)).toEqual({ kept: ids(21).slice(1), evicted: [1] });
  });
});

describe('exportFileName', () => {
  it('names the file after the day of the export', () => {
    expect(exportFileName(DAY)).toBe('ascent-journal-2026-11-03.json');
  });
});
