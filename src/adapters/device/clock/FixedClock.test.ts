import { Day } from '../../../domain/day/Day';
import { FixedClock } from './FixedClock';

describe('FixedClock', () => {
  it('gives the chosen day until it is moved', () => {
    const clock = new FixedClock(Day.of(2026, 10, 14));
    expect(clock.today().toIso()).toBe('2026-10-14');

    clock.setToday(Day.of(2026, 10, 15));

    expect(clock.today().toIso()).toBe('2026-10-15');
  });
});
