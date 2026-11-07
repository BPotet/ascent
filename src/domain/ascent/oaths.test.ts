// Le Serment (`Oath`, #237) : une habitude liée à un pouvoir débloqué de 2 Élan ou plus ; faite
// hier, à partir du lendemain du Serment, elle attise ce pouvoir (`KindledPower`).
import type { PowerKind } from '../battle/powers';
import { Day } from '../day/Day';
import type { Camp } from './camp';
import {
  OATH_MIN_COST,
  canBearOath,
  kindledPowers,
  oathStanding,
  parseOaths,
  serializeOaths,
  swearOath,
  type Oath,
} from './oaths';
import { powerPrice } from './powerTree';

function campWith(...powers: PowerKind[]): Camp {
  return { unlocks: [], powers: powers.map((power) => ({ power, price: powerPrice(power) })) };
}

const RUNNING = 12;
const READING = 13;
const today = Day.of(2026, 11, 7);
const camp = campWith('retaliation', 'holdFast', 'rend', 'mist');
const habits = [RUNNING, READING];

describe('the powers that can bear an Oath (#237)', () => {
  it('asks for 2 Momentum or more', () => {
    expect(OATH_MIN_COST).toBe(2);
  });

  it('takes an unlocked power of 2 Momentum or more, and the base Shadow Step at 3', () => {
    expect(canBearOath(camp, 'retaliation')).toBe(true);
    expect(canBearOath(camp, 'holdFast')).toBe(true);
    expect(canBearOath(camp, 'mist')).toBe(true);
    expect(canBearOath(campWith(), 'shadowStep')).toBe(true);
  });

  it('refuses a power of 1 Momentum, the Bulwark and Rend', () => {
    expect(canBearOath(camp, 'bulwark')).toBe(false);
    expect(canBearOath(camp, 'rend')).toBe(false);
  });

  it('refuses a power that is not unlocked', () => {
    expect(canBearOath(campWith(), 'mist')).toBe(false);
    expect(canBearOath(campWith('rend'), 'retaliation')).toBe(false);
  });
});

describe('swearing an Oath (#237)', () => {
  const swear = (oaths: readonly Oath[], power: PowerKind, habit: number, day = today) =>
    swearOath(oaths, { camp, habits, power, habit, today: day });

  it('binds the habit to the power, from today', () => {
    expect(swear([], 'retaliation', RUNNING)).toEqual({
      kind: 'sworn',
      oaths: [{ power: 'retaliation', habit: RUNNING, since: '2026-11-07' }],
    });
  });

  it('replaces the Oath of the power: one Oath per power, sworn again from today', () => {
    const before: Oath[] = [{ power: 'retaliation', habit: RUNNING, since: '2026-11-01' }];

    expect(swear(before, 'retaliation', READING)).toEqual({
      kind: 'sworn',
      oaths: [{ power: 'retaliation', habit: READING, since: '2026-11-07' }],
    });
  });

  it('keeps the other Oaths, in their order', () => {
    const before: Oath[] = [
      { power: 'mist', habit: READING, since: '2026-11-01' },
      { power: 'retaliation', habit: RUNNING, since: '2026-11-02' },
    ];

    expect(swear(before, 'mist', 99)).toEqual({ kind: 'unknownHabit' });
    const sworn = swearOath(before, {
      camp,
      habits: [RUNNING, READING, 14],
      power: 'mist',
      habit: 14,
      today,
    });
    expect(sworn).toEqual({
      kind: 'sworn',
      oaths: [
        { power: 'mist', habit: 14, since: '2026-11-07' },
        { power: 'retaliation', habit: RUNNING, since: '2026-11-02' },
      ],
    });
  });

  it('leaves the Oath unchanged, its day too, for the same habit and power', () => {
    const before: Oath[] = [{ power: 'retaliation', habit: RUNNING, since: '2026-11-01' }];

    expect(swear(before, 'retaliation', RUNNING)).toEqual({ kind: 'unchanged' });
  });

  it('refuses a habit that already holds the Oath of another power', () => {
    const before: Oath[] = [{ power: 'retaliation', habit: RUNNING, since: '2026-11-01' }];

    expect(swear(before, 'holdFast', RUNNING)).toEqual({ kind: 'habitTaken', by: 'retaliation' });
  });

  it('refuses a power of 1 Momentum or not unlocked', () => {
    expect(swear([], 'bulwark', RUNNING)).toEqual({ kind: 'notEligible' });
    expect(
      swearOath([], { camp: campWith(), habits, power: 'mist', habit: RUNNING, today }),
    ).toEqual({ kind: 'notEligible' });
  });

  it('refuses a habit that does not exist', () => {
    expect(swear([], 'retaliation', 99)).toEqual({ kind: 'unknownHabit' });
  });
});

describe('the standing of an Oath (#237)', () => {
  const oath = (since: string): Oath => ({ power: 'retaliation', habit: RUNNING, since });

  it('is fresh the day it is sworn, even if the habit was done yesterday', () => {
    expect(oathStanding(oath('2026-11-07'), habits, [RUNNING], today)).toBe('fresh');
  });

  it('is kept the next day, if the habit was done yesterday, before or after the Oath', () => {
    expect(oathStanding(oath('2026-11-06'), habits, [RUNNING], today)).toBe('kept');
    expect(oathStanding(oath('2026-10-01'), habits, [READING, RUNNING], today)).toBe('kept');
  });

  it('is missed when the habit was not done yesterday', () => {
    expect(oathStanding(oath('2026-11-05'), habits, [READING], today)).toBe('missed');
  });

  it('is broken when the habit no longer exists, whatever the day', () => {
    expect(oathStanding(oath('2026-11-05'), [READING], [RUNNING], today)).toBe('broken');
    expect(oathStanding(oath('2026-11-07'), [READING], [], today)).toBe('broken');
  });
});

describe('the kindled powers (#237)', () => {
  const oaths: Oath[] = [
    { power: 'holdFast', habit: READING, since: '2026-11-01' },
    { power: 'retaliation', habit: RUNNING, since: '2026-11-01' },
  ];

  it('are the equipped powers whose Oath is kept, in the order of the keys', () => {
    expect(
      kindledPowers(
        ['bulwark', 'retaliation', 'holdFast'],
        oaths,
        habits,
        [RUNNING, READING],
        today,
      ),
    ).toEqual([
      { power: 'retaliation', habit: RUNNING },
      { power: 'holdFast', habit: READING },
    ]);
  });

  it('leave out a power that is not equipped', () => {
    expect(kindledPowers(['bulwark', 'retaliation'], oaths, habits, [READING], today)).toEqual([]);
  });

  it('leave out a missed, fresh or broken Oath', () => {
    const mixed: Oath[] = [
      { power: 'holdFast', habit: READING, since: '2026-11-07' },
      { power: 'retaliation', habit: 99, since: '2026-11-01' },
    ];

    expect(
      kindledPowers(['bulwark', 'retaliation', 'holdFast'], mixed, habits, [99, READING], today),
    ).toEqual([]);
  });
});

describe('the stored Oaths (#237)', () => {
  const stored = (oaths: unknown, version: unknown = 1) => JSON.stringify({ version, oaths });

  it('are none when nothing is stored', () => {
    expect(parseOaths(null, camp)).toEqual({ oaths: [], unreadable: false });
  });

  it('read back what was written', () => {
    const oaths: Oath[] = [
      { power: 'retaliation', habit: RUNNING, since: '2026-11-06' },
      { power: 'mist', habit: READING, since: '2026-11-07' },
    ];

    expect(serializeOaths(oaths)).toBe(
      '{"version":1,"oaths":[{"power":"retaliation","habit":12,"since":"2026-11-06"},' +
        '{"power":"mist","habit":13,"since":"2026-11-07"}]}',
    );
    expect(parseOaths(serializeOaths(oaths), camp)).toEqual({ oaths, unreadable: false });
  });

  it('ignore, without rewriting it, an Oath on a power the Camp no longer holds', () => {
    const raw = stored([{ power: 'retaliation', habit: RUNNING, since: '2026-11-06' }]);

    expect(parseOaths(raw, campWith())).toEqual({ oaths: [], unreadable: false });
  });

  it.each([
    ['not JSON', '{'],
    ['another version', stored([], 2)],
    ['no list', JSON.stringify({ version: 1 })],
    ['an unknown power', stored([{ power: 'shieldBash', habit: 1, since: '2026-11-06' }])],
    ['a power of 1 Momentum', stored([{ power: 'rend', habit: 1, since: '2026-11-06' }])],
    [
      'a habit that is not an integer',
      stored([{ power: 'mist', habit: 1.5, since: '2026-11-06' }]),
    ],
    ['a habit of 0', stored([{ power: 'mist', habit: 0, since: '2026-11-06' }])],
    ['an invalid day', stored([{ power: 'mist', habit: 1, since: '2026-02-30' }])],
    ['a day that is not a text', stored([{ power: 'mist', habit: 1, since: 20261106 }])],
    ['an entry that is not an object', stored([null])],
    [
      'a power twice',
      stored([
        { power: 'mist', habit: 1, since: '2026-11-06' },
        { power: 'mist', habit: 2, since: '2026-11-06' },
      ]),
    ],
    [
      'a habit twice',
      stored([
        { power: 'mist', habit: 1, since: '2026-11-06' },
        { power: 'retaliation', habit: 1, since: '2026-11-06' },
      ]),
    ],
  ])('are unreadable with %s', (_case, raw) => {
    expect(parseOaths(raw, camp)).toEqual({ oaths: [], unreadable: true });
  });
});
