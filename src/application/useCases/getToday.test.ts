import { Day } from '../../domain/day/Day';
import type { Clock } from '../ports/Clock';
import { getToday } from './getToday';

describe('getToday', () => {
  it('returns the day given by the clock', () => {
    const today = Day.of(2026, 10, 14);
    const clock: Clock = { today: () => today };

    expect(getToday(clock)).toBe(today);
  });
});
