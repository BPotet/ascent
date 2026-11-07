import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawWeighted, type Drawn } from './draw';
import { TIERS } from './tiers';

/** Les Élites du palier 1 : le Chevalier déchu et Les Jumeaux (#108). */
export const ELITES: readonly EnemyKind[] = TIERS[1].elites;

/**
 * Les Élites que peut tirer une porte Élite (#244, R5) : celles du palier, sauf la dernière
 * affrontée au palier (`lastElite`). Si cela n'en laisse aucune (un palier à une seule Élite), la
 * liste entière.
 */
export function eliteCandidates(
  elites: readonly EnemyKind[],
  lastElite: EnemyKind | undefined,
): readonly EnemyKind[] {
  const others = elites.filter((elite) => elite !== lastElite);
  return others.length > 0 ? others : elites;
}

/**
 * L'Élite derrière une porte Élite (K8), parmi celles du palier : tirée à égalité avec la graine de
 * l'ascension ; seule, elle n'est pas tirée et l'état du générateur ne change pas.
 */
export function drawElite(elites: readonly EnemyKind[], random: RandomState): Drawn<EnemyKind> {
  if (elites.length === 1) return { value: elites[0]!, random };
  return drawWeighted(
    elites.map((elite) => [elite, 1] as const),
    random,
  );
}
