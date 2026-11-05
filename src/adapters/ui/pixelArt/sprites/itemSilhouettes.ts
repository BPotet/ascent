import type { ItemSlot } from '../../../../domain/ascent/items';
import { ell, finish, grid, px, rect, type Sprite } from './Sprite';

const DARK = 2;
const EYES = 9;

// Stryker disable all: dessin purement visuel (silhouette provisoire, #105).
const SHAPES: Readonly<Record<ItemSlot, (sprite: Sprite) => readonly [number, number]>> = {
  weapon: (g) => {
    rect(g, 6, 0, 4, 10, DARK);
    rect(g, 2, 10, 12, 2, DARK);
    rect(g, 7, 12, 2, 3, DARK);
    rect(g, 6, 15, 4, 1, DARK);
    return [6, 4];
  },
  armor: (g) => {
    rect(g, 0, 2, 16, 4, DARK);
    rect(g, 2, 6, 12, 9, DARK);
    rect(g, 6, 2, 4, 2, 0);
    return [4, 7];
  },
  accessory: (g) => {
    rect(g, 7, 0, 2, 5, DARK);
    ell(g, 8, 10, 5, 5, DARK);
    return [5, 9];
  },
};

/**
 * La silhouette provisoire d'un objet sans asset validé dans l'Atelier : l'icône de son
 * emplacement, sombre, avec seulement les yeux. 20 × 20 pixels d'art, contour d'encre compris.
 */
export function itemSilhouette(slot: ItemSlot): Sprite {
  const g = grid(16, 16);
  const [x, y] = SHAPES[slot](g);
  px(g, x, y, EYES);
  px(g, 15 - x, y, EYES);
  return finish(g, { flat: true });
}
// Stryker restore all
