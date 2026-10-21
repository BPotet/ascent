import type { Day } from '../../domain/day/Day';
import { monthDayOf, type MonthDay } from '../../domain/month/MonthDay';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Détail du jour (`DayDetail`), voir `docs/glossary.md` : le jour touché dans la Vue Mois, tel que
 * la Vue Mois le montre (`MonthDay`), relu juste avant d'être ouvert ou après une correction.
 */
export type DayDetail = MonthDay;

/**
 * Cas d'usage : le détail du jour `day`, ouvert depuis la Vue Mois (R21, R23).
 *
 * `habits` contient la case de chaque habitude active ce jour-là, dans l'ordre de création ; une case
 * `editable` se corrige avec `toggleCheckIn(deps, habitDay.habit.id, habitDay.day)` (R10 à R13 :
 * sans limite de temps, +10 / −10 Xp, marque « corrigé »). `notStartedHabits` contient les habitudes
 * existantes créées plus tard, « hors habitude », jamais modifiables (R12, Q3). Un jour à venir n'a
 * aucune case modifiable ; un jour neutre n'a aucune habitude active.
 * Aujourd'hui est lu une fois, dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getDayDetail(
  { clock, unitOfWork }: UseCaseDependencies,
  day: Day,
): Promise<DayDetail> {
  return unitOfWork.run(async ({ habits, checkIns }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    return monthDayOf(day, existing, await checkIns.listBetween(day, day), today);
  });
}
