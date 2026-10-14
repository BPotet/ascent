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
      expect(Day.of(year, month, dayOfMonth).toIso()).toBe(
        `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
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

  describe('fromIso', () => {
    it('parses an ISO calendar date', () => {
      expect(Day.fromIso('2026-10-14').equals(Day.of(2026, 10, 14))).toBe(true);
    });

    it.each([
      '',
      '2026-10-1',
      '2026/10/14',
      ' 2026-10-14',
      '2026-10-14 ',
      '2026-02-30',
      'abcd-ef-gh',
    ])('rejects "%s"', (iso) => {
      expect(() => Day.fromIso(iso)).toThrow(InvalidDayError);
    });

    it('quotes the rejected text', () => {
      expect(() => Day.fromIso('nope')).toThrow('Invalid day: "nope"');
    });
  });

  describe('fromLocalDate', () => {
    it('uses the local calendar date of the instant', () => {
      expect(Day.fromLocalDate(new Date(2026, 9, 14, 0, 0, 0)).toIso()).toBe('2026-10-14');
      expect(Day.fromLocalDate(new Date(2026, 9, 14, 23, 59, 59)).toIso()).toBe('2026-10-14');
      expect(Day.fromLocalDate(new Date(2026, 0, 1, 12)).toIso()).toBe('2026-01-01');
      expect(Day.fromLocalDate(new Date(2026, 11, 31, 12)).toIso()).toBe('2026-12-31');
    });
  });

  describe('toIso', () => {
    it('pads every part', () => {
      expect(Day.of(987, 3, 5).toIso()).toBe('0987-03-05');
      expect(Day.of(2026, 10, 14).toString()).toBe('2026-10-14');
    });
  });

  describe('comparison', () => {
    const earlier = Day.of(2026, 10, 13);
    const day = Day.of(2026, 10, 14);

    it('compares days chronologically', () => {
      expect(earlier.isBefore(day)).toBe(true);
      expect(day.isBefore(earlier)).toBe(false);
      expect(day.isBefore(Day.of(2026, 10, 14))).toBe(false);
      expect(day.isAfter(earlier)).toBe(true);
      expect(earlier.isAfter(day)).toBe(false);
      expect(day.isAfter(Day.of(2026, 10, 14))).toBe(false);
    });

    it('orders by year, then month, then day of month', () => {
      expect(Day.of(2025, 12, 31).compareTo(Day.of(2026, 1, 1))).toBeLessThan(0);
      expect(Day.of(2026, 9, 30).compareTo(Day.of(2026, 10, 1))).toBeLessThan(0);
      expect(Day.of(2026, 10, 2).compareTo(Day.of(2026, 10, 1))).toBeGreaterThan(0);
      expect(Day.of(2027, 1, 1).compareTo(Day.of(2026, 12, 31))).toBeGreaterThan(0);
      expect(Day.of(2026, 11, 1).compareTo(Day.of(2026, 10, 31))).toBeGreaterThan(0);
      expect(day.compareTo(Day.of(2026, 10, 14))).toBe(0);
    });

    it('considers two days with the same date equal', () => {
      expect(day.equals(Day.fromIso('2026-10-14'))).toBe(true);
      expect(day.equals(earlier)).toBe(false);
    });
  });
});
