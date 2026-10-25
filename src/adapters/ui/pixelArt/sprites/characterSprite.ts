import { ell, finish, grid, line, poly, px, rect, type Sprite } from './Sprite';

/** Les images du personnage : 0 au repos, 1 un pixel d'art plus bas, 2 la lanterne levée. */
export type CharacterFrame = 0 | 1 | 2;

// Stryker disable all: dessin purement visuel, celui de la maquette (`drawPerso`).
/**
 * Le personnage (`characterSprite`) : un voyageur encapuchonné, bâton et lanterne, distinct du héros
 * de la tour. 24 × 32 pixels d'art, finition et contour d'encre compris.
 */
export function characterSprite(frame: CharacterFrame): Sprite {
  const g = grid(20, 28);
  const b = frame === 1 ? 1 : 0;
  const up = frame === 2;
  rect(g, 7, 21, 2, 6, 3);
  rect(g, 11, 21, 2, 6, 3);
  rect(g, 6, 26, 3, 1, 2);
  rect(g, 11, 26, 3, 1, 2);
  poly(
    g,
    [
      [6, 9 + b],
      [14, 9 + b],
      [16, 23],
      [4, 23],
    ],
    19,
  );
  for (let x = 4, k = 0; x < 16; x += 3, k += 1) {
    poly(
      g,
      [
        [x, 23],
        [x + 3, 23],
        [x + 1.5, 24 + (k % 2)],
      ],
      19,
    );
  }
  line(g, 7, 10 + b, 13, 18, 21, 1);
  ell(g, 10, 6 + b, 4, 4, 19);
  poly(
    g,
    [
      [6, 6 + b],
      [14, 6 + b],
      [13, 11 + b],
      [7, 11 + b],
    ],
    19,
  );
  ell(g, 10, 7 + b, 2, 2, 1);
  px(g, 9, 7 + b, 8);
  px(g, 11, 7 + b, 8);
  line(g, 3, up ? 0 : 2, 3, 27, 21, 1);
  px(g, 3, up ? -1 : 1, 7);
  line(g, 6, 12 + b, 3, 14, 19, 2);
  const lanternX = 16;
  const lanternY = up ? 4 : 16;
  line(g, 14, 11 + b, lanternX, lanternY - 1, 19, 2);
  rect(g, lanternX - 1, lanternY, 3, 4, 8);
  px(g, lanternX, lanternY + 1, 9);
  px(g, lanternX, lanternY + 2, 9);
  px(g, lanternX, lanternY - 1, 5);
  px(g, lanternX - 1, lanternY + 4, 7);
  px(g, lanternX + 1, lanternY + 4, 7);
  return finish(g);
}
// Stryker restore all
