import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawWeighted, type Drawn } from './draw';
import { TIERS } from './tiers';

/** Les Élites du palier 1 : le Chevalier déchu, Les Jumeaux (#108) et le Fossoyeur (#258). */
export const ELITES: readonly EnemyKind[] = TIERS[1].elites;

/**
 * Les Élites que peut tirer une porte Élite, la règle du sac (#258, D5), dans l'ordre du palier :
 * celles qui ne sont pas encore dans `faced` (les Élites affrontées au palier) ; quand toutes l'ont
 * été, toutes sauf la dernière affrontée ; si cela n'en laisse aucune (un palier à une seule Élite),
 * la liste entière. Avec 2 Élites, c'est la règle R5 de #244 : elles alternent.
 */
export function eliteCandidates(
  elites: readonly EnemyKind[],
  faced: readonly EnemyKind[],
): readonly EnemyKind[] {
  const fresh = elites.filter((elite) => !faced.includes(elite));
  if (fresh.length > 0) return fresh;
  const others = elites.filter((elite) => elite !== faced.at(-1));
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
