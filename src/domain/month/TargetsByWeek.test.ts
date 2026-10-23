import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import type { SettingsChange } from '../habit/SettingsChange';
import type { WeeklyTarget } from '../habit/WeeklyTarget';
import { Week } from '../week/Week';
import { Month } from './Month';
import {
  habitWeekProgressOf,
  targetsByWeekOf,
  weekTargetsRowOf,
  type WeekTargetsRow,
} from './TargetsByWeek';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const weekOf = (month: number, dayOfMonth: number) => Week.containing(day(month, dayOfMonth));
/** Aujourd'hui dans le contexte de la story : le mercredi 21 octobre 2026. */
const today = day(10, 21);
/** Le jour de la mise à jour qui introduit l'objectif hebdomadaire. */
const update = day(9, 28);

let nextSequence = 1;
const change = (
  habit: Habit,
  weeklyTarget: WeeklyTarget | null,
  changedOn = habit.createdOn,
): SettingsChange => ({
  habitId: habit.id,
  changedOn,
  sequence: nextSequence++,
  difficulty: 'medium',
  weeklyTarget,
});

const done = (habit: Habit, ...days: Day[]): CheckIn[] =>
  days.map((each) => ({ habitId: habit.id, day: each, done: true, corrected: false }));

const habit = (id: number, name: string, createdOn: Day) =>
  new Habit(id, HabitName.parse(name), createdOn);

// Les 4 habitudes du contexte, créées le jour de la mise à jour avec un objectif.
const running = habit(1, 'Courir 5 km', update);
const cooking = habit(2, 'Cuisiner', update);
const reading = habit(3, 'Lire 20 minutes', update);
const sleeping = habit(4, 'Me coucher avant 23 h', update);
const habits = [running, cooking, reading, sleeping];
const changes = [change(running, 3), change(cooking, 1), change(reading, 2), change(sleeping, 1)];

/** Le scénario 1 : 2/4 la semaine du 28 septembre, 3/4, 4/4, puis 1/4 cette semaine. */
const checkIns: CheckIn[] = [
  // Semaine du 28 septembre : « Cuisiner » et « Me coucher » atteignent leur objectif, à cheval sur
  // octobre pour « Me coucher » (le jeudi 1er octobre).
  ...done(running, day(9, 28), day(9, 29)),
  ...done(cooking, day(9, 30)),
  ...done(reading, day(9, 29)),
  ...done(sleeping, day(10, 1)),
  // Semaine du 5 octobre : 3/4.
  ...done(running, day(10, 5), day(10, 7), day(10, 9)),
  ...done(cooking, day(10, 6)),
  ...done(reading, day(10, 6), day(10, 8)),
  // Semaine du 12 octobre : 4/4.
  ...done(running, day(10, 12), day(10, 14), day(10, 16)),
  ...done(cooking, day(10, 13)),
  ...done(reading, day(10, 13), day(10, 15)),
  ...done(sleeping, day(10, 18)),
  // Cette semaine : 1/4.
  ...done(cooking, day(10, 19)),
  ...done(running, day(10, 20)),
];

const summary = (rows: readonly WeekTargetsRow[]) =>
  rows.map(({ week, reachedCount, targetCount }) => [
    week.start.toIsoString(),
    reachedCount,
    targetCount,
  ]);

describe('habitWeekProgressOf', () => {
  const week = weekOf(10, 12);

  it('gives the progress of the week and the target of the week of a habit', () => {
    const progress = habitWeekProgressOf(
      running,
      week,
      done(running, day(10, 12), day(10, 14)),
      [change(running, 3)],
      today,
    );

    expect(progress).toEqual({
      habit: running,
      weeklyProgress: 2,
      weekTarget: 3,
      targetReached: false,
    });
  });

  it('reaches the target at the threshold, and beyond', () => {
    const at = done(running, day(10, 12), day(10, 14), day(10, 16));
    const beyond = [...at, ...done(running, day(10, 17))];

    expect(habitWeekProgressOf(running, week, at, [change(running, 3)], today)).toMatchObject({
      weeklyProgress: 3,
      targetReached: true,
    });
    expect(habitWeekProgressOf(running, week, beyond, [change(running, 3)], today)).toMatchObject({
      weeklyProgress: 4,
      targetReached: true,
    });
  });

  it('counts the days up to today only (a « fait » after today, after a clock rollback)', () => {
    const progress = habitWeekProgressOf(
      running,
      weekOf(10, 19),
      done(running, day(10, 19), day(10, 22)),
      [change(running, 1)],
      today,
    );

    expect(progress).toMatchObject({ weeklyProgress: 1, weekTarget: 1, targetReached: true });
  });

  it('reduces the target of the week of creation to its active days', () => {
    const late = habit(5, 'Méditer', day(10, 17));

    expect(
      habitWeekProgressOf(late, week, done(late, day(10, 17)), [change(late, 7)], today),
    ).toEqual({ habit: late, weeklyProgress: 1, weekTarget: 2, targetReached: false });
  });

  it('has no progress for a week closed before the update (R17)', () => {
    const old = habit(5, 'Lire', day(9, 21));
    const history = [change(old, null), change(old, 7, update)];

    expect(habitWeekProgressOf(old, weekOf(9, 21), [], history, today)).toBeNull();
    expect(habitWeekProgressOf(old, weekOf(9, 28), [], history, today)).toMatchObject({
      weekTarget: 7,
    });
  });

  it('has no progress for a week entirely before the day of creation', () => {
    expect(habitWeekProgressOf(running, weekOf(9, 21), [], [change(running, 3)], today)).toBeNull();
  });
});

describe('weekTargetsRowOf', () => {
  it('counts the habits that reached their target among those that have one', () => {
    const row = weekTargetsRowOf(weekOf(10, 5), habits, checkIns, changes, today);

    expect(row).toMatchObject({ reachedCount: 3, targetCount: 4 });
    expect(row?.week).toEqual(weekOf(10, 5));
    expect(row?.habits.map(({ habit: { name } }) => name.value)).toEqual([
      'Courir 5 km',
      'Cuisiner',
      'Lire 20 minutes',
      'Me coucher avant 23 h',
    ]);
    expect(row?.habits.map(({ targetReached }) => targetReached)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('reads the check-ins and the settings of each habit only', () => {
    const row = weekTargetsRowOf(
      weekOf(10, 12),
      [running, cooking],
      [...done(running, day(10, 12)), ...done(cooking, day(10, 13), day(10, 14))],
      [change(running, 1), change(cooking, 3)],
      today,
    );

    expect(
      row?.habits.map(({ weeklyProgress, weekTarget }) => [weeklyProgress, weekTarget]),
    ).toEqual([
      [1, 1],
      [2, 3],
    ]);
    expect(row).toMatchObject({ reachedCount: 1, targetCount: 2 });
  });

  it('leaves out a habit without a target of the week, and counts the others', () => {
    const old = habit(5, 'Lire', day(9, 21));
    const row = weekTargetsRowOf(
      weekOf(9, 21),
      [old, running],
      done(old, day(9, 22)),
      [change(old, null), change(old, 7, update), change(running, 3)],
      today,
    );

    expect(row).toBeNull();

    const later = weekTargetsRowOf(
      weekOf(9, 28),
      [old, habit(6, 'Jardiner', day(10, 1))],
      done(old, day(9, 28)),
      [change(old, null), change(old, 1, update)],
      today,
    );

    expect(later?.habits.map(({ habit: { name } }) => name.value)).toEqual(['Lire']);
    expect(later).toMatchObject({ reachedCount: 1, targetCount: 1 });
  });

  it('has no row for a week after the current week', () => {
    expect(weekTargetsRowOf(weekOf(10, 26), habits, checkIns, changes, today)).toBeNull();
    expect(weekTargetsRowOf(weekOf(10, 19), habits, checkIns, changes, today)).not.toBeNull();
  });

  it('has no row without any habit', () => {
    expect(weekTargetsRowOf(weekOf(10, 19), [], [], [], today)).toBeNull();
  });
});

describe('targetsByWeekOf', () => {
  it('gives a row for each week of the month up to the current week (scenario 1)', () => {
    const rows = targetsByWeekOf(Month.of(2026, 10), habits, checkIns, changes, today);

    expect(summary(rows)).toEqual([
      ['2026-09-28', 2, 4],
      ['2026-10-05', 3, 4],
      ['2026-10-12', 4, 4],
      ['2026-10-19', 1, 4],
    ]);
  });

  it('computes a week across two months the same way in both (scenario 3)', () => {
    const october = targetsByWeekOf(Month.of(2026, 10), habits, checkIns, changes, today);
    const september = targetsByWeekOf(Month.of(2026, 9), habits, checkIns, changes, today);

    expect(september).toHaveLength(1);
    expect(september[0]).toEqual(october[0]);
    // « Me coucher avant 23 h » l'atteint le jeudi 1er octobre, compté aussi en septembre.
    expect(september[0]?.habits[3]).toMatchObject({ weeklyProgress: 1, targetReached: true });
  });

  it('has no row for the weeks before the update (scenario 5)', () => {
    const old = habit(5, 'Lire', day(9, 21));
    const rows = targetsByWeekOf(
      Month.of(2026, 9),
      [old, ...habits],
      [...checkIns, ...done(old, day(9, 21), day(9, 28))],
      [change(old, null), change(old, 7, update), ...changes],
      today,
    );

    expect(summary(rows)).toEqual([['2026-09-28', 2, 5]]);
  });

  it('has no row for the weeks before the first habit', () => {
    const rows = targetsByWeekOf(Month.of(2026, 10), [cooking], [], [change(cooking, 1)], today);

    expect(summary(rows).map(([week]) => week)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);

    const late = habit(5, 'Méditer', day(10, 14));
    expect(
      summary(targetsByWeekOf(Month.of(2026, 10), [late], [], [change(late, 7)], today)),
    ).toEqual([
      ['2026-10-12', 0, 1],
      ['2026-10-19', 0, 1],
    ]);
  });

  it('is empty without any habit', () => {
    expect(targetsByWeekOf(Month.of(2026, 10), [], [], [], today)).toEqual([]);
  });

  it('covers every week of a past month, from a month starting on a Monday (June 2026)', () => {
    const old = habit(5, 'Courir', day(5, 1));
    const rows = targetsByWeekOf(Month.of(2026, 6), [old], [], [change(old, 2)], today);

    expect(summary(rows).map(([week]) => week)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
      '2026-06-29',
    ]);
  });

  it('ends with the week of the last day of a month ending on a Sunday (May 2026)', () => {
    const old = habit(5, 'Courir', day(4, 1));
    const rows = targetsByWeekOf(Month.of(2026, 5), [old], [], [change(old, 2)], today);

    expect(summary(rows).map(([week]) => week)).toEqual([
      '2026-04-27',
      '2026-05-04',
      '2026-05-11',
      '2026-05-18',
      '2026-05-25',
    ]);
  });

  it('stops at the current week, on its first day (a Monday)', () => {
    const rows = targetsByWeekOf(Month.of(2026, 10), habits, checkIns, changes, day(10, 19));

    expect(summary(rows).at(-1)).toEqual(['2026-10-19', 1, 4]);
    expect(rows).toHaveLength(4);
  });
});
