import { Day, InvalidDayError } from './Day';

describe('Day', () => {
  describe('of', () => {
    it('creates a day from its year, month and day of month', () => {
      const day = Day.of(2026, 10, 14);

      expect(day.year).toBe(2026);
      expect(day.month).toBe(10);
      expect(day.dayOfMonth).toBe(14);
    });

    it.each([
      [2026, 1, 31],
      [2026, 4, 30],
      [2024, 2, 29],
      [2000, 2, 29],
      [1, 1, 1],
      [9999, 12, 31],
    ])('accepts %i-%i-%i', (year, month, dayOfMonth) => {
      expect(Day.of(year, month, dayOfMonth)).toEqual(
        expect.objectContaining({ year, month, dayOfMonth }),
      );
    });

    it.each([
      [0, 1, 1],
      [10000, 1, 1],
      [2026.5, 1, 1],
      [2026, 0, 1],
      [2026, 13, 1],
      [2026, 1.5, 1],
      [2026, 1, 0],
      [2026, 1, 32],
      [2026, 4, 31],
      [2026, 6, 31],
      [2026, 9, 31],
      [2026, 11, 31],
      [2026, 2, 29],
      [1900, 2, 29],
      [2024, 2, 30],
      [2026, 1, 1.5],
    ])('rejects %d-%d-%d', (year, month, dayOfMonth) => {
      expect(() => Day.of(year, month, dayOfMonth)).toThrow(InvalidDayError);
    });

    it('explains which part is invalid', () => {
      expect(() => Day.of(2026, 13, 1)).toThrow('Invalid day: month 13');
      expect(() => Day.of(0, 1, 1)).toThrow('Invalid day: year 0');
      expect(() => Day.of(2026, 2, 30)).toThrow('Invalid day: 2026-02-30');
    });

    it('names its error', () => {
      expect(() => Day.of(2026, 2, 30)).toThrow(
        expect.objectContaining({ name: 'InvalidDayError' }),
      );
    });
  });

  describe('fromLocalDate', () => {
    it('uses the local calendar date of the instant', () => {
      expect(Day.fromLocalDate(new Date(2026, 9, 14, 0, 0, 0))).toEqual(Day.of(2026, 10, 14));
      expect(Day.fromLocalDate(new Date(2026, 9, 14, 23, 59, 59))).toEqual(Day.of(2026, 10, 14));
      expect(Day.fromLocalDate(new Date(2026, 0, 1, 12))).toEqual(Day.of(2026, 1, 1));
      expect(Day.fromLocalDate(new Date(2026, 11, 31, 12))).toEqual(Day.of(2026, 12, 31));
    });
  });

  describe('toIsoString', () => {
    it.each([
      [Day.of(2026, 10, 14), '2026-10-14'],
      [Day.of(2026, 1, 5), '2026-01-05'],
      [Day.of(1, 1, 1), '0001-01-01'],
      [Day.of(9999, 12, 31), '9999-12-31'],
    ])('writes %o as %s', (day, iso) => {
      expect(day.toIsoString()).toBe(iso);
    });
  });

  describe('fromIsoString', () => {
    it('reads a day written by toIsoString', () => {
      expect(Day.fromIsoString('2026-10-14')).toEqual(Day.of(2026, 10, 14));
      expect(Day.fromIsoString('0001-01-05')).toEqual(Day.of(1, 1, 5));
      expect(Day.fromIsoString(Day.of(2024, 2, 29).toIsoString())).toEqual(Day.of(2024, 2, 29));
    });

    it.each([
      '2026-10-1',
      '2026-10-14T00:00',
      ' 2026-10-14',
      '20261014',
      '2026/10/14',
      'x2026-10-14',
      '',
    ])('rejects the malformed text %p', (text) => {
      expect(() => Day.fromIsoString(text)).toThrow(new InvalidDayError(`"${text}"`));
    });

    it('rejects a date that does not exist', () => {
      expect(() => Day.fromIsoString('2026-02-30')).toThrow(InvalidDayError);
    });
  });

  describe('comparison', () => {
    const day = Day.of(2026, 10, 14);

    it('equals the same date only', () => {
      expect(day.equals(Day.of(2026, 10, 14))).toBe(true);
      expect(day.equals(Day.of(2026, 10, 15))).toBe(false);
      expect(day.equals(Day.of(2026, 11, 14))).toBe(false);
      expect(day.equals(Day.of(2025, 10, 14))).toBe(false);
    });

    it.each([
      [Day.of(2026, 10, 13), 1],
      [Day.of(2026, 10, 14), 0],
      [Day.of(2026, 10, 15), -1],
      [Day.of(2026, 9, 30), 1],
      [Day.of(2026, 11, 1), -1],
      [Day.of(2025, 12, 31), 1],
      [Day.of(2027, 1, 1), -1],
    ])('compares 2026-10-14 with %o', (other, sign) => {
      expect(Math.sign(day.compareTo(other))).toBe(sign);
    });

    it('is after an earlier day only', () => {
      expect(day.isAfter(Day.of(2026, 10, 13))).toBe(true);
      expect(day.isAfter(Day.of(2026, 10, 14))).toBe(false);
      expect(day.isAfter(Day.of(2026, 10, 15))).toBe(false);
    });

    it('is before a later day only', () => {
      expect(day.isBefore(Day.of(2026, 10, 15))).toBe(true);
      expect(day.isBefore(Day.of(2026, 10, 14))).toBe(false);
      expect(day.isBefore(Day.of(2026, 10, 13))).toBe(false);
    });
  });

  describe('plusDays', () => {
    it.each([
      [Day.of(2026, 10, 14), 1, Day.of(2026, 10, 15)],
      [Day.of(2026, 10, 14), 0, Day.of(2026, 10, 14)],
      [Day.of(2026, 10, 14), -2, Day.of(2026, 10, 12)],
      [Day.of(2026, 10, 31), 1, Day.of(2026, 11, 1)],
      [Day.of(2026, 3, 1), -1, Day.of(2026, 2, 28)],
      [Day.of(2024, 2, 28), 1, Day.of(2024, 2, 29)],
      [Day.of(2026, 12, 29), 6, Day.of(2027, 1, 4)],
      [Day.of(2027, 1, 1), -4, Day.of(2026, 12, 28)],
      [Day.of(2026, 3, 29), 1, Day.of(2026, 3, 30)],
      [Day.of(2026, 10, 25), 1, Day.of(2026, 10, 26)],
      [Day.of(2026, 1, 1), 365, Day.of(2027, 1, 1)],
      [Day.of(1, 1, 7), -6, Day.of(1, 1, 1)],
      [Day.of(99, 12, 31), 1, Day.of(100, 1, 1)],
      [Day.of(9999, 12, 25), 6, Day.of(9999, 12, 31)],
    ])('moves %o by %i days to %o', (day, days, expected) => {
      expect(day.plusDays(days)).toEqual(expected);
    });

    it('rejects a number of days that is not whole', () => {
      expect(() => Day.of(2026, 10, 14).plusDays(1.5)).toThrow(
        new InvalidDayError('2026-10-14 plus 1.5 days'),
      );
    });

    it('rejects a day outside the calendar', () => {
      expect(() => Day.of(9999, 12, 31).plusDays(1)).toThrow(InvalidDayError);
      expect(() => Day.of(1, 1, 1).plusDays(-1)).toThrow(InvalidDayError);
    });
  });

  describe('dayOfWeek', () => {
    it.each([
      [Day.of(2026, 10, 12), 1],
      [Day.of(2026, 10, 13), 2],
      [Day.of(2026, 10, 14), 3],
      [Day.of(2026, 10, 15), 4],
      [Day.of(2026, 10, 16), 5],
      [Day.of(2026, 10, 17), 6],
      [Day.of(2026, 10, 18), 7],
      [Day.of(2026, 12, 29), 2],
      [Day.of(2024, 2, 29), 4],
      [Day.of(1, 1, 1), 1],
      [Day.of(50, 6, 15), 3],
      [Day.of(9999, 12, 31), 5],
    ])('numbers %o as day %i, from 1 (Monday) to 7 (Sunday)', (day, dayOfWeek) => {
      expect(day.dayOfWeek).toBe(dayOfWeek);
    });
  });
});
