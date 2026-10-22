import type { Day } from '../../domain/day/Day';
import { History } from '../../domain/history/History';
import type { Month } from '../../domain/month/Month';
import { monthDayOf, type MonthDay } from '../../domain/month/MonthDay';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Ce que montre la Vue Mois (`MonthView`). */
export interface MonthView {
  /** Le mois affiché. */
  readonly month: Month;
  /** Aujourd'hui, à mettre en évidence s'il est dans le mois affiché. */
  readonly today: Day;
  /** Vrai si le mois affiché est le mois en cours (celui qui contient aujourd'hui). */
  readonly isCurrentMonth: boolean;
  /** Les jours du mois, du 1er au dernier (R23). */
  readonly days: readonly MonthDay[];
  /**
   * La grille du mois : les mêmes jours, par semaines de 7 places du lundi au dimanche ; les places
   * avant le 1er et après le dernier jour sont vides (`null`).
   */
  readonly weeks: readonly (readonly (MonthDay | null)[])[];
  /** Vrai si l'action « Mois précédent » est possible (R22). */
  readonly canGoPrevious: boolean;
  /** Vrai si l'action « Mois suivant » est possible : jamais au-delà du mois en cours. */
  readonly canGoNext: boolean;
}

/**
 * Cas d'usage : la Vue Mois de `month`, ou du mois en cours si `month` est omis (R21 à R23).
 *
 * Chaque jour du mois est un `MonthDay` : « à venir » après aujourd'hui, neutre sans habitude
 * active, sinon le compteur « faites / actives », l'état de chaque habitude existante et la marque
 * « corrigé » si l'une de ses cases la porte. Les habitudes supprimées n'existent plus : elles
 * n'apparaissent dans aucun jour et ne bornent plus l'historique.
 * Un mois hors de l'historique (après le mois en cours, avant le mois de la plus ancienne habitude)
 * n'est pas affiché : la vue montre à la place le mois consultable le plus proche.
 * Les suivis du mois sont lus en une fois ; aujourd'hui est lu une fois, dans l'unité de travail.
 * Une panne de lecture est une exception, et rien n'est écrit.
 */
export function getMonthView(
  { clock, unitOfWork }: UseCaseDependencies,
  month?: Month,
): Promise<MonthView> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    const history = History.of(existing, today);
    const shown = history.monthWithin(month ?? history.currentMonth);
    const monthCheckIns = await checkIns.listBetween(shown.start, shown.end);
    const changes = await settingsChanges.listAll();
    const days = shown
      .days()
      .map((day) => monthDayOf(day, existing, monthCheckIns, changes, today));
    return {
      month: shown,
      today,
      isCurrentMonth: shown.equals(history.currentMonth),
      days,
      weeks: shown
        .weeks()
        .map((week) => week.map((day) => (day === null ? null : days[day.dayOfMonth - 1]!))),
      canGoPrevious: history.canGoBeforeMonth(shown),
      canGoNext: history.canGoAfterMonth(shown),
    };
  });
}
