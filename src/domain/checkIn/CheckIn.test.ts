import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import {
  type CheckIn,
  doneAtClosing,
  isBlank,
  NotStartedDayError,
  toggleCheckIn,
  UpcomingDayError,
} from './CheckIn';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), monday);

const checkIn = (day: Day, done: boolean, corrected = false): CheckIn => ({
  habitId: cooking.id,
  day,
  done,
  corrected,
});

describe('toggleCheckIn', () => {
  describe('today', () => {
    it('marks « fait » a habit with no check-in (R9)', () => {
      expect(toggleCheckIn(cooking, wednesday, null, wednesday)).toEqual({
        checkIn: checkIn(wednesday, true),
        isCorrection: false,
      });
    });

    it('goes back to « à faire » on a second tap (R9)', () => {
      expect(toggleCheckIn(cooking, wednesday, checkIn(wednesday, true), wednesday)).toEqual({
        checkIn: checkIn(wednesday, false),
        isCorrection: false,
      });
    });

    it('ends on « fait » after three taps, each tap toggling the stored check-in', () => {
      let current: CheckIn | null = null;
      for (let tap = 1; tap <= 3; tap += 1) {
        current = toggleCheckIn(cooking, wednesday, current, wednesday).checkIn;
      }

      expect(current).toEqual(checkIn(wednesday, true));
    });

    it('removes the mark « corrigé », since the day is open again (R6, R13)', () => {
      expect(toggleCheckIn(cooking, wednesday, checkIn(wednesday, true, true), wednesday)).toEqual({
        checkIn: checkIn(wednesday, false, false),
        isCorrection: false,
      });
      expect(
        toggleCheckIn(cooking, wednesday, checkIn(wednesday, false, true), wednesday).checkIn,
      ).toEqual(checkIn(wednesday, true, false));
    });

    it('accepts the day of creation', () => {
      expect(toggleCheckIn(cooking, monday, null, monday).checkIn).toEqual(checkIn(monday, true));
    });
  });

  describe('a closed day (correction)', () => {
    it('marks « fait » and « corrigé » a day closed as « pas fait » (R10, R13)', () => {
      expect(toggleCheckIn(cooking, wednesday, null, thursday)).toEqual({
        checkIn: checkIn(wednesday, true, true),
        isCorrection: true,
      });
    });

    it('removes the mark when the day goes back to its state at closing (R13)', () => {
      expect(toggleCheckIn(cooking, wednesday, checkIn(wednesday, true, true), thursday)).toEqual({
        checkIn: checkIn(wednesday, false, false),
        isCorrection: true,
      });
    });

    it('marks « pas fait » and « corrigé » a day closed as « fait »', () => {
      expect(toggleCheckIn(cooking, tuesday, checkIn(tuesday, true), thursday)).toEqual({
        checkIn: checkIn(tuesday, false, true),
        isCorrection: true,
      });
    });

    it('corrects the day of creation once it is closed (R10, R12)', () => {
      expect(toggleCheckIn(cooking, monday, null, tuesday)).toEqual({
        checkIn: checkIn(monday, true, true),
        isCorrection: true,
      });
    });

    it('refuses the day before the day of creation, even long closed (R12)', () => {
      expect(() => toggleCheckIn(cooking, Day.of(2026, 10, 11), null, Day.of(2030, 1, 1))).toThrow(
        NotStartedDayError,
      );
    });

    it('corrects a day skipped by a time zone change to the east, never today (R6, R10)', () => {
      const friday = Day.of(2026, 10, 16);

      expect(toggleCheckIn(cooking, thursday, null, friday)).toEqual({
        checkIn: checkIn(thursday, true, true),
        isCorrection: true,
      });
    });

    /** Les suivis successifs de mardi après `taps` taps, aujourd'hui étant jeudi. */
    const afterTaps = (closing: CheckIn | null, taps: number): CheckIn[] => {
      const states: CheckIn[] = [];
      let current = closing;
      for (let tap = 1; tap <= taps; tap += 1) {
        current = toggleCheckIn(cooking, tuesday, current, thursday).checkIn;
        states.push(current);
      }
      return states;
    };

    it('puts, removes and puts again the mark of a day « pas fait » at closing (R13)', () => {
      expect(afterTaps(null, 3)).toEqual([
        checkIn(tuesday, true, true),
        checkIn(tuesday, false, false),
        checkIn(tuesday, true, true),
      ]);
    });

    it('puts, removes and puts again the mark of a day « fait » at closing (R13)', () => {
      expect(afterTaps(checkIn(tuesday, true), 3)).toEqual([
        checkIn(tuesday, false, true),
        checkIn(tuesday, true, false),
        checkIn(tuesday, false, true),
      ]);
    });

    it('keeps the state at closing through corrections made on different days (R13)', () => {
      const corrected = toggleCheckIn(cooking, monday, null, tuesday).checkIn;
      const back = toggleCheckIn(cooking, monday, corrected, Day.of(2026, 11, 2)).checkIn;

      expect(back).toEqual(checkIn(monday, false, false));
    });

    it('has no time limit (R10)', () => {
      const lateToday = Day.of(2030, 1, 1);

      expect(toggleCheckIn(cooking, monday, null, lateToday).isCorrection).toBe(true);
    });
  });

  it('refuses a day before the day of creation, « hors habitude » (R12)', () => {
    expect(() => toggleCheckIn(cooking, Day.of(2026, 10, 11), null, wednesday)).toThrow(
      NotStartedDayError,
    );
  });

  it('refuses a day after today, « à venir », even with a stored « fait » (R7)', () => {
    expect(() => toggleCheckIn(cooking, thursday, null, wednesday)).toThrow(UpcomingDayError);
    expect(() => toggleCheckIn(cooking, wednesday, checkIn(wednesday, true), tuesday)).toThrow(
      UpcomingDayError,
    );
  });

  it('refuses « hors habitude » before « à venir » when the habit is created later', () => {
    const later = new Habit(8, HabitName.parse('Méditer'), thursday);

    expect(() => toggleCheckIn(later, wednesday, null, tuesday)).toThrow(NotStartedDayError);
  });

  it('names its errors and the refused day', () => {
    expect(new NotStartedDayError(tuesday)).toMatchObject({
      name: 'NotStartedDayError',
      message: 'Day 2026-10-13 is before the day of creation of the habit',
    });
    expect(new UpcomingDayError(thursday)).toMatchObject({
      name: 'UpcomingDayError',
      message: 'Day 2026-10-15 is after today',
    });
  });
});

describe('doneAtClosing', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [true, true, false],
    [false, true, true],
  ])('is %p when done is %p and corrected is %p', (done, corrected, expected) => {
    expect(doneAtClosing(checkIn(tuesday, done, corrected))).toBe(expected);
  });
});

describe('isBlank', () => {
  it('is true only for a check-in neither « fait » nor « corrigé », which is not stored', () => {
    expect(isBlank(checkIn(tuesday, false, false))).toBe(true);
    expect(isBlank(checkIn(tuesday, true, false))).toBe(false);
    expect(isBlank(checkIn(tuesday, false, true))).toBe(false);
    expect(isBlank(checkIn(tuesday, true, true))).toBe(false);
  });
});
