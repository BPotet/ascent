/** Les sorties (`Exit`, P1, P2) : les 2 portes proposées après un étage, de types distincts. */
import type { RandomState } from '../battle/SeededRandom';
import { drawInt, drawWeighted, type Drawn } from './draw';

/** Le type d'une porte : Combat, Élite, Feu de camp, ou le boss après l'étage 5. */
export type ExitKind = 'combat' | 'elite' | 'campfire' | 'boss';
export type DoorKind = Exclude<ExitKind, 'boss'>;

/** Une sortie, avec la taille du groupe (`GroupSize`) annoncée sur une porte Combat. */
export interface Exit {
  readonly kind: ExitKind;
  readonly groupSize: number | null;
}

/** Les poids Combat / Élite / Feu de camp, par étage (P2). */
export const EXIT_WEIGHTS: Readonly<Record<number, Readonly<Record<DoorKind, number>>>> = {
  2: { combat: 30, elite: 10, campfire: 10 },
  3: { combat: 30, elite: 15, campfire: 10 },
  4: { combat: 30, elite: 15, campfire: 10 },
  5: { combat: 25, elite: 20, campfire: 5 },
};

const DOORS: readonly DoorKind[] = ['combat', 'elite', 'campfire'];

function weightsOf(floor: number, kinds: readonly DoorKind[]) {
  return kinds.map((kind) => [kind, EXIT_WEIGHTS[floor]![kind]] as const);
}

/**
 * Les types des 2 portes de l'étage `floor` : la 1re parmi les trois types, la 2e parmi les deux
 * restants. Garantie du Feu de camp (`CampfireGuarantee`) : une des portes est un Feu de camp
 * (côté tiré à égalité), l'autre est tirée entre Combat et Élite.
 */
export function drawExitKinds(
  floor: number,
  random: RandomState,
  campfireGuaranteed: boolean,
): Drawn<readonly [DoorKind, DoorKind]> {
  if (campfireGuaranteed) {
    const side = drawInt(0, 1, random);
    const other = drawWeighted(weightsOf(floor, ['combat', 'elite']), side.random);
    const value: [DoorKind, DoorKind] =
      side.value === 0 ? ['campfire', other.value] : [other.value, 'campfire'];
    return { value, random: other.random };
  }
  const first = drawWeighted(weightsOf(floor, DOORS), random);
  const second = drawWeighted(
    weightsOf(
      floor,
      DOORS.filter((kind) => kind !== first.value),
    ),
    first.random,
  );
  return { value: [first.value, second.value], random: second.random };
}
