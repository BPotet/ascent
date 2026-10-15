import type { Day } from '../day/Day';
import type { Habit } from '../habit/Habit';
import { Week } from '../week/Week';

/**
 * Historique (`History`), voir `docs/glossary.md` : les semaines consultables (R22), de la semaine
 * qui contient le plus ancien jour de création parmi les habitudes existantes jusqu'à la semaine en
 * cours. Sans habitude, seule la semaine en cours est consultable. Les mois s'ajoutent avec #10.
 */
export class History {
  private constructor(
    /** La plus ancienne semaine consultable. */
    readonly firstWeek: Week,
    /** La semaine en cours, celle qui contient aujourd'hui : la dernière consultable. */
    readonly currentWeek: Week,
  ) {}

  static of(habits: readonly Habit[], today: Day): History {
    const currentWeek = Week.containing(today);
    const firstWeek = habits
      .map((habit) => Week.containing(habit.createdOn))
      .reduce((first, week) => (week.isBefore(first) ? week : first), currentWeek);
    return new History(firstWeek, currentWeek);
  }

  /** Vrai si la semaine d'avant `week` est consultable (action « Semaine précédente »). */
  canGoBefore(week: Week): boolean {
    return week.isAfter(this.firstWeek);
  }

  /** Vrai si la semaine d'après `week` est consultable (action « Semaine suivante »). */
  canGoAfter(week: Week): boolean {
    return week.isBefore(this.currentWeek);
  }

  /** `week` si elle est consultable, sinon la semaine consultable la plus proche. */
  weekWithin(week: Week): Week {
    if (week.isBefore(this.firstWeek)) {
      return this.firstWeek;
    }
    return week.isAfter(this.currentWeek) ? this.currentWeek : week;
  }
}
