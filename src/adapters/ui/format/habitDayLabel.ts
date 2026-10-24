import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import { checkInStatusLabels } from './checkInStatus';
import { CORRECTED } from '../components/CorrectedMark';
import { difficultyAccessibilityLabel } from './formatDifficulty';
import { formatDayAndMonth } from './formatDay';
import {
  TARGET_REACHED,
  type WeeklyProgressShown,
  weeklyProgressAccessibilityLabel,
} from './formatWeeklyTarget';

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
