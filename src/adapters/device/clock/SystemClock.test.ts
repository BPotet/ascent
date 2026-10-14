import { SystemClock } from './SystemClock';

describe('SystemClock', () => {
  it('gives the local calendar date of the current instant', () => {
    const clock = new SystemClock(() => new Date(2026, 9, 14, 23, 59));

    expect(clock.today().toIso()).toBe('2026-10-14');
  });

  it('reads the time again at each call', () => {
    let now = new Date(2026, 9, 14, 23, 59);
    const clock = new SystemClock(() => now);
    clock.today();

    now = new Date(2026, 9, 15, 0, 0);

    expect(clock.today().toIso()).toBe('2026-10-15');
  });

  it('uses the phone time by default', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 8, 30) });
    try {
      expect(new SystemClock().today().toIso()).toBe('2026-10-14');
    } finally {
      jest.useRealTimers();
    }
  });
});
