import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Week } from '../week/Week';
import { expectedHabitsOn, isExpectedHabit } from './ExpectedHabit';
import { Habit } from './Habit';
import { HabitName } from './HabitName';
import type { SettingsChange } from './SettingsChange';
import type { WeeklyTarget } from './WeeklyTarget';
import { weekSettingsOf } from './WeekSettings';
import { weeklyProgressOf } from './WeeklyProgress';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);

// Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7, créées le
// lundi 5 octobre 2026.
const running = new Habit(1, HabitName.parse('Courir 5 km'), october(5));
const cooking = new Habit(2, HabitName.parse('Cuisiner'), october(5));

let nextSequence = 1;
const settings = (
  habit: Habit,
  weeklyTarget: WeeklyTarget | null,
  changedOn = habit.createdOn,
): SettingsChange => ({
  habitId: habit.id,
  changedOn,
  sequence: nextSequence++,
  difficulty: 'medium',
  weeklyTarget,
});
const changes = [settings(running, 3), settings(cooking, 7)];

const done = (habit: Habit, ...days: number[]): CheckIn[] =>
  days.map((dayOfMonth) => ({
    habitId: habit.id,
    day: october(dayOfMonth),
    done: true,
    corrected: false,
  }));

const namesOf = (habits: readonly Habit[]) => habits.map(({ name }) => name.value);

describe('isExpectedHabit', () => {
  it('expects a habit « fait » that day, whatever its progress', () => {
    expect(isExpectedHabit(true, 0, 3)).toBe(true);
    expect(isExpectedHabit(true, 3, 3)).toBe(true);
    expect(isExpectedHabit(true, 5, 3)).toBe(true);
    expect(isExpectedHabit(true, 2, null)).toBe(true);
  });

  it('expects a habit not « fait » while its progress is under the target of the week', () => {
    expect(isExpectedHabit(false, 0, 3)).toBe(true);
    expect(isExpectedHabit(false, 2, 3)).toBe(true);
    expect(isExpectedHabit(false, 0, 1)).toBe(true);
  });

  it('no longer expects a habit not « fait » once its target is reached, or beyond', () => {
    expect(isExpectedHabit(false, 3, 3)).toBe(false);
    expect(isExpectedHabit(false, 4, 3)).toBe(false);
    expect(isExpectedHabit(false, 1, 1)).toBe(false);
  });

  it('always expects a habit of a week without a target (before the update)', () => {
    expect(isExpectedHabit(false, 0, null)).toBe(true);
    expect(isExpectedHabit(false, 7, null)).toBe(true);
  });

  it('always expects a habit whose target of the week is its number of active days', () => {
    // Objectif 7 sur une semaine entière, ou objectif réduit en semaine de création (jeudi : 4) :
    // l'objectif n'est atteint qu'avec toutes les cases « fait », jour compté compris.
    for (const activeDays of [1, 2, 3, 4, 5, 6, 7]) {
      for (let dayIndex = 0; dayIndex < activeDays; dayIndex += 1) {
        // Au plus toutes les cases des jours actifs d'avant, aucune le jour compté.
        for (let progress = 0; progress <= dayIndex; progress += 1) {
          expect(isExpectedHabit(false, progress, activeDays)).toBe(true);
        }
      }
    }
  });
});

describe('expectedHabitsOn', () => {
  it('counts a non-daily habit under its target and a daily one (scénario 1)', () => {
    const checkIns = [...done(running, 12), ...done(cooking, 14)];

    expect(namesOf(expectedHabitsOn(october(14), [running, cooking], checkIns, changes))).toEqual([
      'Courir 5 km',
      'Cuisiner',
    ]);
  });

  it('leaves out a habit not « fait » whose target was reached before the day', () => {
    const checkIns = done(running, 12, 13, 14);

    expect(namesOf(expectedHabitsOn(october(15), [running, cooking], checkIns, changes))).toEqual([
      'Cuisiner',
    ]);
  });

  it('counts again a habit « fait » on the day, even beyond its target', () => {
    const checkIns = done(running, 12, 13, 14, 15);

    expect(namesOf(expectedHabitsOn(october(15), [running, cooking], checkIns, changes))).toEqual([
      'Courir 5 km',
      'Cuisiner',
    ]);
  });

  it('can expect no habit at all', () => {
    const checkIns = done(running, 12, 14, 16);

    expect(expectedHabitsOn(october(18), [running], checkIns, changes)).toEqual([]);
  });

  it('leaves out a habit created after the day', () => {
    const reading = new Habit(3, HabitName.parse('Lire'), october(16));

    expect(
      namesOf(
        expectedHabitsOn(october(15), [running, reading], [], [...changes, settings(reading, 1)]),
      ),
    ).toEqual(['Courir 5 km']);
  });

  it('only counts the progress of the week of the day: a Monday starts again from zero', () => {
    const checkIns = done(running, 5, 6, 7);

    expect(namesOf(expectedHabitsOn(october(12), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
    expect(expectedHabitsOn(october(11), [running], checkIns, changes)).toEqual([]);
  });

  it('ignores a « fait » on a day after the counted day', () => {
    const checkIns = done(running, 12, 13, 16, 17);

    expect(namesOf(expectedHabitsOn(october(14), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
    expect(namesOf(expectedHabitsOn(october(16), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
    expect(expectedHabitsOn(october(18), [running], checkIns, changes)).toEqual([]);
  });

  it('only counts the check-ins and the changes of each habit', () => {
    const checkIns = done(cooking, 12, 13, 14);

    expect(namesOf(expectedHabitsOn(october(15), [running, cooking], checkIns, changes))).toEqual([
      'Courir 5 km',
      'Cuisiner',
    ]);
  });

  it('does not count a corrected « pas fait »', () => {
    const checkIns: CheckIn[] = [
      ...done(running, 12, 13),
      { habitId: running.id, day: october(14), done: false, corrected: true },
    ];

    expect(namesOf(expectedHabitsOn(october(15), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
  });

  it('always expects a habit in a week without a target (before the update)', () => {
    const budget = new Habit(4, HabitName.parse('Budget du jour'), october(1));
    const history = [settings(budget, null), settings(budget, 1, october(5))];
    const checkIns = done(budget, 1);

    expect(namesOf(expectedHabitsOn(october(2), [budget], checkIns, history))).toEqual([
      'Budget du jour',
    ]);
    // La semaine suivante a l'objectif 1 : atteint dès le lundi 5.
    expect(expectedHabitsOn(october(6), [budget], done(budget, 5), history)).toEqual([]);
  });

  it('reads a week across two years from its Monday in December', () => {
    const checkIns: CheckIn[] = [28, 29, 30].map((dayOfMonth) => ({
      habitId: running.id,
      day: Day.of(2026, 12, dayOfMonth),
      done: true,
      corrected: false,
    }));

    // Vendredi 1er janvier 2027 : semaine du lundi 28 décembre 2026, objectif 3 atteint.
    expect(expectedHabitsOn(Day.of(2027, 1, 1), [running], checkIns, changes)).toEqual([]);
    // Lundi 4 janvier 2027 : nouvelle semaine, de nouveau attendue.
    expect(namesOf(expectedHabitsOn(Day.of(2027, 1, 4), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
  });

  it('counts the week of the clock change (Sunday 25 October 2026) like any other', () => {
    const checkIns = done(running, 19, 20, 21);

    expect(expectedHabitsOn(october(25), [running], checkIns, changes)).toEqual([]);
    expect(namesOf(expectedHabitsOn(october(26), [running], checkIns, changes))).toEqual([
      'Courir 5 km',
    ]);
  });

  it('still expects a habit after skipped days, until the target is reached', () => {
    // Lundi 12 et mardi 13 sautés, puis « fait » mercredi 14, jeudi 15 et vendredi 16.
    const checkIns = done(running, 14, 15, 16);

    for (const dayOfMonth of [12, 13, 14, 15, 16]) {
      expect(namesOf(expectedHabitsOn(october(dayOfMonth), [running], checkIns, changes))).toEqual([
        'Courir 5 km',
      ]);
    }
    expect(expectedHabitsOn(october(17), [running], checkIns, changes)).toEqual([]);
  });

  it('keeps the order of the habits given (order of creation)', () => {
    expect(namesOf(expectedHabitsOn(october(14), [cooking, running], [], changes))).toEqual([
      'Cuisiner',
      'Courir 5 km',
    ]);
  });

  it('follows the rule of isExpectedHabit with the progress up to the day included', () => {
    const checkIns = done(running, 12, 14);
    const week = Week.containing(october(15));
    for (const dayOfMonth of [12, 13, 14, 15, 16, 17, 18]) {
      const day = october(dayOfMonth);
      const expected = isExpectedHabit(
        checkIns.some((checkIn) => checkIn.day.equals(day)),
        weeklyProgressOf(checkIns, week, day),
        weekSettingsOf(changes.slice(0, 1), week, running.createdOn).weekTarget,
      );
      expect(expectedHabitsOn(day, [running], checkIns, changes)).toHaveLength(expected ? 1 : 0);
    }
  });
});
