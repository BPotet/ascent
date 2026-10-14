import { Day } from '../day/Day';
import { Week } from './Week';

const day = (month: number, dayOfMonth: number, year = 2026) => Day.of(year, month, dayOfMonth);

describe('Week', () => {
  describe('containing', () => {
    it.each([
      ['Monday', day(10, 12)],
      ['Wednesday', day(10, 14)],
      ['Sunday', day(10, 18)],
    ])('goes from Monday to Sunday around a %s (R3)', (_, today) => {
      const week = Week.containing(today);

      expect(week.start).toEqual(day(10, 12));
      expect(week.end).toEqual(day(10, 18));
    });

    it('can start in one month and end in the next', () => {
      const week = Week.containing(day(10, 1));

      expect([week.start, week.end]).toEqual([day(9, 28), day(10, 4)]);
    });

    it('can start in one year and end in the next (week of 29 December)', () => {
      const week = Week.containing(day(12, 29));

      expect([week.start, week.end]).toEqual([day(12, 28), day(1, 3, 2027)]);
      expect(Week.containing(day(1, 3, 2027))).toEqual(week);
    });

    it('is the same week for every day from Monday to Sunday', () => {
      const week = Week.containing(day(10, 12));

      expect(week.days().map((each) => Week.containing(each))).toEqual(Array(7).fill(week));
    });
  });

  describe('days', () => {
    it('lists the 7 days from Monday to Sunday', () => {
      expect(Week.containing(day(12, 31)).days()).toEqual([
        day(12, 28),
        day(12, 29),
        day(12, 30),
        day(12, 31),
        day(1, 1, 2027),
        day(1, 2, 2027),
        day(1, 3, 2027),
      ]);
    });
  });

  describe('contains', () => {
    const week = Week.containing(day(10, 14));

    it('contains its days only', () => {
      expect(week.contains(day(10, 12))).toBe(true);
      expect(week.contains(day(10, 18))).toBe(true);
      expect(week.contains(day(10, 11))).toBe(false);
      expect(week.contains(day(10, 19))).toBe(false);
    });
  });

  describe('previous and next', () => {
    const week = Week.containing(day(10, 14));

    it('goes back to the week before', () => {
      expect(week.previous()).toEqual(Week.containing(day(10, 5)));
    });

    it('goes on to the week after', () => {
      expect(week.next()).toEqual(Week.containing(day(10, 19)));
      expect(Week.containing(day(12, 22)).next()).toEqual(Week.containing(day(1, 1, 2027)));
    });
  });

  describe('comparison', () => {
    const week = Week.containing(day(10, 14));

    it('equals the week that has the same days only', () => {
      expect(week.equals(Week.containing(day(10, 18)))).toBe(true);
      expect(week.equals(week.next())).toBe(false);
      expect(week.equals(week.previous())).toBe(false);
    });

    it('is before a later week only', () => {
      expect(week.isBefore(week.next())).toBe(true);
      expect(week.isBefore(week)).toBe(false);
      expect(week.isBefore(week.previous())).toBe(false);
    });

    it('is after an earlier week only', () => {
      expect(week.isAfter(week.previous())).toBe(true);
      expect(week.isAfter(week)).toBe(false);
      expect(week.isAfter(week.next())).toBe(false);
    });
  });
});
