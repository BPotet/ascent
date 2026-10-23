import { Day } from '../day/Day';
import { Week } from '../week/Week';
import type { Difficulty } from './Difficulty';
import type { SettingsChange } from './SettingsChange';
import { WEEKLY_TARGETS, type WeeklyTarget } from './WeeklyTarget';
import {
  creationWeekTargetOf,
  weeklyTargetChangeAppliesThisWeek,
  weekSettingsOf,
} from './WeekSettings';

let nextSequence = 1;
const change = (
  changedOn: Day,
  difficulty: Difficulty,
  sequence = nextSequence++,
): SettingsChange => ({
  habitId: 1,
  changedOn,
  sequence,
  difficulty,
  weeklyTarget: null,
});

/** Un changement d'objectif hebdomadaire (`null` : un changement d'avant la mise à jour). */
const target = (
  changedOn: Day,
  weeklyTarget: WeeklyTarget | null,
  sequence = nextSequence++,
): SettingsChange => ({
  habitId: 1,
  changedOn,
  sequence,
  difficulty: 'medium',
  weeklyTarget,
});

// Semaine du lundi 12 au dimanche 18 octobre 2026.
const week = Week.containing(Day.of(2026, 10, 14));
const previousWeek = week.previous();
const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const sunday18 = Day.of(2026, 10, 18);
const monday19 = Day.of(2026, 10, 19);
const tuesday13 = Day.of(2026, 10, 13);
const wednesday14 = Day.of(2026, 10, 14);
const thursday15 = Day.of(2026, 10, 15);
const friday16 = Day.of(2026, 10, 16);
const nextWeek = week.next();

/**
 * La difficulté de la semaine, seule : sa règle ne dépend pas du jour de création (#23). Les tests
 * de la difficulté gardent ainsi leurs assertions.
 */
const difficultyOf = (changes: readonly SettingsChange[], shown: Week) => ({
  difficulty: weekSettingsOf(changes, shown, monday5).difficulty,
});

describe('weekSettingsOf, difficulty', () => {
  it('gives the settings of the only change, from the week of creation on', () => {
    const changes = [change(monday5, 'hard')];

    expect(difficultyOf(changes, Week.containing(monday5))).toEqual({ difficulty: 'hard' });
    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'hard' });
  });

  it('applies a change to its whole week, from Monday, and to the following weeks (R12)', () => {
    const changes = [change(monday5, 'medium'), change(Day.of(2026, 10, 14), 'hard')];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(difficultyOf(changes, week.next())).toEqual({ difficulty: 'hard' });
    expect(difficultyOf(changes, previousWeek)).toEqual({ difficulty: 'medium' });
  });

  it('applies a change made on Sunday to its week (R15)', () => {
    const changes = [change(monday5, 'medium'), change(sunday18, 'easy')];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'easy' });
    expect(difficultyOf(changes, previousWeek)).toEqual({ difficulty: 'medium' });
  });

  it('applies a change made on the next Monday to the next week only (R15)', () => {
    const changes = [change(monday5, 'medium'), change(monday19, 'easy')];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'medium' });
    expect(difficultyOf(changes, week.next())).toEqual({ difficulty: 'easy' });
  });

  it('keeps the last of several changes of the same week (R15)', () => {
    const changes = [
      change(monday5, 'medium'),
      change(Day.of(2026, 10, 13), 'hard'),
      change(Day.of(2026, 10, 15), 'easy'),
    ];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'easy' });
  });

  it('keeps the last entered of several changes of the same day (R15)', () => {
    const changes = [
      change(monday5, 'medium', 1),
      change(monday12, 'hard', 2),
      change(monday12, 'easy', 3),
    ];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'easy' });
  });

  it('sorts the changes by day, then by order of entry, whatever their order in the list', () => {
    const changes = [
      change(monday12, 'easy', 7),
      change(Day.of(2026, 10, 14), 'hard', 3),
      change(monday12, 'medium', 5),
      change(monday5, 'easy', 9),
    ];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(difficultyOf(changes, previousWeek)).toEqual({ difficulty: 'easy' });
    expect(difficultyOf([...changes].reverse(), week)).toEqual({ difficulty: 'hard' });
  });

  it('does not let a more recent entry dated earlier override a change dated later (risk 3)', () => {
    // Saisi le vendredi 16 avec une horloge en avance, puis le mercredi 14 après correction.
    const changes = [
      change(Day.of(2026, 10, 16), 'hard', 1),
      change(Day.of(2026, 10, 14), 'easy', 2),
    ];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'hard' });
  });

  it('falls back on the first change for a week before every change (clock set back)', () => {
    const changes = [change(monday19, 'hard', 4), change(Day.of(2026, 10, 21), 'easy', 5)];

    expect(difficultyOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(difficultyOf(changes, previousWeek)).toEqual({ difficulty: 'hard' });
  });

  it('gives Moyenne to a habit without any change (R2)', () => {
    expect(difficultyOf([], week)).toEqual({ difficulty: 'medium' });
  });

  it('does not change the list it is given', () => {
    const changes = [change(monday12, 'hard', 2), change(monday5, 'easy', 1)];
    const copy = [...changes];

    difficultyOf(changes, week);

    expect(changes).toEqual(copy);
  });
});

/** L'objectif hebdomadaire et l'objectif de la semaine de `shown`. */
const targetsOf = (changes: readonly SettingsChange[], shown: Week, createdOn: Day) => {
  const { weeklyTarget, weekTarget } = weekSettingsOf(changes, shown, createdOn);
  return { weeklyTarget, weekTarget };
};

describe('weekSettingsOf, weekly target', () => {
  describe('in the week of creation, the target of the week is cut to the active days (R6)', () => {
    it.each([
      ['Thursday', thursday15, 4],
      ['Sunday', sunday18, 1],
      ['Wednesday', wednesday14, 5],
      ['Monday', monday12, 7],
    ])('created on %s with 7: %p', (_, createdOn, weekTarget) => {
      const changes = [target(createdOn, 7)];

      expect(targetsOf(changes, week, createdOn)).toEqual({ weeklyTarget: 7, weekTarget });
      expect(targetsOf(changes, nextWeek, createdOn)).toEqual({ weeklyTarget: 7, weekTarget: 7 });
    });

    it('does not cut a target under the active days: created on Thursday with 3', () => {
      expect(targetsOf([target(thursday15, 3)], week, thursday15)).toEqual({
        weeklyTarget: 3,
        weekTarget: 3,
      });
    });
  });

  describe('a change applies from the next Monday (R13)', () => {
    it('in the middle of the week', () => {
      const changes = [target(monday5, 3), target(wednesday14, 5)];

      expect(targetsOf(changes, week.previous(), monday5)).toEqual({
        weeklyTarget: 3,
        weekTarget: 3,
      });
      expect(targetsOf(changes, week, monday5)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
      expect(targetsOf(changes, nextWeek, monday5)).toEqual({ weeklyTarget: 5, weekTarget: 5 });
    });

    it('on Sunday', () => {
      const changes = [target(monday5, 3), target(sunday18, 5)];

      expect(targetsOf(changes, week, monday5).weeklyTarget).toBe(3);
      expect(targetsOf(changes, nextWeek, monday5).weeklyTarget).toBe(5);
    });

    it('on Monday, to the next week only', () => {
      const changes = [target(monday5, 3), target(monday12, 5)];

      expect(targetsOf(changes, week.previous(), monday5).weeklyTarget).toBe(3);
      expect(targetsOf(changes, week, monday5).weeklyTarget).toBe(3);
      expect(targetsOf(changes, nextWeek, monday5).weeklyTarget).toBe(5);
    });

    it('keeps the last of several changes of the week (R15)', () => {
      const changes = [target(monday5, 3), target(wednesday14, 5), target(thursday15, 4)];

      expect(targetsOf(changes, week, monday5).weeklyTarget).toBe(3);
      expect(targetsOf(changes, nextWeek, monday5).weeklyTarget).toBe(4);
    });

    it('keeps the last entered of several changes of the same day (R15)', () => {
      const changes = [target(monday5, 3, 1), target(wednesday14, 4, 3), target(wednesday14, 5, 2)];

      expect(targetsOf(changes, nextWeek, monday5).weeklyTarget).toBe(4);
    });

    it('keeps applying the last change to all the following weeks', () => {
      const changes = [target(monday5, 3), target(wednesday14, 5)];

      expect(targetsOf(changes, nextWeek.next().next(), monday5).weeklyTarget).toBe(5);
    });
  });

  describe('on the day of creation, a change applies at once (R13)', () => {
    it('to the week of creation, cut to the active days', () => {
      const changes = [target(wednesday14, 7), target(wednesday14, 3)];

      expect(targetsOf(changes, week, wednesday14)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
      expect(targetsOf(changes, nextWeek, wednesday14)).toEqual({
        weeklyTarget: 3,
        weekTarget: 3,
      });
    });

    it('keeps the last entered of several changes of the day of creation', () => {
      const changes = [target(friday16, 7, 5), target(friday16, 2, 7), target(friday16, 3, 6)];

      expect(targetsOf(changes, week, friday16)).toEqual({ weeklyTarget: 2, weekTarget: 2 });
    });

    it('but not a change of the next day', () => {
      const changes = [target(wednesday14, 7), target(thursday15, 3)];

      expect(targetsOf(changes, week, wednesday14)).toEqual({ weeklyTarget: 7, weekTarget: 5 });
      expect(targetsOf(changes, nextWeek, wednesday14).weeklyTarget).toBe(3);
    });
  });

  describe('a habit that existed before the update (R16, R17)', () => {
    it('has no target before the week of the update, and 7 from it on', () => {
      const changes = [target(monday5, null), target(wednesday14, 7)];

      expect(targetsOf(changes, week.previous(), monday5)).toEqual({
        weeklyTarget: null,
        weekTarget: null,
      });
      expect(targetsOf(changes, week, monday5)).toEqual({ weeklyTarget: 7, weekTarget: 7 });
      expect(targetsOf(changes, nextWeek, monday5)).toEqual({ weeklyTarget: 7, weekTarget: 7 });
    });

    it('has no target in a week before the update, whatever its other changes', () => {
      const changes = [target(monday5, null), target(Day.of(2026, 10, 7), null)];

      expect(targetsOf(changes, week.previous(), monday5)).toEqual({
        weeklyTarget: null,
        weekTarget: null,
      });
      expect(targetsOf(changes, week, monday5).weeklyTarget).toBeNull();
    });

    it('created in the week of the update, has the target cut to its active days: 6', () => {
      const changes = [target(tuesday13, null), target(wednesday14, 7)];

      expect(targetsOf(changes, week, tuesday13)).toEqual({ weeklyTarget: 7, weekTarget: 6 });
    });

    it('does not make the day of the update a day of creation (Q-A (ii)): « Régler » applies on Monday', () => {
      const changes = [target(monday5, null), target(wednesday14, 7), target(wednesday14, 3)];

      expect(targetsOf(changes, week, monday5)).toEqual({ weeklyTarget: 7, weekTarget: 7 });
      expect(targetsOf(changes, nextWeek, monday5)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
    });

    it('created the day before the update, in the same week: 7 cut to 6, « Régler » on Monday', () => {
      const changes = [target(tuesday13, null), target(wednesday14, 7), target(wednesday14, 3)];

      expect(targetsOf(changes, week, tuesday13)).toEqual({ weeklyTarget: 7, weekTarget: 6 });
      expect(targetsOf(changes, nextWeek, tuesday13)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
    });

    it('created on the day of the update, keeps the exception of its day of creation (edge case 2)', () => {
      const changes = [target(wednesday14, null), target(wednesday14, 7), target(wednesday14, 3)];

      expect(targetsOf([changes[0]!, changes[1]!], week, wednesday14)).toEqual({
        weeklyTarget: 7,
        weekTarget: 5,
      });
      expect(targetsOf(changes, week, wednesday14)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
      expect(targetsOf(changes, nextWeek, wednesday14)).toEqual({
        weeklyTarget: 3,
        weekTarget: 3,
      });
    });
  });

  describe('after the clock was set back', () => {
    it('keeps the target when a change without target is dated after the introduction', () => {
      // Avant la mise à jour, l'horloge en avance a daté un changement du 21 ; l'introduction est
      // datée du 14, après correction de l'horloge.
      const changes = [
        target(monday5, null, 1),
        target(Day.of(2026, 10, 21), null, 2),
        target(wednesday14, 7, 3),
      ];

      expect(targetsOf(changes, week, monday5).weeklyTarget).toBe(7);
      expect(targetsOf(changes, nextWeek, monday5).weeklyTarget).toBe(7);
      expect(targetsOf(changes, nextWeek.next(), monday5).weeklyTarget).toBe(7);
    });

    it('sorts by day a change dated before the day of creation', () => {
      // Créée le 14 avec 7, puis changée à 3 avec l'horloge reculée au 12.
      const changes = [target(wednesday14, 7, 1), target(monday12, 3, 2)];

      expect(targetsOf(changes, week, wednesday14)).toEqual({ weeklyTarget: 3, weekTarget: 3 });
      expect(targetsOf(changes, nextWeek, wednesday14).weeklyTarget).toBe(7);
    });

    it('gives no target of the week to a week without any active day', () => {
      // Créée le lundi 19 avec 7, puis changée à 3 avec l'horloge reculée au 14.
      const changes = [target(monday19, 7, 1), target(wednesday14, 3, 2)];

      expect(targetsOf(changes, week, monday19)).toEqual({ weeklyTarget: 3, weekTarget: null });
    });
  });

  it('has no target before the week of creation', () => {
    expect(targetsOf([target(wednesday14, 3)], week.previous(), wednesday14)).toEqual({
      weeklyTarget: null,
      weekTarget: null,
    });
  });

  it('has no target without any change', () => {
    expect(weekSettingsOf([], week, monday5)).toEqual({
      difficulty: 'medium',
      weeklyTarget: null,
      weekTarget: null,
    });
  });

  it('gives the difficulty and the targets together', () => {
    const changes = [{ ...target(thursday15, 3), difficulty: 'hard' as const }];

    expect(weekSettingsOf(changes, week, thursday15)).toEqual({
      difficulty: 'hard',
      weeklyTarget: 3,
      weekTarget: 3,
    });
  });
});

describe('creationWeekTargetOf', () => {
  it.each([
    ['Monday', monday12, 7, 7],
    ['Wednesday', wednesday14, 7, 5],
    ['Thursday', thursday15, 7, 4],
    ['Sunday', sunday18, 7, 1],
    ['Thursday', thursday15, 3, 3],
    ['Thursday', thursday15, 4, 4],
    ['Sunday', sunday18, 1, 1],
  ] as const)(
    'created on %s with %p: %p, the days left in the week, today included (R6)',
    (_, today, weeklyTarget, weekTarget) => {
      expect(creationWeekTargetOf(weeklyTarget, today)).toBe(weekTarget);
    },
  );

  it('is the target of the week that the habit gets once created', () => {
    for (const today of week.days()) {
      for (const weeklyTarget of WEEKLY_TARGETS) {
        const changes = [target(today, weeklyTarget)];

        expect(creationWeekTargetOf(weeklyTarget, today)).toBe(
          weekSettingsOf(changes, week, today).weekTarget,
        );
      }
    }
  });
});

describe('weeklyTargetChangeAppliesThisWeek', () => {
  it('is true on the day of creation (R13)', () => {
    expect(weeklyTargetChangeAppliesThisWeek(wednesday14, wednesday14)).toBe(true);
  });

  it('is false on any other day, before or after', () => {
    expect(weeklyTargetChangeAppliesThisWeek(wednesday14, thursday15)).toBe(false);
    expect(weeklyTargetChangeAppliesThisWeek(wednesday14, tuesday13)).toBe(false);
    expect(weeklyTargetChangeAppliesThisWeek(monday5, monday19)).toBe(false);
  });

  /** Un générateur pseudo-aléatoire reproductible (LCG), pour le test de propriété. */
  function random(seed: number): (max: number) => number {
    let state = seed;
    return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return Math.floor(state / 65536) % max;
    };
  }

  /**
   * Un historique réaliste après la mise à jour : changements datés dans l'ordre de saisie à partir
   * du jour de création, et, pour une habitude d'avant la mise à jour, des changements sans objectif
   * puis le changement d'introduction (7), puis des changements avec objectif.
   */
  function historyOf(next: (max: number) => number) {
    const createdOn = Day.of(2026, 10, 1).plusDays(next(40));
    const legacy = next(2) === 0;
    const changes: SettingsChange[] = [];
    let day = createdOn;
    let sequence = 1;
    const add = (weeklyTarget: WeeklyTarget | null) =>
      changes.push(target(day, weeklyTarget, sequence++));
    const wait = () => {
      const days = [0, 0, 0, 0, 1, 3, 7, 9][next(8)] ?? 0;
      day = day.plusDays(days);
    };
    if (legacy) {
      add(null);
      for (let index = next(3); index > 0; index--) {
        wait();
        add(null);
      }
      wait();
      add(7);
    } else {
      add(WEEKLY_TARGETS[next(7)] ?? 7);
    }
    for (let index = next(4); index > 0; index--) {
      wait();
      add(WEEKLY_TARGETS[next(7)] ?? 7);
    }
    wait();
    return { createdOn, changes, today: day, sequence };
  }

  it('is true if and only if a change made today changes the target of the current week', () => {
    const outcomes = { applies: 0, waits: 0, legacyOnUpdateDay: 0 };
    for (let seed = 1; seed <= 1000; seed++) {
      const next = random(seed);
      const { createdOn, changes, today, sequence } = historyOf(next);
      const current = Week.containing(today);
      const before = weekSettingsOf(changes, current, createdOn).weeklyTarget;
      const chosen = WEEKLY_TARGETS.filter((each) => each !== before)[next(6)] ?? 1;
      const after = weekSettingsOf(
        [...changes, target(today, chosen, sequence)],
        current,
        createdOn,
      ).weeklyTarget;

      expect({ seed, applies: after !== before }).toEqual({
        seed,
        applies: weeklyTargetChangeAppliesThisWeek(createdOn, today),
      });
      outcomes[after === before ? 'waits' : 'applies'] += 1;
      if (changes[0]?.weeklyTarget === null && today.equals(createdOn)) {
        outcomes.legacyOnUpdateDay += 1;
      }
    }
    // Les historiques générés couvrent les deux réponses, et le cas limite 2.
    expect(outcomes.applies).toBeGreaterThan(50);
    expect(outcomes.waits).toBeGreaterThan(50);
    expect(outcomes.legacyOnUpdateDay).toBeGreaterThan(10);
  });
});

describe('weekly target across the calendar edges', () => {
  // Semaine du lundi 28 décembre 2026 au dimanche 3 janvier 2027 : elle change d'année.
  const thursday31 = Day.of(2026, 12, 31);
  const yearEndWeek = Week.containing(thursday31);

  it.each([
    ['Thursday 31 December 2026', thursday31, 4],
    ['Friday 1 January 2027', Day.of(2027, 1, 1), 3],
    ['Sunday 3 January 2027', Day.of(2027, 1, 3), 1],
    // Dimanche 25 octobre 2026 : passage à l'heure d'hiver (journée de 25 h, Europe/Paris).
    ['Sunday 25 October 2026, day of 25 hours', Day.of(2026, 10, 25), 1],
    ['Saturday 24 October 2026, before the change of hour', Day.of(2026, 10, 24), 2],
    // Dimanche 28 mars 2027 : passage à l'heure d'été (journée de 23 h).
    ['Sunday 28 March 2027, day of 23 hours', Day.of(2027, 3, 28), 1],
    ['Monday 22 March 2027, week of the change of hour', Day.of(2027, 3, 22), 7],
  ] as const)(
    'cuts the week of creation to the days left, created on %s: %p (R6)',
    (_, createdOn, weekTarget) => {
      expect(creationWeekTargetOf(7, createdOn)).toBe(weekTarget);
      expect(weekSettingsOf([target(createdOn, 7)], Week.containing(createdOn), createdOn)).toEqual(
        { difficulty: 'medium', weeklyTarget: 7, weekTarget },
      );
    },
  );

  it('gives the whole target to the week after a week that changes year', () => {
    const changes = [target(thursday31, 7)];

    expect(weekSettingsOf(changes, yearEndWeek.next(), thursday31).weekTarget).toBe(7);
    expect(weekSettingsOf(changes, yearEndWeek.previous(), thursday31).weekTarget).toBeNull();
  });

  it('applies a change made on New Year’s Day from the next Monday, 4 January 2027 (R13)', () => {
    const changes = [target(Day.of(2026, 12, 7), 3), target(Day.of(2027, 1, 1), 5)];

    expect(weekSettingsOf(changes, yearEndWeek, Day.of(2026, 12, 7)).weeklyTarget).toBe(3);
    expect(
      weekSettingsOf(changes, Week.containing(Day.of(2027, 1, 4)), Day.of(2026, 12, 7))
        .weeklyTarget,
    ).toBe(5);
  });

  it('tells a change on the day of creation from one on the next day, across the new year', () => {
    expect(weeklyTargetChangeAppliesThisWeek(thursday31, thursday31)).toBe(true);
    expect(weeklyTargetChangeAppliesThisWeek(thursday31, Day.of(2027, 1, 1))).toBe(false);
    expect(weeklyTargetChangeAppliesThisWeek(Day.of(2027, 12, 31), thursday31)).toBe(false);
  });
});
