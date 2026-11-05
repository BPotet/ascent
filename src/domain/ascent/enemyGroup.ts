/** Le groupe d'ennemis (`EnemyGroup`, P3) : sa taille, selon l'étage et le palier, et sa composition. */
import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawWeighted, type Drawn } from './draw';
import { TIERS, type Tier } from './tiers';

/** Les poids de la taille du groupe (1 à 5 ennemis), par étage, au palier 1. */
export const GROUP_SIZE_WEIGHTS = TIERS[1].groupSizeWeights;

/**
 * Les poids de la taille à l'étage `floor` du palier `tier` : après un groupe de 5, un tirage de 5
 * devient 4 (sans effet aux paliers 2 et 3, qui ne tirent jamais 5).
 */
export function sizeWeights(floor: number, fiveFaced: boolean, tier: Tier = 1): readonly number[] {
  const [one, two, three, four, five] = TIERS[tier].groupSizeWeights[floor]!;
  return fiveFaced ? [one!, two!, three!, four! + five!, 0] : [one!, two!, three!, four!, five!];
}

export function drawGroupSize(
  floor: number,
  random: RandomState,
  fiveFaced: boolean,
  tier: Tier = 1,
): Drawn<number> {
  return drawWeighted(
    sizeWeights(floor, fiveFaced, tier).map((weight, index) => [index + 1, weight] as const),
    random,
  );
}

/**
 * Les poids de composition du palier 1, dans l'ordre du Codex : Goule 3, Spectre 2, Nécromancien 1,
 * Squelette 3, Villageois fou 2.
 */
export const KIND_WEIGHTS: Readonly<Partial<Record<EnemyKind, number>>> = Object.fromEntries(
  TIERS[1].enemies.map((draw) => [draw.kind, draw.weight]),
);

/**
 * La composition d'un groupe de `size` ennemis du palier `tier`, tirée de gauche à droite parmi
 * ses ennemis, dans leur ordre : un ennemi à son plafond n'est plus tiré ; un soutien n'est jamais
 * un ennemi seul.
 */
export function drawGroup(size: number, random: RandomState, tier: Tier = 1): Drawn<EnemyKind[]> {
  const enemies: EnemyKind[] = [];
  let state = random;
  for (let index = 0; index < size; index += 1) {
    const allowed = TIERS[tier].enemies.filter(
      ({ kind, cap, neverAlone }) =>
        enemies.filter((enemy) => enemy === kind).length < cap && !(neverAlone && size === 1),
    );
    const drawn = drawWeighted(
      allowed.map(({ kind, weight }) => [kind, weight] as const),
      state,
    );
    enemies.push(drawn.value);
    state = drawn.random;
  }
  return { value: enemies, random: state };
}
