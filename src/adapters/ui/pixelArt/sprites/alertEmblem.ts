import { finish, grid, poly, rect, type Sprite } from './Sprite';

// Stryker disable all: dessin purement visuel, celui de la maquette (`drawAlert`).
/** L'emblème d'alerte des erreurs : 24 × 24 pixels d'art, finition et contour d'encre compris. */
export function alertEmblem(): Sprite {
  const g = grid(20, 20);
  poly(
    g,
    [
      [10, 0],
      [19.6, 19.6],
      [0.4, 19.6],
    ],
    24,
  );
  rect(g, 9, 6, 2, 8, 1);
  rect(g, 9, 16, 2, 2, 1);
  return finish(g);
}
// Stryker restore all
