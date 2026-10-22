import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import type { SettingsChange } from '../../domain/habit/SettingsChange';
import { weekSettingsOf, type WeekSettings } from '../../domain/habit/WeekSettings';
import { History } from '../../domain/history/History';
import type { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Une ligne de la Vue Semaine : une habitude, ses 7 cases, du lundi au dimanche, et ses réglages. */
export interface WeekViewRow {
  readonly habit: Habit;
  readonly days: readonly HabitDay[];
  /**
   * Les réglages de la semaine affichée (R12) : une semaine passée montre la difficulté de cette
   * semaine-là.
   */
  readonly weekSettings: WeekSettings;
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

const changesOf = (changes: readonly SettingsChange[], habit: Habit) =>
  changes.filter((change) => change.habitId === habit.id);

const checkInOf = (checkIns: readonly CheckIn[], habit: Habit, day: Day): CheckIn | null =>
  checkIns.find((checkIn) => checkIn.habitId === habit.id && checkIn.day.equals(day)) ?? null;

/**
 * Cas d'usage : la Vue Semaine de `week`, ou de la semaine en cours si `week` est omise.
 *
 * Chaque habitude existante a les réglages de la semaine affichée, et ses 7 cases calculées par `habitDayOf` (R8, R7, R12, R13) ; une case
 * est modifiable (`editable`) si un tap la change, avec `toggleCheckIn` sur son jour : aujourd'hui,
 * ou un jour clos à partir du jour de création (correction, sans limite de temps, R10). Une case
 * « à venir » ou « hors habitude » ne l'est jamais.
 * Une semaine hors de l'historique (après la semaine en cours, avant la semaine de la plus ancienne
 * habitude) n'est pas affichée : la vue montre à la place la semaine consultable la plus proche.
 * Aujourd'hui est lu une fois, dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getWeekView(
  { clock, unitOfWork }: UseCaseDependencies,
  week?: Week,
): Promise<WeekView> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    const history = History.of(existing, today);
    const shown = history.weekWithin(week ?? history.currentWeek);
    const weekCheckIns = await checkIns.listBetween(shown.start, shown.end);
    const changes = await settingsChanges.listAll();
    const days = shown.days();
    return {
      week: shown,
      today,
      isCurrentWeek: shown.equals(history.currentWeek),
      rows: existing.map((habit) => ({
        habit,
        days: days.map((day) => habitDayOf(habit, day, checkInOf(weekCheckIns, habit, day), today)),
        weekSettings: weekSettingsOf(changesOf(changes, habit), shown),
      })),
      canGoPrevious: history.canGoBefore(shown),
      canGoNext: history.canGoAfter(shown),
    };
  });
}
