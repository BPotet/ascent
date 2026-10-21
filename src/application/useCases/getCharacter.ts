import type { UseCaseDependencies } from './UseCaseDependencies';

/** Ce que montre l'en-tête de chaque vue sur le personnage (`CharacterSummary`). */
export interface CharacterSummary {
  /** L'expérience totale du personnage, toutes habitudes confondues, affichée « 40 XP » (R24). */
  readonly xp: number;
}

/**
 * Cas d'usage : l'expérience totale du personnage, pour l'en-tête de la Vue Journée, de la Vue
 * Semaine et de la Vue Mois (R24). Elle ne dépend pas d'aujourd'hui. Une panne de lecture est une
 * exception.
 */
export function getCharacter({
  unitOfWork,
}: Pick<UseCaseDependencies, 'unitOfWork'>): Promise<CharacterSummary> {
  return unitOfWork.run(async ({ character }) => ({ xp: (await character.get()).xp }));
}
