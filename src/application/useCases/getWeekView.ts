import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import { isClosedDay } from '../../domain/day/DayClosing';
import type { Habit } from '../../domain/habit/Habit';
import { History } from '../../domain/history/History';
import type { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Une ligne de la Vue Semaine : une habitude et ses 7 cases, du lundi au dimanche. */
export interface WeekViewRow {
  readonly habit: Habit;
  readonly days: readonly HabitDay[];
}

/** Ce que montre la Vue Semaine (`WeekView`). */
export interface WeekView {
  /** La semaine affichée. */
  readonly week: Week;
  /** Aujourd'hui, à mettre en évidence s'il est dans la semaine affichée. */
  readonly today: Day;
  /** Vrai si la semaine affichée est la semaine en cours (celle qui contient aujourd'hui). */
  readonly isCurrentWeek: boolean;
  /** Toutes les habitudes existantes, dans l'ordre de création (R21), vide sans habitude. */
  readonly rows: readonly WeekViewRow[];
  /** Vrai si l'action « Semaine précédente » est possible (R22). */
  readonly canGoPrevious: boolean;
  /** Vrai si l'action « Semaine suivante » est possible : jamais au-delà de la semaine en cours. */
  readonly canGoNext: boolean;
}

/**
 * Dans la Vue Semaine, seule la case d'aujourd'hui se modifie pour l'instant : la correction des
 * jours clos y arrive avec #9, qui supprimera cette restriction.
 */
function inWeekView(habitDay: HabitDay, today: Day): HabitDay {
  return isClosedDay(habitDay.day, today) ? { ...habitDay, editable: false } : habitDay;
}

const checkInOf = (checkIns: readonly CheckIn[], habit: Habit, day: Day): CheckIn | null =>
  checkIns.find((checkIn) => checkIn.habitId === habit.id && checkIn.day.equals(day)) ?? null;

/**
 * Cas d'usage : la Vue Semaine de `week`, ou de la semaine en cours si `week` est omise.
 *
 * Chaque habitude existante a ses 7 cases calculées par `habitDayOf` (R8, R7, R12) ; une case est
 * modifiable (`editable`) seulement si un tap la change, avec `toggleCheckIn` sur son jour.
 * Une semaine hors de l'historique (après la semaine en cours, avant la semaine de la plus ancienne
 * habitude) n'est pas affichée : la vue montre à la place la semaine consultable la plus proche.
 * Aujourd'hui est lu une fois, dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getWeekView(
  { clock, unitOfWork }: UseCaseDependencies,
  week?: Week,
): Promise<WeekView> {
  return unitOfWork.run(async ({ habits, checkIns }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    const history = History.of(existing, today);
    const shown = history.weekWithin(week ?? history.currentWeek);
    const weekCheckIns = await checkIns.listBetween(shown.start, shown.end);
    const days = shown.days();
    return {
      week: shown,
      today,
      isCurrentWeek: shown.equals(history.currentWeek),
      rows: existing.map((habit) => ({
        habit,
        days: days.map((day) =>
          inWeekView(habitDayOf(habit, day, checkInOf(weekCheckIns, habit, day), today), today),
        ),
      })),
      canGoPrevious: history.canGoBefore(shown),
      canGoNext: history.canGoAfter(shown),
    };
  });
}
