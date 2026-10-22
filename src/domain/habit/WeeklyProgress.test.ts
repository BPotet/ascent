import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Week } from '../week/Week';
import { isTargetReached, weeklyProgressOf } from './WeeklyProgress';

const day = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const checkIn = (dayOfMonth: number, done = true, corrected = false): CheckIn => ({
  habitId: 1,
  day: day(dayOfMonth),
  done,
  corrected,
});

// Semaine du lundi 12 au dimanche 18 octobre 2026.
const week = Week.containing(day(14));

describe('weeklyProgressOf', () => {
  it('counts the cases « fait » of the week, up to the given day (R5)', () => {
    const checkIns = [checkIn(12), checkIn(14), checkIn(16)];

    expect(weeklyProgressOf(checkIns, week, day(16))).toBe(3);
    expect(weeklyProgressOf(checkIns, week, day(15))).toBe(2);
    expect(weeklyProgressOf(checkIns, week, day(14))).toBe(2);
    expect(weeklyProgressOf(checkIns, week, day(13))).toBe(1);
    expect(weeklyProgressOf(checkIns, week, day(12))).toBe(1);
  });

  it('counts the whole week when the given day is after it', () => {
    const checkIns = [checkIn(12), checkIn(18)];

    expect(weeklyProgressOf(checkIns, week, day(25))).toBe(2);
  });

  it('counts nothing when the given day is before the week', () => {
    expect(weeklyProgressOf([checkIn(12)], week, day(11))).toBe(0);
  });

  it('leaves out the other weeks, on both sides', () => {
    const checkIns = [checkIn(11), checkIn(12), checkIn(18), checkIn(19)];

    expect(weeklyProgressOf(checkIns, week, day(25))).toBe(2);
  });

  it('does not count a corrected « pas fait », and counts a corrected « fait »', () => {
    const checkIns = [checkIn(12, false, true), checkIn(13, true, true)];

    expect(weeklyProgressOf(checkIns, week, day(14))).toBe(1);
  });

  it('is 0 without any check-in', () => {
    expect(weeklyProgressOf([], week, day(14))).toBe(0);
  });
});

describe('isTargetReached', () => {
  it('is reached when the progress equals the target of the week (R7)', () => {
    expect(isTargetReached(3, 3)).toBe(true);
  });

  it('stays reached above the target (R7, « 4/3 »)', () => {
    expect(isTargetReached(4, 3)).toBe(true);
  });

  it('is not reached below the target', () => {
    expect(isTargetReached(2, 3)).toBe(false);
    expect(isTargetReached(0, 1)).toBe(false);
  });

  it('is never reached by a week without a target (R17)', () => {
    expect(isTargetReached(0, null)).toBe(false);
    expect(isTargetReached(7, null)).toBe(false);
  });
});

describe('weeklyProgressOf across the calendar edges', () => {
  const at = (year: number, month: number, dayOfMonth: number): CheckIn => ({
    habitId: 1,
    day: Day.of(year, month, dayOfMonth),
    done: true,
    corrected: false,
  });

  it('counts a week that changes year, from Monday 28 December to Sunday 3 January', () => {
    const yearEndWeek = Week.containing(Day.of(2026, 12, 31));
    const checkIns = [
      at(2026, 12, 27),
      at(2026, 12, 28),
      at(2026, 12, 31),
      at(2027, 1, 1),
      at(2027, 1, 3),
      at(2027, 1, 4),
      // Même jour et même mois, une autre année : hors de la semaine.
      at(2025, 12, 31),
      at(2028, 1, 1),
    ];

    expect(weeklyProgressOf(checkIns, yearEndWeek, Day.of(2026, 12, 31))).toBe(2);
    expect(weeklyProgressOf(checkIns, yearEndWeek, Day.of(2027, 1, 1))).toBe(3);
    expect(weeklyProgressOf(checkIns, yearEndWeek, Day.of(2027, 1, 3))).toBe(4);
    expect(weeklyProgressOf(checkIns, yearEndWeek, Day.of(2027, 1, 4))).toBe(4);
  });

  it('counts the seven days of a week with a change of hour, the 25-hour Sunday included', () => {
    const weekOfWinterTime = Week.containing(Day.of(2026, 10, 25));
    const checkIns = [19, 20, 21, 22, 23, 24, 25, 26].map((dayOfMonth) => at(2026, 10, dayOfMonth));

    expect(weeklyProgressOf(checkIns, weekOfWinterTime, Day.of(2026, 10, 25))).toBe(7);
    expect(weeklyProgressOf(checkIns, weekOfWinterTime, Day.of(2026, 10, 24))).toBe(6);
    expect(isTargetReached(7, 7)).toBe(true);
  });
});
