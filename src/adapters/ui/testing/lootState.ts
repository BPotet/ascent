// Réservé aux tests du Coffre (#227) : l'état du flux du butin qui fait tomber, ou non, un objet à la
// fin du combat de l'ascension.
import type { Ascent } from '../../../domain/ascent/Ascent';
import { drawLoot } from '../../../domain/ascent/items';
import type { RandomState } from '../../../domain/battle/SeededRandom';
import { unlockedItems } from '../../../domain/ascent/unlocks';

/** Le premier état du flux du butin pour lequel le combat de `ascent` donne un objet, ou rien. */
export function lootState(ascent: Ascent, found: boolean): RandomState {
  for (let state = 0; ; state += 1) {
    const loot = drawLoot(
      ascent.encounter!,
      ascent.gauge,
      ascent.equipment,
      state,
      unlockedItems(ascent.unlocks),
    );
    if ((loot.value !== null) === found) return state;
  }
}
