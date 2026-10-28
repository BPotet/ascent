/** Le groupe d'ennemis (`EnemyGroup`, P3) : sa taille, selon l'étage, et sa composition. */
import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawWeighted, type Drawn } from './draw';

/** Les poids de la taille du groupe (1 à 5 ennemis), par étage. */
export const GROUP_SIZE_WEIGHTS: Readonly<Record<number, readonly number[]>> = {
  1: [4, 10, 6, 0, 0],
  2: [1, 6, 9, 4, 0],
  3: [0, 5, 9, 5, 1],
  4: [0, 4, 8, 7, 1],
  5: [0, 2, 8, 8, 2],
};

/** Les poids de la taille à l'étage `floor` : après un groupe de 5, un tirage de 5 devient 4. */
export function sizeWeights(floor: number, fiveFaced: boolean): readonly number[] {
  const [one, two, three, four, five] = GROUP_SIZE_WEIGHTS[floor]!;
  return fiveFaced ? [one!, two!, three!, four! + five!, 0] : [one!, two!, three!, four!, five!];
}

export function drawGroupSize(
  floor: number,
  random: RandomState,
  fiveFaced: boolean,
): Drawn<number> {
  return drawWeighted(
    sizeWeights(floor, fiveFaced).map((weight, index) => [index + 1, weight] as const),
    random,
  );
}

/** Les poids de composition, dans l'ordre du Codex : Goule 3, Spectre 2, Nécromancien 1, Villageois fou 2. */
export const KIND_WEIGHTS = { ghoul: 3, specter: 2, necromancer: 1, madVillager: 2 } as const;

/**
 * La composition d'un groupe de `size` ennemis, tirée de gauche à droite : au plus 1 de chaque
 * type sauf la Goule (un type à son plafond n'est plus tiré) ; un ennemi seul n'est jamais un
 * Nécromancien.
 */
export function drawGroup(size: number, random: RandomState): Drawn<EnemyKind[]> {
  const enemies: EnemyKind[] = [];
  let state = random;
  for (let index = 0; index < size; index += 1) {
    const allowed = (Object.keys(KIND_WEIGHTS) as (keyof typeof KIND_WEIGHTS)[]).filter(
      (kind) =>
        kind === 'ghoul' || (!enemies.includes(kind) && !(kind === 'necromancer' && size === 1)),
    );
    const drawn = drawWeighted(
      allowed.map((kind) => [kind, KIND_WEIGHTS[kind]] as const),
      state,
    );
    enemies.push(drawn.value);
    state = drawn.random;
  }
  return { value: enemies, random: state };
}
