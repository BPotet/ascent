/**
 * Objectif hebdomadaire (`WeeklyTarget`), voir `docs/glossary.md` : le nombre minimum de cases
 * « fait » par semaine pour qu'une habitude soit tenue, de 1 à 7 (7 = « Tous les jours ») (R3), 7 par
 * défaut (R4). Un changement s'applique à partir de la semaine suivante, sauf le jour de création
 * (R13) : l'objectif d'une semaine se lit dans ses réglages (`WeekSettings`).
 */
export type WeeklyTarget = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Les objectifs hebdomadaires, dans l'ordre d'affichage. */
export const WEEKLY_TARGETS: readonly WeeklyTarget[] = [1, 2, 3, 4, 5, 6, 7];

/** « Tous les jours », à la création comme pour les habitudes existantes (R4, R16). */
export const DEFAULT_WEEKLY_TARGET: WeeklyTarget = 7;

/** Refus : la valeur n'est pas un objectif hebdomadaire (donnée stockée invalide, ou appel erroné). */
export class InvalidWeeklyTargetError extends Error {
  constructor(value: unknown) {
    super(`Invalid weekly target: ${JSON.stringify(value)}`);
    this.name = 'InvalidWeeklyTargetError';
  }
}

/** L'objectif hebdomadaire `value`, un entier de 1 à 7, sinon `InvalidWeeklyTargetError` (R3). */
export function parseWeeklyTarget(value: unknown): WeeklyTarget {
  const target = WEEKLY_TARGETS.find((each) => each === value);
  if (target === undefined) {
    throw new InvalidWeeklyTargetError(value);
  }
  return target;
}
