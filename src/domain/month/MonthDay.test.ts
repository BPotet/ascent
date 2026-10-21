import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
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
  it('counts the habits « fait » among the habits active that day', () => {
    expect(monthDayOf(day(10, 12), habits, checkIns, today)).toMatchObject({
      kind: 'tracked',
      doneCount: 1,
      activeCount: 1,
    });
    expect(monthDayOf(day(10, 13), habits, checkIns, today)).toMatchObject({
      kind: 'tracked',
      doneCount: 2,
      activeCount: 2,
    });
    expect(monthDayOf(today, habits, checkIns, today)).toMatchObject({
      kind: 'tracked',
      doneCount: 0,
      activeCount: 2,
    });
  });

  it('gives the state of each active habit, in order of creation, and the habits created later apart', () => {
    const monday = monthDayOf(day(10, 12), habits, checkIns, today);

    expect(monday.day).toEqual(day(10, 12));
    expect(monday.habits.map(({ habit, status, editable }) => [habit, status, editable])).toEqual([
      [cooking, 'done', true],
    ]);
    expect(
      monday.notStartedHabits.map(({ habit, status, editable }) => [habit, status, editable]),
    ).toEqual([[budget, 'notStarted', false]]);

    const tuesday = monthDayOf(day(10, 13), habits, checkIns, today);
    expect(names(tuesday.habits)).toEqual(['Cuisiner', 'Budget du jour']);
    expect(tuesday.notStartedHabits).toEqual([]);
  });

  it('ignores the check-ins of other days', () => {
    const thursday = monthDayOf(day(10, 8), habits, checkIns, today);

    expect(thursday).toMatchObject({ doneCount: 0, activeCount: 1 });
    expect(thursday.habits.map(({ status }) => status)).toEqual(['missed']);
  });

  it('is neutral without any active habit: nothing to count nor to correct', () => {
    const neutral = monthDayOf(day(10, 4), habits, checkIns, today);

    expect(neutral).toMatchObject({ kind: 'neutral', doneCount: 0, activeCount: 0 });
    expect(neutral.habits).toEqual([]);
    expect(names(neutral.notStartedHabits)).toEqual(['Cuisiner', 'Budget du jour']);
    expect(monthDayOf(today, [], [], today)).toMatchObject({ kind: 'neutral', activeCount: 0 });
  });

  it('is upcoming after today, with nothing changeable', () => {
    const upcoming = monthDayOf(day(10, 15), habits, checkIns, today);

    expect(upcoming).toMatchObject({ kind: 'upcoming', doneCount: 0, activeCount: 2 });
    expect(upcoming.habits.map(({ status, editable }) => [status, editable])).toEqual([
      ['upcoming', false],
      ['upcoming', false],
    ]);
    expect(monthDayOf(day(10, 15), [], [], today).kind).toBe('upcoming');
  });

  it('counts a check-in dated in the future after the clock went back, still upcoming (R7)', () => {
    const later = monthDayOf(day(10, 15), habits, [checkIn(cooking, day(10, 15))], today);

    expect(later).toMatchObject({ kind: 'upcoming', doneCount: 1, activeCount: 2 });
  });

  it('marks a closed day with at least one corrected habit day (R13, Q2)', () => {
    const corrections = [checkIn(cooking, day(10, 8), true, true)];

    expect(monthDayOf(day(10, 8), habits, corrections, today).corrected).toBe(true);
    expect(monthDayOf(day(10, 9), habits, corrections, today).corrected).toBe(false);
    expect(
      monthDayOf(day(10, 12), habits, [checkIn(cooking, day(10, 12), false, true)], today),
    ).toMatchObject({ corrected: true, doneCount: 0 });
  });

  it('shows no mark « corrigé » today', () => {
    const marked = [checkIn(cooking, today, true, true)];

    expect(monthDayOf(today, habits, marked, today)).toMatchObject({
      corrected: false,
      doneCount: 1,
    });
  });

  it('knows whether the day is today', () => {
    expect(monthDayOf(today, habits, checkIns, today).isToday).toBe(true);
    expect(monthDayOf(day(10, 13), habits, checkIns, today).isToday).toBe(false);
    expect(monthDayOf(day(10, 15), habits, checkIns, today).isToday).toBe(false);
  });
});
