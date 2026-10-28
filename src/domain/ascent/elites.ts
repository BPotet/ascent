import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawWeighted, type Drawn } from './draw';

/** Les Élites du palier 1 : le Chevalier déchu et Les Jumeaux (#108). */
export const ELITES: readonly EnemyKind[] = ['fallenKnight', 'twins'];

/**
 * L'Élite derrière une porte Élite (K8) : tirée à égalité avec la graine de l'ascension ; seule,
 * elle n'est pas tirée et l'état du générateur ne change pas.
 */
export function drawElite(elites: readonly EnemyKind[], random: RandomState): Drawn<EnemyKind> {
  if (elites.length === 1) return { value: elites[0]!, random };
  return drawWeighted(
    elites.map((elite) => [elite, 1] as const),
    random,
  );
}
