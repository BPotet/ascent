import { DIFFICULTIES, type Difficulty, XP_PER_CHECK_IN } from '../../../domain/habit/Difficulty';
import { formatXpChange } from './formatXp';

/** La difficulté telle que l'écrit l'interface (glossaire, « Difficulté »). */
export const difficultyLabels: Readonly<Record<Difficulty, string>> = {
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
};

/** Ce que rapporte une case « fait » à cette difficulté, lu du barème : « +20 XP ». */
export function difficultyXpLabel(difficulty: Difficulty): string {
  return formatXpChange(XP_PER_CHECK_IN[difficulty]);
}

/**
 * La difficulté pour le lecteur d'écran, avec son barème : « Difficile, 20 XP par suivi »
 * (maquette, « Lecteur d'écran »).
 */
export function difficultyAccessibilityLabel(difficulty: Difficulty): string {
  return `${difficultyLabels[difficulty]}, ${XP_PER_CHECK_IN[difficulty]} XP par suivi`;
}

/** Le nombre de sommets de l'icône : 1 (Facile), 2 (Moyenne) ou 3 (Difficile). */
export function peakCount(difficulty: Difficulty): number {
  return DIFFICULTIES.indexOf(difficulty) + 1;
}

/**
 * Le message de « Modifier l'habitude » quand la difficulté choisie change (R12, maquette E7) :
 * toute la semaine en cours est réévaluée au barème choisi, jamais les semaines passées.
 */
export function difficultyChangeMessage(difficulty: Difficulty): string {
  return `S’applique à toute cette semaine : les suivis de la semaine rapporteront ${difficultyXpLabel(difficulty)}. Les semaines passées ne changent pas.`;
}
