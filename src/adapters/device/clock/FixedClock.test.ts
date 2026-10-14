import { Day } from '../../../domain/day/Day';
import { FixedClock } from './FixedClock';

describe('FixedClock', () => {
  it('gives the chosen day until it is moved', () => {
    const first = Day.of(2026, 10, 14);
    const next = Day.of(2026, 10, 15);
    const clock = new FixedClock(first);
    expect(clock.today()).toBe(first);

    clock.setToday(next);

    expect(clock.today()).toBe(next);
  });
});
