import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import { Month } from '../month/Month';
import { Week } from '../week/Week';
import { History } from './History';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const habit = (id: number, createdOn: Day) =>
  new Habit(id, HabitName.parse(`Habitude ${id}`), createdOn);

const today = day(10, 14);
const currentWeek = Week.containing(today);
const currentMonth = Month.of(2026, 10);

describe('History', () => {
  describe('weeks (R22)', () => {
    it('without habit, is the current week only', () => {
      const history = History.of([], today);

      expect(history.firstWeek).toEqual(currentWeek);
      expect(history.currentWeek).toEqual(currentWeek);
      expect(history.canGoBefore(currentWeek)).toBe(false);
      expect(history.canGoAfter(currentWeek)).toBe(false);
    });

    it('starts with the week of the oldest day of creation among existing habits', () => {
      const history = History.of(
        [habit(1, day(10, 13)), habit(2, day(9, 30)), habit(3, day(10, 5))],
        today,
      );

      expect(history.firstWeek).toEqual(Week.containing(day(9, 28)));
      expect(history.currentWeek).toEqual(currentWeek);
    });

    it('goes back until the first week, not before', () => {
      const history = History.of([habit(1, day(10, 5))], today);

      expect(history.canGoBefore(currentWeek)).toBe(true);
      expect(history.canGoBefore(currentWeek.previous())).toBe(false);
      expect(history.canGoBefore(currentWeek.previous().previous())).toBe(false);
    });

    it('goes forward until the current week, not beyond', () => {
      const history = History.of([habit(1, day(9, 1))], today);

      expect(history.canGoAfter(currentWeek.previous())).toBe(true);
      expect(history.canGoAfter(currentWeek)).toBe(false);
      expect(history.canGoAfter(currentWeek.next())).toBe(false);
    });

    it('is the current week only when every habit was created this week', () => {
      const history = History.of([habit(1, day(10, 12)), habit(2, today)], today);

      expect(history.firstWeek).toEqual(currentWeek);
      expect(history.canGoBefore(currentWeek)).toBe(false);
    });

    it('is the current week only when the clock went back before every day of creation (R7)', () => {
      const history = History.of([habit(1, day(10, 21))], today);

      expect(history.firstWeek).toEqual(currentWeek);
      expect(history.canGoAfter(currentWeek)).toBe(false);
    });

    it('keeps a consultable week as it is', () => {
      const history = History.of([habit(1, day(9, 1))], today);

      expect(history.weekWithin(currentWeek.previous())).toEqual(currentWeek.previous());
      expect(history.weekWithin(history.firstWeek)).toEqual(history.firstWeek);
      expect(history.weekWithin(currentWeek)).toEqual(currentWeek);
    });

    it('brings a week outside the history back to its closest consultable week', () => {
      const history = History.of([habit(1, day(10, 5))], today);

      expect(history.weekWithin(Week.containing(day(9, 1)))).toEqual(history.firstWeek);
      expect(history.weekWithin(currentWeek.next())).toEqual(currentWeek);
    });
  });

  describe('months (R22)', () => {
    it('without habit, is the current month only', () => {
      const history = History.of([], today);

      expect(history.firstMonth).toEqual(currentMonth);
      expect(history.currentMonth).toEqual(currentMonth);
      expect(history.canGoBeforeMonth(currentMonth)).toBe(false);
      expect(history.canGoAfterMonth(currentMonth)).toBe(false);
    });

    it('starts with the month of the oldest day of creation among existing habits', () => {
      const history = History.of(
        [habit(1, day(10, 13)), habit(2, day(9, 21)), habit(3, day(10, 5))],
        today,
      );

      expect(history.firstMonth).toEqual(Month.of(2026, 9));
      expect(history.currentMonth).toEqual(currentMonth);
    });

    it('goes back until the first month, not before', () => {
      const history = History.of([habit(1, day(9, 21))], today);

      expect(history.canGoBeforeMonth(currentMonth)).toBe(true);
      expect(history.canGoBeforeMonth(Month.of(2026, 9))).toBe(false);
      expect(history.canGoBeforeMonth(Month.of(2026, 8))).toBe(false);
    });

    it('goes forward until the current month, not beyond', () => {
      const history = History.of([habit(1, Day.of(2025, 12, 31))], today);

      expect(history.firstMonth).toEqual(Month.of(2025, 12));
      expect(history.canGoAfterMonth(Month.of(2026, 9))).toBe(true);
      expect(history.canGoAfterMonth(currentMonth)).toBe(false);
      expect(history.canGoAfterMonth(Month.of(2026, 11))).toBe(false);
    });

    it('is the current month only when every habit was created this month', () => {
      const history = History.of([habit(1, day(10, 1)), habit(2, today)], today);

      expect(history.firstMonth).toEqual(currentMonth);
      expect(history.canGoBeforeMonth(currentMonth)).toBe(false);
    });

    it('is the current month only when the clock went back before every day of creation (R7)', () => {
      const history = History.of([habit(1, day(11, 2))], today);

      expect(history.firstMonth).toEqual(currentMonth);
      expect(history.canGoAfterMonth(currentMonth)).toBe(false);
    });

    it('keeps a consultable month as it is', () => {
      const history = History.of([habit(1, day(8, 15))], today);

      expect(history.monthWithin(Month.of(2026, 9))).toEqual(Month.of(2026, 9));
      expect(history.monthWithin(Month.of(2026, 8))).toEqual(Month.of(2026, 8));
      expect(history.monthWithin(currentMonth)).toEqual(currentMonth);
    });

    it('brings a month outside the history back to its closest consultable month', () => {
      const history = History.of([habit(1, day(9, 21))], today);

      expect(history.monthWithin(Month.of(2026, 8))).toEqual(Month.of(2026, 9));
      expect(history.monthWithin(Month.of(2026, 11))).toEqual(currentMonth);
    });
  });
});
