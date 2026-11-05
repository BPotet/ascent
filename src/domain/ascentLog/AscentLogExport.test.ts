import { endFloorBattle, rerollBoonOffer, startAscent } from '../ascent/Ascent';
import { startBattle } from '../battle/Battle';
import { Day } from '../day/Day';
import { beginAscentLog, recordAscentStep, type AscentLog, type AscentLogV1 } from './AscentLog';
import {
  ASCENT_LOG_KEPT,
  buildAscentLogExport,
  exportFileName,
  keepLatest,
  parseAscentLog,
  parseBattleLog,
  type StoredAscentLog,
} from './AscentLogExport';
import { beginBattleLog, recordBattleEvents, type BattleLog, type FloorPlace } from './BattleLog';

const DAY = Day.of(2026, 11, 3);
const logOf = (seed: number, id: number): AscentLog => ({
  ...beginAscentLog(startAscent(seed), DAY),
  id,
});
const OPTIONS = { appVersion: '0.3.0', buildChannel: 'preview', exportedOn: DAY } as const;

/** Le même journal, écrit avant #197 : version 1, sans combats. */
function v1Of(log: AscentLog): AscentLogV1 {
  const { battles: _, ...body } = log;
  return { ...body, formatVersion: 1 };
}

function battleAt({ tier, floor }: FloorPlace): BattleLog {
  const { battle, events } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    enemies: ['ghoul'],
  });
  return recordBattleEvents(
    beginBattleLog({ tier, floor, encounterKind: 'combat' }, battle, 0),
    battle,
    events,
  );
}

const stored = (
  log: AscentLog | AscentLogV1,
  battles: readonly string[] = [],
): StoredAscentLog => ({
  log: JSON.stringify(log),
  battles,
});

describe('parseAscentLog', () => {
  it('reads back a log written as JSON', () => {
    const log = logOf(4, 1);
    expect(parseAscentLog(JSON.stringify(log))).toEqual(log);
  });

  it('reads back a log of version 1, written before the battles', () => {
    const log = v1Of(logOf(4, 1));
    expect(parseAscentLog(JSON.stringify(log))).toEqual(log);
  });

  it.each([
    ['an unknown format version', JSON.stringify({ ...logOf(4, 1), formatVersion: 3 })],
    ['a log of version 2 without battles', JSON.stringify({ ...logOf(4, 1), battles: null })],
    ['a damaged JSON', '{"formatVersion":1,'],
    ['null', 'null'],
    ['a log without floors', JSON.stringify({ ...logOf(4, 1), floors: 'none' })],
    ['a log without seed', JSON.stringify({ ...logOf(4, 1), ascentSeed: '4' })],
    ['a log with an unknown status', JSON.stringify({ ...logOf(4, 1), status: 'lost' })],
  ])('gives null for %s', (_, raw) => {
    expect(parseAscentLog(raw)).toBeNull();
  });
});

describe('parseBattleLog', () => {
  it('reads back a battle written as JSON', () => {
    const battle = battleAt({ tier: 2, floor: 3 });
    expect(parseBattleLog(JSON.stringify(battle))).toEqual(battle);
  });

  it.each([
    [
      'an unknown format version',
      JSON.stringify({ ...battleAt({ tier: 1, floor: 1 }), formatVersion: 1 }),
    ],
    ['a damaged JSON', '{"formatVersion":2,'],
    ['null', 'null'],
    ['a battle without rounds', JSON.stringify({ ...battleAt({ tier: 1, floor: 1 }), rounds: 3 })],
    ['a battle without floor', JSON.stringify({ ...battleAt({ tier: 1, floor: 1 }), floor: '1' })],
    ['a battle without tier', JSON.stringify({ ...battleAt({ tier: 1, floor: 1 }), tier: null })],
    [
      'a battle with an unknown status',
      JSON.stringify({ ...battleAt({ tier: 1, floor: 1 }), status: 'x' }),
    ],
  ])('gives null for %s', (_, raw) => {
    expect(parseBattleLog(raw)).toBeNull();
  });
});

describe('buildAscentLogExport', () => {
  it('gathers the logs from oldest to newest, with the format and app versions', () => {
    const logs = [logOf(1, 1), logOf(2, 2)];
    const built = buildAscentLogExport(
      logs.map((log) => stored(log)),
      OPTIONS,
    );
    expect(built).toEqual({
      formatVersion: 2,
      appVersion: '0.3.0',
      buildChannel: 'preview',
      exportedOn: '2026-11-03',
      ascentCount: 2,
      ignoredLogs: 0,
      ignoredBattles: 0,
      ascents: logs,
    });
  });

  it('gives each log of version 2 its whole battles, sorted by tier then floor', () => {
    const places: FloorPlace[] = [
      { tier: 2, floor: 1 },
      { tier: 1, floor: 4 },
      { tier: 1, floor: 2 },
    ];
    const log = { ...logOf(1, 1), battles: places };
    const built = buildAscentLogExport(
      [
        stored(
          log,
          places.map((place) => JSON.stringify(battleAt(place))),
        ),
      ],
      OPTIONS,
    );

    const [ascent] = built.ascents;
    expect(ascent).toMatchObject({ formatVersion: 2, id: 1 });
    expect(
      ascent!.formatVersion === 2 && ascent!.battles.map((each) => [each.tier, each.floor]),
    ).toEqual([
      [1, 2],
      [1, 4],
      [2, 1],
    ]);
    expect(ascent!.formatVersion === 2 && ascent!.battles[0]).toEqual(
      battleAt({ tier: 1, floor: 2 }),
    );
  });

  it('mixes logs of version 1, as they are, without battles, and logs of version 2', () => {
    const old = v1Of(logOf(1, 1));
    const built = buildAscentLogExport(
      [stored(old, [JSON.stringify(battleAt({ tier: 1, floor: 1 }))]), stored(logOf(2, 2))],
      OPTIONS,
    );

    expect(built.formatVersion).toBe(2);
    expect(built.ascents).toEqual([old, logOf(2, 2)]);
    expect(built.ascents[0]).not.toHaveProperty('battles');
  });

  it('leaves out the unreadable logs and battles, and counts them', () => {
    const built = buildAscentLogExport(
      [
        { log: '{oops', battles: [] },
        stored(logOf(1, 1), ['{oops', JSON.stringify(battleAt({ tier: 1, floor: 1 }))]),
        { log: JSON.stringify({ formatVersion: 9 }), battles: [] },
      ],
      OPTIONS,
    );
    expect(built).toMatchObject({ ascentCount: 1, ignoredLogs: 2, ignoredBattles: 1 });
    expect(built.ascents.map((log) => log.id)).toEqual([1]);
    expect(built.ascents[0]!.formatVersion === 2 && built.ascents[0]!.battles).toHaveLength(1);
  });

  it('puts no habit data in the battles: no habit name, no check-in, no experience', () => {
    const built = buildAscentLogExport(
      [stored(logOf(1, 1), [JSON.stringify(battleAt({ tier: 1, floor: 1 }))])],
      OPTIONS,
    );
    expect(JSON.stringify(built)).not.toMatch(/habit|checkIn|experience|"xp"/iu);
  });
});

describe('the rerolled offers in the export (#42)', () => {
  const offered = endFloorBattle(startAscent(7, { gauge: 2 }), { outcome: 'victory', heroHp: 60 });
  const begun: AscentLog = { ...beginAscentLog(offered, DAY), id: 1 };

  it('exports the replaced offer of a reroll, in format version 2', () => {
    const rerolled = rerollBoonOffer(offered);
    const log = recordAscentStep(begun, {
      kind: 'boonOfferRerolled',
      before: offered,
      after: rerolled,
    });

    const json = JSON.stringify(buildAscentLogExport([stored(log)], OPTIONS));

    const exported = JSON.parse(json) as { formatVersion: number; ascents: AscentLog[] };
    expect(exported.formatVersion).toBe(2);
    expect(exported.ascents[0]!.floors[0]).toMatchObject({
      rerolledOffers: [offered.boonOffer],
      boonsOffered: rerolled.boonOffer,
    });
  });

  it('exports a log without reroll byte for byte, without the key', () => {
    const json = JSON.stringify(buildAscentLogExport([stored(begun)], OPTIONS));

    expect(json).not.toContain('rerolledOffers');
    expect(json).toContain(JSON.stringify(begun));
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
