import type { Day } from '../../domain/day/Day';
import { monthDayOf, type MonthDay } from '../../domain/month/MonthDay';
import {
  type HabitWeekProgress,
  weekTargetsRowOf,
  type WeekTargetsRow,
} from '../../domain/month/TargetsByWeek';
import { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Détail du jour (`DayDetail`), voir `docs/glossary.md` : le jour touché dans la Vue Mois, tel que
 * la Vue Mois le montre (`MonthDay`), avec la progression de la semaine de ce jour de chaque
 * habitude (#27). Il est construit dès le toucher à partir de la Vue Mois (`dayDetailOf`), puis relu
 * (`getDayDetail`) juste après l'ouverture ou après une correction.
 */
export type DayDetail = MonthDay & {
  /** La semaine du jour : celle dont `progress` donne la progression. */
  readonly week: Week;
  /**
   * La progression de la semaine du jour, jusqu'à aujourd'hui, de chaque habitude active ce jour-là
   * qui a un objectif de la semaine, dans l'ordre de création (« 2/3 semaine du 12 octobre »). Vide
   * pour une semaine sans objectif (avant la mise à jour) ou après la semaine en cours.
   */
  readonly progress: readonly HabitWeekProgress[];
};

/**
 * Le Détail du jour de `monthDay`, à partir des lignes de la section « Objectifs par semaine » de la
 * Vue Mois déjà lue (`targetsByWeek`) : la progression vient de la ligne dont la semaine contient le
 * jour, réduite aux habitudes actives ce jour-là ; sans ligne, il n'y a pas de progression.
 *
 * Le panneau s'ouvre ainsi tout de suite avec la progression, puis il est relu par `getDayDetail`,
 * qui passe par cette même fonction : les deux ne peuvent pas diverger.
 */
export function dayDetailOf(
  monthDay: MonthDay,
  targetsByWeek: readonly WeekTargetsRow[],
): DayDetail {
  const week = Week.containing(monthDay.day);
  const row = targetsByWeek.find((each) => each.week.equals(week));
  return {
    ...monthDay,
    week,
    progress: row?.habits.filter(({ habit }) => habit.isActiveOn(monthDay.day)) ?? [],
  };
}

/**
 * Cas d'usage : le détail du jour `day`, ouvert depuis la Vue Mois (R21, R23).
 *
 * `habits` contient la case de chaque habitude active ce jour-là, dans l'ordre de création ; une case
 * `editable` se corrige avec `toggleCheckIn(deps, habitDay.habit.id, habitDay.day)` (R10 à R13 :
 * sans limite de temps, +10 / −10 Xp, marque « corrigé »). `notStartedHabits` contient les habitudes
 * existantes créées plus tard, « hors habitude », jamais modifiables (R12, Q3). Un jour à venir n'a
 * aucune case modifiable ; un jour neutre n'a aucune habitude active.
 *
 * Il compte les habitudes attendues comme le Jour du mois (#25), avec les suivis du lundi de la
 * semaine de `day` jusqu'à `day`, et donne la progression de la semaine de `day` comme la section
 * « Objectifs par semaine » (#27), avec tous les suivis de la semaine jusqu'à aujourd'hui : les suivis
 * sont donc lus pour **toute la semaine de `day`**, même quand elle déborde sur un autre mois, avec
 * les changements de réglages. Le Détail du jour et la Vue Mois ne peuvent donc pas se contredire.
 * Aujourd'hui est lu une fois, dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getDayDetail(
  { clock, unitOfWork }: UseCaseDependencies,
  day: Day,
): Promise<DayDetail> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    const week = Week.containing(day);
    const weekCheckIns = await checkIns.listBetween(week.start, week.end);
    const changes = await settingsChanges.listAll();
    const row = weekTargetsRowOf(week, existing, weekCheckIns, changes, today);
    return dayDetailOf(
      monthDayOf(day, existing, weekCheckIns, changes, today),
      row === null ? [] : [row],
    );
  });
}
