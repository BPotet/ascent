import { Day } from '../../../domain/day/Day';
import { SystemClock } from './SystemClock';

describe('SystemClock', () => {
  it('gives the local calendar date of the current instant', () => {
    const clock = new SystemClock(() => new Date(2026, 9, 14, 23, 59));

    expect(clock.today()).toEqual(Day.of(2026, 10, 14));
  });

  it('reads the time again at each call', () => {
    let now = new Date(2026, 9, 14, 23, 59);
    const clock = new SystemClock(() => now);
    clock.today();

    now = new Date(2026, 9, 15, 0, 0);

    expect(clock.today()).toEqual(Day.of(2026, 10, 15));
  });

  it('uses the phone time by default', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 8, 30) });
    try {
      expect(new SystemClock().today()).toEqual(Day.of(2026, 10, 14));
    } finally {
      jest.useRealTimers();
    }
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
