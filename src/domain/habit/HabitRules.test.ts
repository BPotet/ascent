import { Day } from '../day/Day';
import { Habit } from './Habit';
import { HabitName } from './HabitName';
import {
  DuplicateHabitNameError,
  HabitLimitReachedError,
  MAX_HABITS,
  assertCanAddHabit,
  assertNameAvailable,
  canAddHabit,
} from './HabitRules';

const day = Day.of(2026, 10, 14);

function habits(count: number): Habit[] {
  return Array.from(
    { length: count },
    (_, index) => new Habit(index + 1, HabitName.parse(`Habitude ${index + 1}`), day),
  );
}

describe('HabitRules', () => {
  it('allows at most 10 habits at a time', () => {
    expect(MAX_HABITS).toBe(10);
  });

  describe('canAddHabit', () => {
    it('allows a habit while there are fewer than 10', () => {
      expect(canAddHabit(habits(0))).toBe(true);
      expect(canAddHabit(habits(9))).toBe(true);
    });

    it('refuses an 11th habit', () => {
      expect(canAddHabit(habits(10))).toBe(false);
    });
  });

  describe('assertCanAddHabit', () => {
    it('accepts a 10th habit', () => {
      expect(() => assertCanAddHabit(habits(9))).not.toThrow();
    });

    it('refuses an 11th habit', () => {
      expect(() => assertCanAddHabit(habits(10))).toThrow(new HabitLimitReachedError());
    });
  });

  describe('assertNameAvailable', () => {
    const existing = [
      new Habit(1, HabitName.parse('Budget du jour'), day),
      new Habit(2, HabitName.parse('Cuisiner'), day),
    ];

    it('accepts a new name', () => {
      expect(() => assertNameAvailable(existing, HabitName.parse('Méditer'))).not.toThrow();
    });

    it('refuses the name of an existing habit, without regard to capitals', () => {
      expect(() => assertNameAvailable(existing, HabitName.parse('cuisiner  '))).toThrow(
        new DuplicateHabitNameError('cuisiner'),
      );
    });

    it('lets accents distinguish two names', () => {
      const summer = [new Habit(1, HabitName.parse('Eté sans sucre'), day)];

      expect(() => assertNameAvailable(summer, HabitName.parse('Été sans sucre'))).not.toThrow();
    });
  });

  it('names its errors', () => {
    expect(new HabitLimitReachedError()).toMatchObject({
      name: 'HabitLimitReachedError',
      message: 'A player has at most 10 habits at a time',
      maxHabits: 10,
    });
    expect(new DuplicateHabitNameError('cuisiner')).toMatchObject({
      name: 'DuplicateHabitNameError',
      message: 'A habit is already named "cuisiner"',
    });
  });
});
