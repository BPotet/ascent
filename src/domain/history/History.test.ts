import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import { Week } from '../week/Week';
import { History } from './History';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const habit = (id: number, createdOn: Day) =>
  new Habit(id, HabitName.parse(`Habitude ${id}`), createdOn);

const today = day(10, 14);
const currentWeek = Week.containing(today);

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
});
