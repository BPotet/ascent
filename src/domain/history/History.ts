import type { Day } from '../day/Day';
import type { Habit } from '../habit/Habit';
import { Month } from '../month/Month';
import { Week } from '../week/Week';

/**
 * Historique (`History`), voir `docs/glossary.md` : les semaines et les mois consultables (R22), de
 * la semaine (du mois) qui contient le plus ancien jour de création parmi les habitudes existantes
 * jusqu'à la semaine (au mois) en cours. Sans habitude, seuls la semaine et le mois en cours sont
 * consultables. Les bornes se recalculent à chaque lecture : une habitude supprimée n'en fait plus
 * partie.
 */
export class History {
  private constructor(
    /** La plus ancienne semaine consultable. */
    readonly firstWeek: Week,
    /** La semaine en cours, celle qui contient aujourd'hui : la dernière consultable. */
    readonly currentWeek: Week,
    /** Le plus ancien mois consultable. */
    readonly firstMonth: Month,
    /** Le mois en cours, celui qui contient aujourd'hui : le dernier consultable. */
    readonly currentMonth: Month,
  ) {}

  static of(habits: readonly Habit[], today: Day): History {
    const currentWeek = Week.containing(today);
    const firstWeek = habits
      .map((habit) => Week.containing(habit.createdOn))
      .reduce((first, week) => (week.isBefore(first) ? week : first), currentWeek);
    const currentMonth = Month.containing(today);
    const firstMonth = habits
      .map((habit) => Month.containing(habit.createdOn))
      .reduce((first, month) => (month.isBefore(first) ? month : first), currentMonth);
    return new History(firstWeek, currentWeek, firstMonth, currentMonth);
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

  /** Vrai si le mois d'avant `month` est consultable (action « Mois précédent »). */
  canGoBeforeMonth(month: Month): boolean {
    return month.isAfter(this.firstMonth);
  }

  /** Vrai si le mois d'après `month` est consultable (action « Mois suivant »). */
  canGoAfterMonth(month: Month): boolean {
    return month.isBefore(this.currentMonth);
  }

  /** `month` s'il est consultable, sinon le mois consultable le plus proche. */
  monthWithin(month: Month): Month {
    if (month.isBefore(this.firstMonth)) {
      return this.firstMonth;
    }
    return month.isAfter(this.currentMonth) ? this.currentMonth : month;
  }
}
