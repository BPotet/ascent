import { Day } from '../day/Day';
import { Month } from './Month';

const isoOf = (days: readonly (Day | null)[]) => days.map((day) => day?.toIsoString() ?? null);

describe('Month (R3)', () => {
  it('is the calendar month that contains a day', () => {
    const month = Month.containing(Day.of(2026, 10, 14));

    expect([month.year, month.month]).toEqual([2026, 10]);
    expect(month.start).toEqual(Day.of(2026, 10, 1));
    expect(month.end).toEqual(Day.of(2026, 10, 31));
  });

  it('refuses a month that does not exist', () => {
    expect(() => Month.of(2026, 0)).toThrow('Invalid day');
    expect(() => Month.of(2026, 13)).toThrow('Invalid day');
  });

  it.each([
    [2026, 10, 31],
    [2026, 9, 30],
    [2026, 2, 28],
    [2028, 2, 29],
  ])('lists every day of %i-%i, %i days, from the 1st', (year, month, length) => {
    const days = Month.of(year, month).days();

    expect(days).toHaveLength(length);
    expect(days[0]).toEqual(Day.of(year, month, 1));
    expect(days.at(-1)).toEqual(Day.of(year, month, length));
    expect(days.every((day, index) => day.dayOfMonth === index + 1 && day.month === month)).toBe(
      true,
    );
  });

  it('lays its weeks out from Monday to Sunday, blank before the 1st and after the last day', () => {
    const weeks = Month.of(2026, 10).weeks();

    expect(weeks.map(isoOf)).toEqual([
      [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
      [
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ],
      [
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
        '2026-10-15',
        '2026-10-16',
        '2026-10-17',
        '2026-10-18',
      ],
      [
        '2026-10-19',
        '2026-10-20',
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
      ],
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null],
    ]);
  });

  it('has no blank before a month that starts on a Monday', () => {
    const weeks = Month.of(2026, 6).weeks();

    expect(isoOf(weeks[0] ?? [])[0]).toBe('2026-06-01');
    expect(weeks).toHaveLength(5);
    expect(isoOf(weeks.at(-1) ?? [])).toEqual([
      '2026-06-29',
      '2026-06-30',
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('has six blanks before a month that starts on a Sunday, and six weeks when needed', () => {
    const weeks = Month.of(2026, 11).weeks();

    expect(isoOf(weeks[0] ?? [])).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks).toHaveLength(6);
    expect(isoOf(weeks.at(-1) ?? [])).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });

  it('fits a 28-day February starting on a Monday in four full weeks', () => {
    const weeks = Month.of(2027, 2).weeks();

    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((day) => day !== null)).toBe(true);
  });

  it('goes to the previous and next month across years', () => {
    expect(Month.of(2026, 1).previous()).toEqual(Month.of(2025, 12));
    expect(Month.of(2026, 10).previous()).toEqual(Month.of(2026, 9));
    expect(Month.of(2026, 12).next()).toEqual(Month.of(2027, 1));
    expect(Month.of(2026, 10).next()).toEqual(Month.of(2026, 11));
  });

  it('contains only its own days', () => {
    const month = Month.of(2026, 10);

    expect(month.contains(Day.of(2026, 10, 1))).toBe(true);
    expect(month.contains(Day.of(2026, 10, 31))).toBe(true);
    expect(month.contains(Day.of(2026, 9, 30))).toBe(false);
    expect(month.contains(Day.of(2026, 11, 1))).toBe(false);
    expect(month.contains(Day.of(2025, 10, 14))).toBe(false);
  });

  it('compares months in calendar order', () => {
    const october = Month.of(2026, 10);

    expect(october.equals(Month.of(2026, 10))).toBe(true);
    expect(october.equals(Month.of(2025, 10))).toBe(false);
    expect(october.equals(Month.of(2026, 9))).toBe(false);
    expect(october.isBefore(Month.of(2026, 11))).toBe(true);
    expect(october.isBefore(Month.of(2027, 1))).toBe(true);
    expect(october.isBefore(october)).toBe(false);
    expect(october.isBefore(Month.of(2026, 9))).toBe(false);
    expect(october.isAfter(Month.of(2026, 9))).toBe(true);
    expect(october.isAfter(Month.of(2025, 12))).toBe(true);
    expect(october.isAfter(october)).toBe(false);
    expect(october.isAfter(Month.of(2026, 11))).toBe(false);
  });
});
