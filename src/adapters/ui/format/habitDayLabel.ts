import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import { checkInStatusLabels, CORRECTED } from './checkInStatus';
import { difficultyAccessibilityLabel } from './formatDifficulty';
import { formatDayAndMonth } from './formatDay';
import {
  TARGET_REACHED,
  type WeeklyProgressShown,
  weeklyProgressAccessibilityLabel,
} from './formatWeeklyTarget';

/** Ce qu'une case de la Vue Semaine lit au lecteur d'écran quand un tap ne la change pas. */
export const UNAVAILABLE = 'indisponible';

/** Le libellé, pour le lecteur d'écran, de l'action qui ouvre « Modifier l'habitude ». */
export const editHabitLabel = (name: string) => `Modifier l’habitude ${name}`;

/**
 * L'annonce d'une ligne d'habitude (Vue Journée, Détail du jour), partagée par toutes ses versions :
 * le nom, le jour, l'état du suivi, la progression de la semaine (`weekLabel`, « cette semaine »
 * par défaut), « corrigé », la difficulté et ce que rapporte un suivi, puis « objectif atteint ».
 * « Cuisiner, mercredi 14 octobre, à faire, 2 sur 3 cette semaine, Difficile, 20 XP par suivi ».
 */
export function habitDayAccessibilityLabel({
  habitDay: { habit, day, status, corrected },
  difficulty,
  weeklyProgress,
  weekLabel,
}: {
  readonly habitDay: HabitDay;
  readonly difficulty?: Difficulty | undefined;
  readonly weeklyProgress?: WeeklyProgressShown | undefined;
  readonly weekLabel?: string | undefined;
}): string {
  return [habit.name.value, formatDayAndMonth(day), checkInStatusLabels[status]]
    .concat(weeklyProgress ? [weeklyProgressAccessibilityLabel(weeklyProgress, weekLabel)] : [])
    .concat(corrected ? [CORRECTED] : [])
    .concat(difficulty ? [difficultyAccessibilityLabel(difficulty)] : [])
    .concat(weeklyProgress?.targetReached === true ? [TARGET_REACHED.toLowerCase()] : [])
    .join(', ');
}

/**
 * L'annonce d'une case de la Vue Semaine : le nom, le jour, l'état du suivi, « corrigé » si la case
 * porte la marque (R13), et « indisponible » quand un tap ne la change pas.
 * « Cuisiner, mercredi 14 octobre, pas fait, corrigé, indisponible ».
 */
export function habitDayCellAccessibilityLabel({
  habit,
  day,
  status,
  editable,
  corrected,
}: HabitDay): string {
  return [habit.name.value, formatDayAndMonth(day), checkInStatusLabels[status]]
    .concat(corrected ? [CORRECTED] : [])
    .concat(editable ? [] : [UNAVAILABLE])
    .join(', ');
}
