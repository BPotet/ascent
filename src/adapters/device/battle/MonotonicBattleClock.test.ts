import { MonotonicBattleClock } from './MonotonicBattleClock';

describe('MonotonicBattleClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the monotonic clock of the JS thread', () => {
    const clock = new MonotonicBattleClock();
    const start = clock.now();

    jest.advanceTimersByTime(250);

    expect(clock.now()).toBe(start + 250);
    expect(clock.now()).toBe(performance.now());
  });

  it('calls a timer once, at its instant', () => {
    const clock = new MonotonicBattleClock();
    const callback = jest.fn();
    clock.setTimer(clock.now() + 100, callback);

    jest.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls a timer whose instant has passed right away', () => {
    const clock = new MonotonicBattleClock();
    const callback = jest.fn();
    clock.setTimer(clock.now() - 50, callback);

    jest.advanceTimersByTime(0);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels a timer', () => {
    const clock = new MonotonicBattleClock();
    const callback = jest.fn();
    const cancel = clock.setTimer(clock.now() + 100, callback);

    cancel();
    jest.advanceTimersByTime(200);

    expect(callback).not.toHaveBeenCalled();
  });
});
