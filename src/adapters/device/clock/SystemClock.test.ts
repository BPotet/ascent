import { Day } from '../../../domain/day/Day';
import {
  type AppVisibility,
  MAX_TIMER_DELAY_MS,
  nextLocalMidnight,
  RECHECK_INTERVAL_MS,
  SystemClock,
} from './SystemClock';

const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

/** Une visibilité de l'application pilotée par le test (le mobile la branche sur `AppState`). */
function controlledVisibility(visible = true) {
  const listeners = new Set<(visible: boolean) => void>();
  const visibility: AppVisibility & { set(visible: boolean): void; listenerCount(): number } = {
    isVisible: () => visible,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      visible = next;
      listeners.forEach((listener) => listener(next));
    },
    listenerCount: () => listeners.size,
  };
  return visibility;
}

describe('SystemClock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('today', () => {
    it('gives the local calendar date of the current instant', () => {
      const clock = new SystemClock(() => new Date(2026, 9, 14, 23, 59));

      expect(clock.today()).toEqual(wednesday);
    });

    it('reads the time again at each call', () => {
      let now = new Date(2026, 9, 14, 23, 59);
      const clock = new SystemClock(() => now);
      clock.today();

      now = new Date(2026, 9, 15, 0, 0);

      expect(clock.today()).toEqual(thursday);
    });

    it('uses the phone time by default', () => {
      jest.useFakeTimers({ now: new Date(2026, 9, 14, 8, 30) });

      expect(new SystemClock().today()).toEqual(wednesday);
    });
  });

  describe('onTodayChange', () => {
    const at = (date: Date) => {
      jest.useFakeTimers({ now: date });
    };

    it('tells the new day at local midnight', () => {
      at(new Date(2026, 9, 14, 23, 59));
      const listener = jest.fn();
      new SystemClock().onTodayChange(listener);

      jest.advanceTimersByTime(59_999);
      expect(listener).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(thursday);
    });

    it('tells every following midnight, once each', () => {
      at(new Date(2026, 9, 14, 12, 0));
      const listener = jest.fn();
      new SystemClock(undefined, controlledVisibility(false)).onTodayChange(listener);

      jest.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);

      expect(listener.mock.calls).toEqual([
        [thursday],
        [Day.of(2026, 10, 16)],
        [Day.of(2026, 10, 17)],
      ]);
    });

    it('never waits more than an hour before reading the time again', () => {
      at(new Date(2026, 9, 14, 0, 0));
      const listener = jest.fn();
      new SystemClock(undefined, controlledVisibility(false)).onTodayChange(listener);

      expect(jest.getTimerCount()).toBe(1);
      jest.setSystemTime(new Date(2026, 9, 16, 9, 0));
      jest.advanceTimersByTime(MAX_TIMER_DELAY_MS);

      expect(listener).toHaveBeenCalledWith(Day.of(2026, 10, 16));
    });

    it('waits again when a timer fires a little before midnight', () => {
      let now = new Date(2026, 9, 14, 23, 0);
      jest.useFakeTimers({ now });
      const listener = jest.fn();
      new SystemClock(() => now, controlledVisibility(false)).onTodayChange(listener);

      now = new Date(2026, 9, 14, 23, 59, 59, 990);
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(listener).not.toHaveBeenCalled();

      now = new Date(2026, 9, 15, 0, 0, 0, 0);
      jest.advanceTimersByTime(10);
      expect(listener).toHaveBeenCalledWith(thursday);
    });

    it('tells the new day when the app comes back to the foreground on another day', () => {
      at(new Date(2026, 9, 14, 22, 0));
      const visibility = controlledVisibility();
      const listener = jest.fn();
      new SystemClock(undefined, visibility).onTodayChange(listener);
      visibility.set(false);

      jest.setSystemTime(new Date(2026, 9, 15, 9, 0));
      visibility.set(true);

      expect(listener).toHaveBeenCalledWith(thursday);
    });

    it('tells nothing when the app comes back on the same day', () => {
      at(new Date(2026, 9, 14, 8, 0));
      const visibility = controlledVisibility();
      const listener = jest.fn();
      new SystemClock(undefined, visibility).onTodayChange(listener);

      visibility.set(false);
      jest.setSystemTime(new Date(2026, 9, 14, 9, 0));
      visibility.set(true);

      expect(listener).not.toHaveBeenCalled();
    });

    it('reads the time every 30 s while visible, to catch a time zone change', () => {
      let now = new Date(2026, 9, 15, 0, 30);
      jest.useFakeTimers({ now });
      const listener = jest.fn();
      new SystemClock(() => now, controlledVisibility()).onTodayChange(listener);

      now = new Date(2026, 9, 14, 23, 30);
      jest.advanceTimersByTime(RECHECK_INTERVAL_MS - 1);
      expect(listener).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(wednesday);
    });

    it('does not read the time every 30 s while hidden', () => {
      let now = new Date(2026, 9, 15, 0, 30);
      jest.useFakeTimers({ now });
      const visibility = controlledVisibility();
      const listener = jest.fn();
      new SystemClock(() => now, visibility).onTodayChange(listener);
      visibility.set(false);

      now = new Date(2026, 9, 14, 23, 30);
      jest.advanceTimersByTime(10 * RECHECK_INTERVAL_MS);
      expect(listener).not.toHaveBeenCalled();

      visibility.set(true);
      expect(listener).toHaveBeenCalledWith(wednesday);
    });

    it('starts reading every 30 s when the app becomes visible', () => {
      let now = new Date(2026, 9, 15, 0, 30);
      jest.useFakeTimers({ now });
      const visibility = controlledVisibility(false);
      const listener = jest.fn();
      new SystemClock(() => now, visibility).onTodayChange(listener);
      visibility.set(true);

      now = new Date(2026, 9, 14, 23, 30);
      jest.advanceTimersByTime(RECHECK_INTERVAL_MS);

      expect(listener).toHaveBeenCalledWith(wednesday);
    });

    it('reads the time every 30 s when visible by default', () => {
      let now = new Date(2026, 9, 15, 0, 30);
      jest.useFakeTimers({ now });
      const listener = jest.fn();
      new SystemClock(() => now).onTodayChange(listener);

      now = new Date(2026, 9, 14, 23, 30);
      jest.advanceTimersByTime(RECHECK_INTERVAL_MS);

      expect(listener).toHaveBeenCalledWith(wednesday);
    });

    it('stops its timers once unsubscribed, with the default visibility', () => {
      at(new Date(2026, 9, 14, 23, 59));
      const listener = jest.fn();

      new SystemClock().onTodayChange(listener)();
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(listener).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('keeps a single 30 s reading when told twice that the app is visible', () => {
      at(new Date(2026, 9, 14, 8, 0));
      const visibility = controlledVisibility();
      new SystemClock(undefined, visibility).onTodayChange(jest.fn());

      visibility.set(true);
      visibility.set(true);

      expect(jest.getTimerCount()).toBe(2);
    });

    it('stops every timer and listener once unsubscribed', () => {
      at(new Date(2026, 9, 14, 23, 59));
      const visibility = controlledVisibility();
      const listener = jest.fn();
      const unsubscribe = new SystemClock(undefined, visibility).onTodayChange(listener);

      unsubscribe();
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      visibility.set(false);
      visibility.set(true);

      expect(listener).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expect(visibility.listenerCount()).toBe(0);
    });

    it('keeps subscriptions independent', () => {
      at(new Date(2026, 9, 14, 23, 59));
      const clock = new SystemClock(undefined, controlledVisibility(false));
      const kept = jest.fn();
      clock.onTodayChange(kept);
      clock.onTodayChange(jest.fn())();

      jest.advanceTimersByTime(60_000);

      expect(kept).toHaveBeenCalledWith(thursday);
    });
  });
});

describe('nextLocalMidnight', () => {
  it('gives the start of the next local day', () => {
    expect(nextLocalMidnight(new Date(2026, 9, 14, 23, 59, 59))).toEqual(new Date(2026, 9, 15));
    expect(nextLocalMidnight(new Date(2026, 9, 14, 0, 0))).toEqual(new Date(2026, 9, 15));
    expect(nextLocalMidnight(new Date(2026, 11, 31, 12, 0))).toEqual(new Date(2027, 0, 1));
  });

  // Les tests tournent à l'heure de Paris (jest.config.js) : on passe à l'heure d'hiver le
  // 25 octobre 2026 et à l'heure d'été le 29 mars 2026.
  it('is 25 hours away on the day winter time starts, without adding 24 hours', () => {
    const startOfDay = new Date(2026, 9, 25);
    expect(startOfDay.getTimezoneOffset()).toBe(-120);

    const next = nextLocalMidnight(startOfDay);

    expect(next.getTime() - startOfDay.getTime()).toBe(25 * 60 * 60 * 1000);
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([26, 0, 0]);
  });

  it('is 23 hours away on the day summer time starts', () => {
    const startOfDay = new Date(2026, 2, 29);

    expect(nextLocalMidnight(startOfDay).getTime() - startOfDay.getTime()).toBe(
      23 * 60 * 60 * 1000,
    );
  });

  it('tells the new day at midnight after the night of the change to winter time', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 25, 0, 30) });
    const listener = jest.fn();
    new SystemClock(undefined, {
      isVisible: () => false,
      onChange: () => () => undefined,
    }).onTodayChange(listener);

    jest.advanceTimersByTime(24.5 * 60 * 60 * 1000 - 1);
    expect(listener).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(listener).toHaveBeenCalledWith(Day.of(2026, 10, 26));
    jest.useRealTimers();
  });

  describe('time zones', () => {
    /**
     * L'instant `iso` tel que le lit un téléphone réglé à `offsetHours` de UTC : ses heures
     * locales sont simulées, car le fuseau du processus de test ne peut pas changer.
     */
    function seenFrom(iso: string, offsetHours: number): Date {
      const instant = new Date(iso);
      const local = new Date(instant.getTime() + offsetHours * 3_600_000);
      return Object.assign(instant, {
        getFullYear: () => local.getUTCFullYear(),
        getMonth: () => local.getUTCMonth(),
        getDate: () => local.getUTCDate(),
      });
    }

    it.each([
      ['Paris in summer', 2, Day.of(2026, 10, 15)],
      ['Los Angeles', -7, Day.of(2026, 10, 14)],
      ['Kiritimati', 14, Day.of(2026, 10, 15)],
      ['UTC', 0, Day.of(2026, 10, 14)],
    ])('gives the local date of the phone, not the UTC one (%s)', (_, offsetHours, expected) => {
      const clock = new SystemClock(() => seenFrom('2026-10-14T22:30:00Z', offsetHours));

      expect(clock.today()).toEqual(expected);
    });

    it('follows the phone when it changes time zone', () => {
      let offsetHours = -7;
      const clock = new SystemClock(() => seenFrom('2026-10-14T22:30:00Z', offsetHours));
      expect(clock.today()).toEqual(Day.of(2026, 10, 14));

      offsetHours = 2;

      expect(clock.today()).toEqual(Day.of(2026, 10, 15));
    });

    it('changes year at local midnight on New Year’s Eve', () => {
      expect(new SystemClock(() => seenFrom('2026-12-31T23:30:00Z', 1)).today()).toEqual(
        Day.of(2027, 1, 1),
      );
      expect(new SystemClock(() => seenFrom('2027-01-01T00:30:00Z', -5)).today()).toEqual(
        Day.of(2026, 12, 31),
      );
    });
  });
});
