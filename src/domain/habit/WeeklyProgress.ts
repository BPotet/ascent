import type { CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import type { Week } from '../week/Week';

/**
 * Progression de la semaine (`weeklyProgress`), voir `docs/glossary.md` : le nombre de cases
 * « fait » d'une habitude sur `week`, pour les jours jusqu'à `upTo` inclus (R5). `checkIns` sont les
 * suivis de **cette** habitude ; ceux d'autres semaines, ou d'un jour après `upTo` (un jour devenu
 * futur après un recul d'horloge), ne comptent pas. Un « pas fait » corrigé ne compte pas.
 *
 * Les vues passent aujourd'hui en `upTo`. Affichée « 2/3 cette semaine ».
 */
export function weeklyProgressOf(checkIns: readonly CheckIn[], week: Week, upTo: Day): number {
  return checkIns.filter(({ day, done }) => done && week.contains(day) && !day.isAfter(upTo))
    .length;
}

/**
 * Objectif atteint (`targetReached`), voir `docs/glossary.md` : la progression de la semaine est au
 * moins égale à l'objectif de la semaine (R7). Au-delà, l'objectif reste atteint (« 4/3 »). Une
 * semaine sans objectif (`null`, avant la mise à jour, R17) ne l'atteint jamais. Pas de pénalité
 * sinon.
 */
export function isTargetReached(progress: number, weekTarget: number | null): boolean {
  return weekTarget !== null && progress >= weekTarget;
}
