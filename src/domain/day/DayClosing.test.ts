import { Day } from './Day';
import { isClosedDay } from './DayClosing';

describe('isClosedDay', () => {
  const today = Day.of(2026, 10, 14);

  it('closes every day before today, from midnight local time (R4)', () => {
    expect(isClosedDay(Day.of(2026, 10, 13), today)).toBe(true);
    expect(isClosedDay(Day.of(2025, 12, 31), today)).toBe(true);
  });

  it('keeps today open', () => {
    expect(isClosedDay(today, today)).toBe(false);
  });

  it('does not close a day after today, which is « à venir » (R7)', () => {
    expect(isClosedDay(Day.of(2026, 10, 15), today)).toBe(false);
  });
});
