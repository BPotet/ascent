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
});
