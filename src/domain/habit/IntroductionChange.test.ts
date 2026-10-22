import { habitXpOf } from '../character/HabitXp';
import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import { Week } from '../week/Week';
import { DIFFICULTIES, type Difficulty } from './Difficulty';
import { introductionChangeOf, predatesWeeklyTarget } from './IntroductionChange';
import type { SettingsChange } from './SettingsChange';
import type { WeeklyTarget } from './WeeklyTarget';
import { weekSettingsOf } from './WeekSettings';

const day = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
let nextSequence = 1;
const change = (
  dayOfMonth: number,
  difficulty: Difficulty,
  weeklyTarget: WeeklyTarget | null = null,
  sequence = nextSequence++,
): SettingsChange => ({
  habitId: 1,
  changedOn: day(dayOfMonth),
  sequence,
  difficulty,
  weeklyTarget,
});

// Aujourd'hui, jour de la mise à jour : le mercredi 14 octobre 2026.
const today = day(14);
const createdOn = day(5);

describe('introductionChangeOf', () => {
  it('introduces the target 7 with the difficulty of the current week (R16)', () => {
    const changes = [change(5, 'medium'), change(12, 'hard')];

    expect(introductionChangeOf(changes, createdOn, today)).toEqual({
      difficulty: 'hard',
      weeklyTarget: 7,
    });
  });

  it('introduces nothing when the last change entered already carries a target', () => {
    expect(introductionChangeOf([change(5, 'medium', 3)], createdOn, today)).toBeNull();
    expect(
      introductionChangeOf([change(5, 'medium'), change(14, 'easy', 7)], createdOn, today),
    ).toBeNull();
  });

  it('reads the last change in order of entry, not by day: introducing twice writes nothing', () => {
    // Avant la mise à jour, l'horloge en avance a daté un changement du 21 (ordre 2) ; l'introduction
    // (ordre 3) est datée du 14.
    const changes = [
      change(5, 'medium', null, 1),
      change(21, 'medium', null, 2),
      change(14, 'medium', 7, 3),
    ];

    expect(introductionChangeOf(changes, createdOn, today)).toBeNull();
  });

  it('finds the last change entered whatever the order of the list', () => {
    const introduced = [
      change(14, 'medium', 7, 3),
      change(21, 'hard', null, 2),
      change(5, 'easy', null, 1),
    ];
    const notYet = [
      change(14, 'medium', null, 3),
      change(5, 'easy', 7, 1),
      change(12, 'hard', 7, 2),
    ];

    expect(introductionChangeOf(introduced, createdOn, today)).toBeNull();
    expect(introductionChangeOf(notYet, createdOn, today)).toEqual({
      difficulty: 'medium',
      weeklyTarget: 7,
    });
  });

  it('introduces again when the last change entered is empty, whatever the days', () => {
    const changes = [change(14, 'medium', 7, 1), change(5, 'easy', null, 2)];

    expect(introductionChangeOf(changes, createdOn, today)).toEqual({
      difficulty: 'medium',
      weeklyTarget: 7,
    });
  });

  it('copies the difficulty of the current week, not the one of a change dated in the future', () => {
    const changes = [change(5, 'medium'), change(21, 'hard')];

    expect(introductionChangeOf(changes, createdOn, today)).toEqual({
      difficulty: 'medium',
      weeklyTarget: 7,
    });
  });

  it('copies a change dated later in the current week, which already makes its difficulty', () => {
    const changes = [change(5, 'medium'), change(16, 'easy')];

    expect(introductionChangeOf(changes, createdOn, today)).toEqual({
      difficulty: 'easy',
      weeklyTarget: 7,
    });
  });

  it('introduces Moyenne and 7 for a habit without any change', () => {
    expect(introductionChangeOf([], createdOn, today)).toEqual({
      difficulty: 'medium',
      weeklyTarget: 7,
    });
  });

  /** Un générateur pseudo-aléatoire reproductible (LCG, bits de poids fort). */
  function random(seed: number): (max: number) => number {
    let state = seed;
    return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return Math.floor(state / 65536) % max;
    };
  }

  // Les semaines d'une habitude, à partir de sa création : avant, elle n'a aucun suivi. Le premier
  // changement d'une habitude d'avant la mise à jour est daté de son jour de création (migration 0005).
  it('changes neither the difficulty of any week nor the experience, and is idempotent', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const next = random(seed);
      const habitCreatedOn = day(1 + next(28));
      // Des changements d'avant la mise à jour, datés n'importe quand (horloge fausse comprise).
      const changes = Array.from({ length: 1 + next(4) }, (_, index) => ({
        ...change(1 + next(28), DIFFICULTIES[next(3)] ?? 'medium', null, index + 1),
        changedOn: index === 0 ? habitCreatedOn : day(1 + next(28)),
      }));
      const updateDay = day(1 + next(28));
      const checkIns: CheckIn[] = Array.from({ length: next(12) }, () => ({
        habitId: 1,
        day: habitCreatedOn.plusDays(next(35)),
        done: next(4) > 0,
        corrected: false,
      }));

      const settings = introductionChangeOf(changes, habitCreatedOn, updateDay);
      expect(settings).not.toBeNull();
      const after: SettingsChange[] = [
        ...changes,
        { habitId: 1, changedOn: updateDay, sequence: 99, ...settings! },
      ];

      for (
        let week = Week.containing(habitCreatedOn);
        week.isBefore(Week.containing(day(31)).next().next());
        week = week.next()
      ) {
        expect({
          seed,
          week: week.start.toIsoString(),
          difficulty: weekSettingsOf(after, week, habitCreatedOn).difficulty,
        }).toEqual({
          seed,
          week: week.start.toIsoString(),
          difficulty: weekSettingsOf(changes, week, habitCreatedOn).difficulty,
        });
      }
      expect(habitXpOf(checkIns, after, habitCreatedOn)).toBe(
        habitXpOf(checkIns, changes, habitCreatedOn),
      );
      expect(introductionChangeOf(after, habitCreatedOn, updateDay)).toBeNull();
    }
  });
});

describe('predatesWeeklyTarget', () => {
  it('is true for a habit with a change made before the update', () => {
    expect(predatesWeeklyTarget([change(5, 'medium')])).toBe(true);
    expect(predatesWeeklyTarget([change(5, 'medium'), change(14, 'medium', 7)])).toBe(true);
  });

  it('is false for a habit created after the update', () => {
    expect(predatesWeeklyTarget([change(14, 'medium', 7)])).toBe(false);
    expect(predatesWeeklyTarget([change(14, 'medium', 7), change(15, 'hard', 3)])).toBe(false);
  });

  it('is false without any change', () => {
    expect(predatesWeeklyTarget([])).toBe(false);
  });
});
