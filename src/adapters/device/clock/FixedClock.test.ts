import { Day } from '../../../domain/day/Day';
import { FixedClock } from './FixedClock';

describe('FixedClock', () => {
  const wednesday = Day.of(2026, 10, 14);
  const thursday = Day.of(2026, 10, 15);

  it('gives the chosen day until it is moved', () => {
    const clock = new FixedClock(wednesday);
    expect(clock.today()).toBe(wednesday);

    clock.setToday(thursday);

    expect(clock.today()).toBe(thursday);
  });

  it('tells every listener the new day when it is moved', () => {
    const clock = new FixedClock(wednesday);
    const first = jest.fn();
    const second = jest.fn();
    clock.onTodayChange(first);
    clock.onTodayChange(second);

    clock.setToday(thursday);

    expect(first).toHaveBeenCalledWith(thursday);
    expect(second).toHaveBeenCalledWith(thursday);
  });

  it('tells nothing when the day does not change', () => {
    const clock = new FixedClock(wednesday);
    const listener = jest.fn();
    clock.onTodayChange(listener);

    clock.setToday(Day.of(2026, 10, 14));

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener once unsubscribed', () => {
    const clock = new FixedClock(wednesday);
    const kept = jest.fn();
    const removed = jest.fn();
    clock.onTodayChange(kept);
    const unsubscribe = clock.onTodayChange(removed);

    unsubscribe();
    clock.setToday(thursday);

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });
});
