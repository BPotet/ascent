import type { Day } from '../../../domain/day/Day';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { Week } from '../../../domain/week/Week';
import { formatWeekday, MONTH_NAMES } from './formatDay';

/** La progression de la semaine d'une habitude, telle que la lisent les vues (R5, R6, R7). */
export interface WeeklyProgressShown {
  /** La progression de la semaine : ses cases « fait » jusqu'à aujourd'hui. */
  readonly weeklyProgress: number;
  /** L'objectif de la semaine (le « 3 » de « 2/3 »). */
  readonly weekTarget: number;
  /** Objectif atteint. */
  readonly targetReached: boolean;
}

/**
 * Un objectif hebdomadaire en toutes lettres (glossaire, « Objectif hebdomadaire ») : « 3 fois par
 * semaine », et 7 « Tous les jours » ; en minuscules au milieu d'une ligne (`inline`, maquette E4 :
 * « Moyenne · tous les jours »).
 */
export function weeklyTargetPhrase(
  target: WeeklyTarget,
  position: 'start' | 'inline' = 'start',
): string {
  if (target !== 7) {
    return `${target} fois par semaine`;
  }
  return position === 'start' ? 'Tous les jours' : 'tous les jours';
}

/** Une option du bloc « Objectif » pour le lecteur d'écran : « 7 fois par semaine, tous les jours ». */
export function weeklyTargetOptionLabel(target: WeeklyTarget): string {
  const times = `${target} fois par semaine`;
  return target === 7 ? `${times}, tous les jours` : times;
}

/** Vrai au-delà de l'objectif de la semaine : la progression se compte alors en nombre de fois. */
const beyondTarget = ({ weeklyProgress, weekTarget }: WeeklyProgressShown): boolean =>
  weeklyProgress > weekTarget;

/** La semaine dont on donne la progression, par défaut la semaine en cours. */
const CURRENT_WEEK = 'cette semaine';

/**
 * La progression de la semaine sur la ligne de la Vue Journée (E1) : « 2/3 cette semaine », et
 * « 3/3 cette semaine » à l'objectif tout juste atteint ; au-delà, le nombre de fois, « 4 fois cette
 * semaine » (maquette E1, décision PM du 22 octobre 2026). Le Détail du jour nomme la semaine du
 * jour (`week`, #27) : « 2/3 semaine du 12 octobre », « 4 fois semaine du 12 octobre ».
 */
export function weeklyProgressText(progress: WeeklyProgressShown, week = CURRENT_WEEK): string {
  return beyondTarget(progress)
    ? `${progress.weeklyProgress} fois ${week}`
    : `${progress.weeklyProgress}/${progress.weekTarget} ${week}`;
}

/**
 * La progression de la semaine pour le lecteur d'écran : « 2 sur 3 cette semaine », « 3 sur 3 cette
 * semaine », puis « 4 fois cette semaine » au-delà de l'objectif ; « 2 sur 3 semaine du 12 octobre »
 * pour une autre semaine (`week`, Détail du jour, #27).
 */
export function weeklyProgressAccessibilityLabel(
  progress: WeeklyProgressShown,
  week = CURRENT_WEEK,
): string {
  return beyondTarget(progress)
    ? `${progress.weeklyProgress} fois ${week}`
    : `${progress.weeklyProgress} sur ${progress.weekTarget} ${week}`;
}

/**
 * L'objectif sous le nom d'une carte de la Vue Semaine (E4), après la difficulté : « 3 fois par
 * semaine » ; en semaine de création, l'objectif de la semaine réduit aux jours restants :
 * « tous les jours · 4 cette semaine (créée jeudi) », « cette semaine-là » pour une semaine passée.
 */
export function weekCardTargetText({
  weeklyTarget,
  weekTarget,
  currentWeek,
  createdOn,
}: {
  readonly weeklyTarget: WeeklyTarget;
  readonly weekTarget: number;
  readonly currentWeek: boolean;
  readonly createdOn: Day;
}): string {
  const phrase = weeklyTargetPhrase(weeklyTarget, 'inline');
  if (weekTarget >= weeklyTarget) {
    return phrase;
  }
  const week = currentWeek ? 'cette semaine' : 'cette semaine-là';
  return `${phrase} · ${weekTarget} ${week} (créée ${formatWeekday(createdOn)})`;
}

/** Un objectif hebdomadaire qui change lundi prochain (E4) : « 4 fois par semaine dès lundi ». */
export function nextWeeklyTargetText(target: WeeklyTarget): string {
  return `${weeklyTargetPhrase(target, 'inline')} dès lundi`;
}

/** Le libellé du badge et de la puce d'une habitude dont l'objectif de la semaine est atteint. */
export const TARGET_REACHED = 'Objectif atteint';

/** La puce de progression d'une carte de la Vue Semaine (E4) : « 1/3 », « 3/3 · Objectif atteint ». */
export function progressChipText({
  weeklyProgress,
  weekTarget,
  targetReached,
}: WeeklyProgressShown): string {
  const count = `${weeklyProgress}/${weekTarget}`;
  return targetReached ? `${count} · ${TARGET_REACHED}` : count;
}

/** La puce pour le lecteur d'écran : « 1 sur 3 », « 3 sur 3, objectif atteint ». */
export function progressChipAccessibilityLabel({
  weeklyProgress,
  weekTarget,
  targetReached,
}: WeeklyProgressShown): string {
  const count = `${weeklyProgress} sur ${weekTarget}`;
  return targetReached ? `${count}, objectif atteint` : count;
}

/**
 * Le message de « Modifier l'habitude » quand l'objectif choisi change (R13, maquette E7) : il vaut à
 * partir de lundi prochain, daté (« lundi prochain (19 octobre) », le lundi qui suit `today`), et
 * la semaine en cours garde son objectif de la semaine, sauf le jour de création
 * (`appliesThisWeek`), où il vaut dès cette semaine.
 */
export function weeklyTargetChangeMessage({
  appliesThisWeek,
  weekTarget,
  today,
}: {
  readonly appliesThisWeek: boolean;
  readonly weekTarget: number | null;
  readonly today: Day;
}): string {
  if (appliesThisWeek) {
    return 'Habitude créée aujourd’hui : le nouvel objectif s’applique dès cette semaine.';
  }
  const monday = Week.containing(today).next().start;
  const nextMonday = `Nouvel objectif à partir de lundi prochain (${monday.dayOfMonth} ${MONTH_NAMES[monday.month - 1]}).`;
  return weekTarget === null ? nextMonday : `${nextMonday} Cette semaine reste à ${weekTarget}.`;
}

/** L'objectif hebdomadaire choisi, et l'objectif de la semaine de création qu'il donnerait. */
interface CreationWeek {
  readonly weeklyTarget: WeeklyTarget;
  /** L'objectif de la semaine de création, d'aujourd'hui à dimanche (`creationWeekTargetOf`, R6). */
  readonly creationWeekTarget: number;
}

/**
 * Ce que le bloc « Objectif » ajoute à la phrase en semaine de création réduite (maquette E2,
 * « Semaine de création réduite ») : « cette semaine : 5, à partir d’aujourd’hui » ; `null` quand
 * l'objectif n'est pas réduit.
 */
export function creationWeekNote({
  weeklyTarget,
  creationWeekTarget,
}: CreationWeek): string | null {
  return creationWeekTarget < weeklyTarget
    ? `cette semaine : ${creationWeekTarget}, à partir d’aujourd’hui`
    : null;
}

/**
 * Le message qui suit une création (maquette E2) : « Habitude créée », et « Habitude créée ·
 * objectif 5 cette semaine » quand l'objectif de la semaine de création est réduit.
 */
export function habitCreatedMessage({ weeklyTarget, creationWeekTarget }: CreationWeek): string {
  return creationWeekTarget < weeklyTarget
    ? `Habitude créée · objectif ${creationWeekTarget} cette semaine`
    : 'Habitude créée';
}
