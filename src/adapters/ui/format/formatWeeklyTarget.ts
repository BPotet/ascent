import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';

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

/**
 * La progression de la semaine sur la ligne de la Vue Journée (E1) : « 2/3 cette semaine » ; une
 * fois l'objectif atteint, le nombre de fois, « 4 fois cette semaine ».
 */
export function weeklyProgressText({
  weeklyProgress,
  weekTarget,
  targetReached,
}: WeeklyProgressShown): string {
  return targetReached
    ? `${weeklyProgress} fois cette semaine`
    : `${weeklyProgress}/${weekTarget} cette semaine`;
}

/** La progression de la semaine pour le lecteur d'écran : « 2 sur 3 cette semaine ». */
export function weeklyProgressAccessibilityLabel({
  weeklyProgress,
  weekTarget,
  targetReached,
}: WeeklyProgressShown): string {
  return targetReached
    ? `${weeklyProgress} fois cette semaine`
    : `${weeklyProgress} sur ${weekTarget} cette semaine`;
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
 * partir de lundi prochain et la semaine en cours garde son objectif de la semaine, sauf le jour de
 * création (`appliesThisWeek`), où il vaut dès cette semaine.
 */
export function weeklyTargetChangeMessage({
  appliesThisWeek,
  weekTarget,
}: {
  readonly appliesThisWeek: boolean;
  readonly weekTarget: number | null;
}): string {
  if (appliesThisWeek) {
    return 'Habitude créée aujourd’hui : le nouvel objectif s’applique dès cette semaine.';
  }
  const nextMonday = 'Nouvel objectif à partir de lundi prochain.';
  return weekTarget === null ? nextMonday : `${nextMonday} Cette semaine reste à ${weekTarget}.`;
}
