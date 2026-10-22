import type { Day } from '../../../domain/day/Day';
import type { WeekTargetsRow } from '../../../domain/month/TargetsByWeek';
import { Week } from '../../../domain/week/Week';
import { capitalize, MONTH_NAMES } from './formatDay';

/** Le titre de la section sous la grille de la Vue Mois (maquette E6, #27). */
export const TARGETS_BY_WEEK_TITLE = 'Objectifs par semaine';

/** Ce qu'une ligne de la section « Objectifs par semaine » affiche d'une semaine. */
type ShownRow = Pick<WeekTargetsRow, 'week' | 'reachedCount' | 'targetCount'>;

/**
 * Une semaine dans une ligne de texte : « semaine du 12 octobre » (son lundi), « semaine du 1er
 * juin » pour un lundi 1er, ou « cette semaine » pour la semaine en cours, celle qui contient
 * `today`. C'est aussi ce qui suit la progression de la
 * semaine dans le Détail du jour (« 2/3 semaine du 12 octobre »).
 */
export function weekName(week: Week, today: Day): string {
  if (week.equals(Week.containing(today))) {
    return 'cette semaine';
  }
  const { dayOfMonth, month } = week.start;
  // Le premier jour du mois s'écrit « 1er », lu « premier » (décision UX du 22 octobre 2026).
  const day = dayOfMonth === 1 ? '1er' : String(dayOfMonth);
  return `semaine du ${day} ${MONTH_NAMES[month - 1]}`;
}

/** Le titre d'une ligne de la section : « Semaine du 5 octobre », « Cette semaine ». */
export function weekTargetsTitle({ week }: ShownRow, today: Day): string {
  return capitalize(weekName(week, today));
}

/**
 * Le compte d'une ligne de la section : « 3/4 objectifs atteints » ; au singulier quand une seule
 * habitude a un objectif de la semaine : « 0/1 objectif atteint ».
 */
export function weekTargetsCount({ reachedCount, targetCount }: ShownRow): string {
  const reached = targetCount > 1 ? 'objectifs atteints' : 'objectif atteint';
  return `${reachedCount}/${targetCount} ${reached}`;
}

/** Une ligne de la section, en une phrase : « Semaine du 5 octobre · 3/4 objectifs atteints ». */
export function weekTargetsText(row: ShownRow, today: Day): string {
  return `${weekTargetsTitle(row, today)} · ${weekTargetsCount(row)}`;
}

/**
 * Une ligne de la section pour le lecteur d'écran : « Semaine du 12 octobre, 4 objectifs atteints
 * sur 4, ouvrir la semaine » ; au singulier quand au plus un objectif est atteint : « Cette
 * semaine, 1 objectif atteint sur 4, ouvrir la semaine ».
 */
export function weekTargetsAccessibilityLabel(row: ShownRow, today: Day): string {
  const reached = row.reachedCount > 1 ? 'objectifs atteints' : 'objectif atteint';
  return `${weekTargetsTitle(row, today)}, ${row.reachedCount} ${reached} sur ${row.targetCount}, ouvrir la semaine`;
}
