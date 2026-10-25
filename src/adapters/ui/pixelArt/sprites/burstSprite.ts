import { grid, px, type Sprite } from './Sprite';

/** Le nombre d'images de l'étincelle. */
export const BURST_FRAMES = 3;

/** Les images de l'étincelle. */
export type BurstFrame = 0 | 1 | 2;

const LIGHT = 9;
const GOLD = 8;
const GOLD_DARK = 7;
const CENTER = 16;

// Stryker disable all: dessin purement visuel, celui de la maquette (`drawBurst`).
/**
 * L'étincelle (`Burst`) qui éclate autour de la case d'une habitude faite : 3 images de 32 × 32
 * pixels d'art, des rayons qui s'écartent du centre puis s'éteignent.
 */
export function burstSprite(frame: BurstFrame): Sprite {
  const g = grid(32, 32);
  const at = (x: number, y: number, code: number) => px(g, Math.trunc(x), Math.trunc(y), code);
  if (frame === 0) {
    for (const [dx, dy] of [
      [0, -12],
      [0, 12],
      [-12, 0],
      [12, 0],
    ] as const) {
      for (let k = 0; k < 2; k += 1) {
        at(CENTER + dx * (1 + k / 12), CENTER + dy * (1 + k / 12), LIGHT);
      }
    }
    for (let k = 0; k < 3; k += 1) {
      at(CENTER, CENTER - 13 + k, GOLD);
      at(CENTER, CENTER + 11 + k, GOLD);
      at(CENTER - 13 + k, CENTER, GOLD);
      at(CENTER + 11 + k, CENTER, GOLD);
    }
  } else if (frame === 1) {
    for (let k = 0; k < 4; k += 1) {
      at(CENTER, CENTER - 15 + k, GOLD);
      at(CENTER, CENTER + 12 + k, GOLD);
      at(CENTER - 15 + k, CENTER, GOLD);
      at(CENTER + 12 + k, CENTER, GOLD);
    }
    for (const [a, b] of [
      [-11, -11],
      [11, -11],
      [-11, 11],
      [11, 11],
    ] as const) {
      at(CENTER + a, CENTER + b, LIGHT);
      at(CENTER + a + Math.sign(a), CENTER + b + Math.sign(b), GOLD);
    }
  } else {
    const sparks = [
      [0, -16],
      [0, 15],
      [-16, 0],
      [15, 0],
      [-13, -13],
      [13, -13],
      [-13, 13],
      [13, 13],
    ] as const;
    for (const [a, b] of sparks) {
      at(CENTER + a, CENTER + b, GOLD_DARK);
    }
  }
  return g;
}
// Stryker restore all
