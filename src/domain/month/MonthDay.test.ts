import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import type { WeeklyTarget } from '../habit/WeeklyTarget';
import { monthDayOf } from './MonthDay';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const today = day(10, 14);
const cooking = new Habit(1, HabitName.parse('Cuisiner'), day(10, 5));
const budget = new Habit(2, HabitName.parse('Budget du jour'), day(10, 13));
const habits = [cooking, budget];

const checkIn = (habit: Habit, on: Day, done = true, corrected = false): CheckIn => ({
  habitId: habit.id,
  day: on,
  done,
  corrected,
});

const checkIns = [
  checkIn(cooking, day(10, 12)),
  checkIn(cooking, day(10, 13)),
  checkIn(budget, day(10, 13)),
];

const names = (habitDays: readonly { habit: Habit }[]) =>
  habitDays.map(({ habit }) => habit.name.value);

describe('monthDayOf (R23)', () => {
  it('counts the habits « fait » among the habits active that day, all expected without a target', () => {
    expect(monthDayOf(day(10, 12), habits, checkIns, [], today)).toMatchObject({
      kind: 'tracked',
      doneCount: 1,
      activeCount: 1,
      expectedCount: 1,
    });
    expect(monthDayOf(day(10, 13), habits, checkIns, [], today)).toMatchObject({
      kind: 'tracked',
      doneCount: 2,
      activeCount: 2,
      expectedCount: 2,
    });
    expect(monthDayOf(today, habits, checkIns, [], today)).toMatchObject({
      kind: 'tracked',
      doneCount: 0,
      activeCount: 2,
      expectedCount: 2,
    });
  });

  it('gives the state of each active habit, in order of creation, and the habits created later apart', () => {
    const monday = monthDayOf(day(10, 12), habits, checkIns, [], today);

    expect(monday.day).toEqual(day(10, 12));
    expect(monday.habits.map(({ habit, status, editable }) => [habit, status, editable])).toEqual([
      [cooking, 'done', true],
    ]);
    expect(
      monday.notStartedHabits.map(({ habit, status, editable }) => [habit, status, editable]),
    ).toEqual([[budget, 'notStarted', false]]);

    const tuesday = monthDayOf(day(10, 13), habits, checkIns, [], today);
    expect(names(tuesday.habits)).toEqual(['Cuisiner', 'Budget du jour']);
    expect(tuesday.notStartedHabits).toEqual([]);
  });

  it('ignores the check-ins of other days', () => {
    const thursday = monthDayOf(day(10, 8), habits, checkIns, [], today);

    expect(thursday).toMatchObject({ doneCount: 0, activeCount: 1 });
    expect(thursday.habits.map(({ status }) => status)).toEqual(['missed']);
  });

  it('is neutral without any active habit: nothing to count nor to correct', () => {
    const neutral = monthDayOf(day(10, 4), habits, checkIns, [], today);

    expect(neutral).toMatchObject({
      kind: 'neutral',
      doneCount: 0,
      activeCount: 0,
      expectedCount: 0,
    });
    expect(neutral.habits).toEqual([]);
    expect(neutral.expectedHabits).toEqual([]);
    expect(names(neutral.notStartedHabits)).toEqual(['Cuisiner', 'Budget du jour']);
    expect(monthDayOf(today, [], [], [], today)).toMatchObject({ kind: 'neutral', activeCount: 0 });
  });

  it('is upcoming after today, with nothing changeable', () => {
    const upcoming = monthDayOf(day(10, 15), habits, checkIns, [], today);

    expect(upcoming).toMatchObject({ kind: 'upcoming', doneCount: 0, activeCount: 2 });
    expect(upcoming.habits.map(({ status, editable }) => [status, editable])).toEqual([
      ['upcoming', false],
      ['upcoming', false],
    ]);
    expect(monthDayOf(day(10, 15), [], [], [], today).kind).toBe('upcoming');
  });

  it('counts a check-in dated in the future after the clock went back, still upcoming (R7)', () => {
    const later = monthDayOf(day(10, 15), habits, [checkIn(cooking, day(10, 15))], [], today);

    expect(later).toMatchObject({ kind: 'upcoming', doneCount: 1, activeCount: 2 });
  });

  it('marks a closed day with at least one corrected habit day (R13, Q2)', () => {
    const corrections = [checkIn(cooking, day(10, 8), true, true)];

    expect(monthDayOf(day(10, 8), habits, corrections, [], today).corrected).toBe(true);
    expect(monthDayOf(day(10, 9), habits, corrections, [], today).corrected).toBe(false);
    expect(
      monthDayOf(day(10, 12), habits, [checkIn(cooking, day(10, 12), false, true)], [], today),
    ).toMatchObject({ corrected: true, doneCount: 0 });
  });

  it('shows no mark « corrigé » today', () => {
    const marked = [checkIn(cooking, today, true, true)];

    expect(monthDayOf(today, habits, marked, [], today)).toMatchObject({
      corrected: false,
      doneCount: 1,
    });
  });

  it('knows whether the day is today', () => {
    expect(monthDayOf(today, habits, checkIns, [], today).isToday).toBe(true);
    expect(monthDayOf(day(10, 13), habits, checkIns, [], today).isToday).toBe(false);
    expect(monthDayOf(day(10, 15), habits, checkIns, [], today).isToday).toBe(false);
  });
});

describe('monthDayOf, expected habits (#25)', () => {
  // Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7, créées le
  // lundi 5 octobre 2026.
  const running = new Habit(3, HabitName.parse('Courir 5 km'), day(10, 5));
  const cuisine = new Habit(4, HabitName.parse('Cuisiner'), day(10, 5));
  const story = [running, cuisine];
  const settings = (
    habit: Habit,
    weeklyTarget: WeeklyTarget | null,
    changedOn = habit.createdOn,
  ) => ({
    habitId: habit.id,
    changedOn,
    sequence: habit.id,
    difficulty: 'medium' as const,
    weeklyTarget,
  });
  const changes = [settings(running, 3), settings(cuisine, 7)];
  const friday16 = day(10, 16);
  const done = (habit: Habit, ...days: number[]) =>
    days.map((dayOfMonth) => checkIn(habit, day(10, dayOfMonth)));

  it('counts the habits « fait » among the expected habits (scénario du Jour du mois)', () => {
    const tracked = [...done(running, 13, 14, 15), ...done(cuisine, 12, 15)];

    expect(monthDayOf(day(10, 12), story, tracked, changes, friday16)).toMatchObject({
      kind: 'tracked',
      doneCount: 1,
      activeCount: 2,
      expectedCount: 2,
    });
    expect(monthDayOf(day(10, 15), story, tracked, changes, friday16)).toMatchObject({
      doneCount: 2,
      expectedCount: 2,
    });
  });

  it('leaves out a habit not « fait » whose target was reached, but keeps it in the habits', () => {
    const tracked = done(running, 12, 13, 14);
    const thursday = monthDayOf(day(10, 15), story, tracked, changes, friday16);

    expect(thursday).toMatchObject({ doneCount: 0, activeCount: 2, expectedCount: 1 });
    expect(names(thursday.expectedHabits)).toEqual(['Cuisiner']);
    expect(names(thursday.habits)).toEqual(['Courir 5 km', 'Cuisiner']);
    expect(thursday.habits.map(({ status, editable }) => [status, editable])).toEqual([
      ['missed', true],
      ['missed', true],
    ]);
  });

  it('gives the expected habits as the cases of the day, in order of creation', () => {
    const tracked = [...done(running, 15), ...done(cuisine, 15)];
    const thursday = monthDayOf(day(10, 15), story, tracked, changes, friday16);

    expect(thursday.expectedHabits).toEqual(thursday.habits);
    expect(thursday.expectedHabits.map(({ habit, status }) => [habit, status])).toEqual([
      [running, 'done'],
      [cuisine, 'done'],
    ]);
  });

  it('is tracked with no expected habit: the flag « Objectifs atteints »', () => {
    const tracked = done(running, 12, 13, 14);
    const thursday = monthDayOf(day(10, 15), [running], tracked, changes, day(10, 19));

    expect(thursday).toMatchObject({
      kind: 'tracked',
      doneCount: 0,
      activeCount: 1,
      expectedCount: 0,
    });
    expect(thursday.expectedHabits).toEqual([]);
    expect(names(thursday.habits)).toEqual(['Courir 5 km']);
  });

  it('counts today with the same rule', () => {
    const tracked = done(running, 12, 13, 14);

    expect(monthDayOf(day(10, 15), story, tracked, changes, day(10, 15))).toMatchObject({
      kind: 'tracked',
      isToday: true,
      doneCount: 0,
      expectedCount: 1,
    });
  });

  it('reads the progress from the Monday of the week, even in the previous month', () => {
    // Semaine du lundi 26 octobre au dimanche 1er novembre 2026.
    const tracked = [
      checkIn(running, day(10, 26)),
      checkIn(running, day(10, 27)),
      checkIn(running, day(10, 28)),
    ];

    expect(monthDayOf(day(11, 1), [running], tracked, changes, day(11, 2))).toMatchObject({
      kind: 'tracked',
      expectedCount: 0,
    });
    expect(monthDayOf(day(11, 2), [running], tracked, changes, day(11, 2))).toMatchObject({
      expectedCount: 1,
    });
  });

  it('expects every habit in a week without a target', () => {
    const budget = new Habit(5, HabitName.parse('Budget du jour'), day(10, 1));
    const history = [settings(budget, null), settings(budget, 7, day(10, 5))];

    expect(
      monthDayOf(day(10, 2), [budget], [checkIn(budget, day(10, 1))], history, day(10, 14)),
    ).toMatchObject({ doneCount: 0, expectedCount: 1 });
  });

  it('keeps upcoming and neutral days as they were', () => {
    expect(monthDayOf(day(10, 20), story, [], changes, friday16)).toMatchObject({
      kind: 'upcoming',
      doneCount: 0,
    });
    expect(monthDayOf(day(10, 4), story, [], changes, friday16)).toMatchObject({
      kind: 'neutral',
      expectedCount: 0,
    });
  });
});
